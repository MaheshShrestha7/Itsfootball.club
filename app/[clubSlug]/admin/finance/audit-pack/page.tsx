'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, Download, FileText, Printer } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useClub } from '@/lib/club-context';
import {
  auditLogCsv, checksCsv, comparisonPeriod, defaultYear, invoicesCsv, logInPeriod, missingInvoiceNumbers, packChecks, packInvoices, packPeriod, packStatement,
  packTransactions, PAYMENT_STATUS_LABEL, statementCsv, transactionsCsv, yearOptions, type AuditLogRow, type PackExpense, type PackPayment,
} from '@/lib/audit-pack';
import { formatDate } from '@/lib/dates';
import { formatMoney, toCsv } from '@/lib/finance';
import { formatAbn } from '@/lib/invoice';
import { siteToday } from '@/lib/member-prices';
import { fetchPaged } from '@/lib/paged';
import { openReceipt } from '@/lib/receipts';
import { cell, heading, heavy, ink, muted, num, paper, PAPER_PRINT_CSS, small, th, thNum, totalCell, totalNum } from '@/lib/report-paper';
import { formatEndDate } from '@/lib/sponsors';
import { getSupabaseClient } from '@/lib/supabase/client';

// A financial year of the club's records, or any dates chosen, set out for an accountant or auditor: a summary on white paper
// that prints or saves as a PDF, and the records behind it as CSV files. It only reads. Like the AGM report
// it shows nothing rather than a total worked out from a partial read.

interface Ledger {
  payments: PackPayment[];
  expenses: PackExpense[];
  settings: { currency?: string; abn?: string | null } | null;
}

const MAX_ROWS = 100000;

function downloadCsv(name: string, rows: (string | number | null | undefined)[][]) {
  const url = URL.createObjectURL(new Blob(['﻿' + toCsv(rows)], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AuditPackPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const { clubs, selectClubBySlug, members } = useClub();
  const { can, isClubSuperUser } = useAuth();
  const club = selectClubBySlug(clubSlug) || clubs[0];
  const allowed = can(club.id, 'finance');
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [showRecords, setShowRecords] = useState(false);
  const [logBusy, setLogBusy] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);

  useEffect(() => {
    if (!allowed) return;
    const db = getSupabaseClient();
    if (!db) return setError('The club\'s records can\'t be reached right now.');
    let stopped = false;
    (async () => {
      const [payments, expenses, settings] = await Promise.all([
        fetchPaged<PackPayment>((from, to) => db.from('payments').select('*').eq('club_id', club.id).order('id').range(from, to), MAX_ROWS),
        fetchPaged<PackExpense>((from, to) => db.from('expenses').select('*').eq('club_id', club.id).order('id').range(from, to), MAX_ROWS),
        db.from('club_payment_settings').select('currency, abn').eq('club_id', club.id).maybeSingle(),
      ]);
      if (stopped) return;
      const failed = payments.error || expenses.error;
      if (failed) return setError(`The pack wasn't made, because some of the club's records couldn't be read (${failed}). Please try again.`);
      setLedger({ payments: payments.data, expenses: expenses.data, settings: settings.data });
    })().catch(() => { if (!stopped) setError('The pack wasn\'t made, because the club\'s records couldn\'t be read. Check your connection and try again.'); });
    return () => { stopped = true; };
  }, [club.id, allowed]);

  const startMonth = club.fiscal_year_start_month || 7;
  const options = useMemo(() => (ledger ? yearOptions(ledger.payments, ledger.expenses, startMonth) : []), [ledger, startMonth]);
  const opening = defaultYear(options, siteToday());
  const from = range?.from ?? opening?.from ?? '';
  const to = range?.to ?? opening?.to ?? '';
  const period = useMemo(() => packPeriod(from, to, startMonth), [from, to, startMonth]);
  const startYear = period?.startYear;
  const listedYear = options.some(y => y.startYear === startYear);
  const previous = useMemo(
    () => (ledger && period ? comparisonPeriod(period, startMonth, ledger.payments, ledger.expenses) : null),
    [ledger, period, startMonth]
  );
  const currency = ledger?.settings?.currency || 'AUD';

  const pack = useMemo(() => {
    if (!ledger || !period) return null;
    const transactions = packTransactions(ledger.payments, ledger.expenses, period);
    return {
      statement: packStatement(ledger.payments, ledger.expenses, period, previous),
      transactions,
      checks: packChecks(ledger.payments, transactions, period, currency),
      invoices: packInvoices(ledger.payments, period),
      missing: missingInvoiceNumbers(ledger.payments),
    };
  }, [ledger, period, previous, currency]);

  const actorName = (id: string) => members.find(m => m.club_id === club.id && m.user_id === id)?.full_name || id;
  const fileName = (part: string) => `${club.slug}-audit-pack-${from}-to-${to}-${part}.csv`;
  const fmt = (cents: number) => (cents < 0 ? `(${formatMoney(-cents, currency)})` : formatMoney(cents, currency));

  // Read only when asked for: it's the one part of the pack the tables above don't need
  const downloadLog = async () => {
    const db = getSupabaseClient();
    if (!db || !period) return;
    setLogBusy(true);
    setLogError(null);
    const log = await fetchPaged<AuditLogRow>((from, to) => db.from('admin_audit_log')
      .select('id, actor_email, action, target_table, target_id, summary, details, created_at')
      .eq('club_id', club.id).order('id').range(from, to), MAX_ROWS).catch(() => ({ data: [], error: 'check your connection' }));
    setLogBusy(false);
    if (log.error) return setLogError(`The activity log wasn't downloaded, because it couldn't be read in full (${log.error}). Please try again.`);
    downloadCsv(fileName('activity-log'), auditLogCsv(logInPeriod(log.data, period)));
  };

  if (!allowed) return <p style={{ color: 'var(--text-secondary)' }}>Only people with access to Finance can see the audit pack.</p>;

  const found = pack ? pack.checks.filter(c => c.rows.length > 0) : [];
  const countCell = { ...num, width: '12%' };

  return (
    <div>
      {/* A closed list would print as a heading with nothing under it: the rows are in the CSV */}
      <style>{`${PAPER_PRINT_CSS} @media print { .agm-paper details { display: none !important; } }`}</style>

      <div className="admin-head">
        <div>
          <Link href={`/${club.slug}/admin/finance`} className="text-meta" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.35rem' }}>
            <ArrowLeft size={14} aria-hidden="true" /> Finance
          </Link>
          <h1>Audit pack</h1>
          <p>Your records for a financial year or any dates you choose, ready to give to your accountant or auditor.</p>
        </div>
        <div className="admin-head-actions">
          {options.length > 0 && (
            <>
              <label className="form-label m-0" htmlFor="pack-year">Financial year</label>
              <select data-view-ok id="pack-year" className="form-select" style={{ width: 'auto' }} value={listedYear ? startYear : 'custom'} onChange={e => {
                const chosen = options.find(o => o.startYear === Number(e.target.value));
                if (chosen) { setRange({ from: chosen.from, to: chosen.to }); setShowRecords(false); }
              }}>
                {!listedYear && <option value="custom">Custom dates</option>}
                {options.map(o => <option key={o.startYear} value={o.startYear}>{o.label}</option>)}
              </select>
              <label className="form-label m-0" htmlFor="pack-from">From</label>
              <input data-view-ok id="pack-from" type="date" className="form-input" style={{ width: 'auto' }} value={from} onChange={e => { setRange({ from: e.target.value, to }); setShowRecords(false); }} />
              <label className="form-label m-0" htmlFor="pack-to">To</label>
              <input data-view-ok id="pack-to" type="date" className="form-input" style={{ width: 'auto' }} value={to} onChange={e => { setRange({ from, to: e.target.value }); setShowRecords(false); }} />
            </>
          )}
          <button data-view-ok type="button" className="btn btn-primary" disabled={!pack} onClick={() => window.print()}>
            <Printer size={16} aria-hidden="true" /> Print or save as PDF
          </button>
        </div>
      </div>

      {error ? (
        <div role="alert" className="admin-flash is-error"><AlertCircle size={16} aria-hidden="true" /><span>{error}</span></div>
      ) : !ledger ? (
        <p className="text-note" role="status">Adding up the club&apos;s records…</p>
      ) : options.length === 0 ? (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <p className="text-body" style={{ margin: 0 }}>There&apos;s nothing to report yet. Record some income or expenses in Finance.</p>
        </div>
      ) : !pack || !period ? (
        <div role="alert" className="admin-flash is-error"><AlertCircle size={16} aria-hidden="true" /><span>{from && to ? 'The start date is after the end date.' : 'Choose a start date and an end date.'}</span></div>
      ) : (
        <>
          <div className="glass-panel" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
            <p className="form-label" style={{ marginTop: 0 }}>Download as CSV</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              <button data-view-ok type="button" className="btn btn-secondary btn-sm" onClick={() => downloadCsv(fileName('income-and-expenses'), statementCsv(pack.statement, period, previous))}><Download size={14} aria-hidden="true" /> Income and expenses</button>
              <button data-view-ok type="button" className="btn btn-secondary btn-sm" onClick={() => downloadCsv(fileName('transactions'), transactionsCsv(pack.transactions, actorName))}><Download size={14} aria-hidden="true" /> All transactions</button>
              <button data-view-ok type="button" className="btn btn-secondary btn-sm" onClick={() => downloadCsv(fileName('checks'), checksCsv(pack.checks))}><Download size={14} aria-hidden="true" /> Things to check</button>
              <button data-view-ok type="button" className="btn btn-secondary btn-sm" onClick={() => downloadCsv(fileName('invoices'), invoicesCsv(pack.invoices, pack.missing))}><Download size={14} aria-hidden="true" /> Invoices</button>
              {isClubSuperUser(club.id) && (
                <button data-view-ok type="button" className="btn btn-secondary btn-sm" disabled={logBusy} onClick={downloadLog}><Download size={14} aria-hidden="true" /> {logBusy ? 'Reading the log…' : 'Activity log'}</button>
              )}
            </div>
            {logError && <p role="alert" style={{ color: 'var(--c-red)', fontSize: '0.85rem', margin: '0.5rem 0 0' }}>{logError}</p>}
          </div>

          <article className="agm-paper" style={paper}>
            <header style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', paddingBottom: '1rem', borderBottom: heavy }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: '1.15rem', overflowWrap: 'anywhere' }}>{club.name}</div>
                {ledger.settings?.abn && <div style={{ color: muted, fontSize: '0.82rem' }}>ABN {formatAbn(ledger.settings.abn)}</div>}
              </div>
              <div style={{ textAlign: 'right', marginLeft: 'auto' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0, color: ink }}>Audit pack</h2>
                <div style={{ fontWeight: 700 }}>{startYear != null ? `Financial year ${period.label}: ` : 'Period: '}{formatEndDate(from)} to {formatEndDate(to)}</div>
                <div style={{ color: muted, fontSize: '0.85rem' }}>Prepared {formatDate(new Date().toISOString())}</div>
              </div>
            </header>

            <section>
              <h3 style={heading}>1. Income and expenses</h3>
              {([['Income', pack.statement.money.income, pack.statement.incomeCounts, pack.statement.money.totalIncome, pack.statement.money.previousIncome],
                ['Expenses', pack.statement.money.expenses, pack.statement.expenseCounts, pack.statement.money.totalExpenses, pack.statement.money.previousExpenses]] as const).map(([name, lines, counts, total, previousTotal]) => (
                <table key={name} style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
                  <thead><tr>
                    <th scope="col" style={th}>{name}</th>
                    <th scope="col" style={{ ...thNum, width: '12%' }}>Records</th>
                    <th scope="col" style={thNum}>{period.label}</th>
                    {previous && <th scope="col" style={thNum}>{previous.label}</th>}
                  </tr></thead>
                  <tbody>
                    {lines.length === 0 && <tr><td style={{ ...cell, color: muted }} colSpan={previous ? 4 : 3}>None recorded.</td></tr>}
                    {lines.map(l => (
                      <tr key={l.key}>
                        <td style={cell}>{l.label}</td>
                        <td style={countCell}>{counts[l.key] || 0}</td>
                        <td style={num}>{fmt(l.cents)}</td>
                        {previous && <td style={{ ...num, color: muted }}>{fmt(l.previousCents)}</td>}
                      </tr>
                    ))}
                    <tr>
                      <td style={totalCell} colSpan={2}>Total {name.toLowerCase()}</td>
                      <td style={totalNum}>{fmt(total)}</td>
                      {previous && <td style={{ ...totalNum, color: muted }}>{fmt(previousTotal)}</td>}
                    </tr>
                    {name === 'Expenses' && (
                      <tr>
                        <td style={{ ...totalCell, fontSize: '1rem' }} colSpan={2}>{pack.statement.money.surplus < 0 ? 'Deficit for the period' : 'Surplus for the period'}</td>
                        <td style={{ ...totalNum, fontSize: '1rem', color: pack.statement.money.surplus < 0 ? '#b91c1c' : ink }}>{fmt(pack.statement.money.surplus)}</td>
                        {previous && <td style={{ ...totalNum, color: muted }}>{fmt(pack.statement.money.previousSurplus)}</td>}
                      </tr>
                    )}
                  </tbody>
                </table>
              ))}
              <p style={small}>{pack.transactions.length} records behind these figures, in the All transactions download.{pack.statement.money.refundedCents > 0 ? ` ${fmt(pack.statement.money.refundedCents)} of refunded payments are listed there but not counted.` : ''}</p>
            </section>

            <section>
              <h3 style={heading}>2. Things to check</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th scope="col" style={th}>Check</th><th scope="col" style={{ ...thNum, width: '12%' }}>Found</th><th scope="col" style={thNum}>Amount</th></tr></thead>
                <tbody>
                  {pack.checks.map(c => (
                    <tr key={c.key}>
                      <td style={cell}>{c.title}<div style={{ color: muted, fontSize: '0.8rem' }}>{c.why}</div></td>
                      <td style={countCell}>{c.rows.length}</td>
                      <td style={num}>{c.rows.length === 0 || c.cents === null ? '-' : fmt(c.cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {found.length === 0
                ? <p style={small}>Nothing to look at. These checks only cover what&apos;s in the club&apos;s records.</p>
                : found.map(c => (
                  <details key={c.key} style={{ marginTop: '0.6rem', fontSize: '0.84rem' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 700 }}>{c.title}: see the records</summary>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.35rem' }}>
                      <tbody>
                        {c.rows.map(r => (
                          <tr key={r.id}>
                            <td style={{ ...cell, whiteSpace: 'nowrap' }}>{r.date}</td>
                            <td style={cell}>{r.party || r.description || r.category}<div style={{ color: muted }}>{r.party ? r.description : ''}</div></td>
                            <td style={num}>{formatMoney(r.cents, r.currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                ))}
            </section>

            <section>
              <h3 style={heading}>3. Invoices raised in this period</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th scope="col" style={th}>Number</th><th scope="col" style={th}>Raised</th><th scope="col" style={th}>Payer</th><th scope="col" style={th}>Status</th><th scope="col" style={thNum}>Amount</th></tr></thead>
                <tbody>
                  {pack.invoices.length === 0 && <tr><td style={{ ...cell, color: muted }} colSpan={5}>No invoices raised in this period.</td></tr>}
                  {pack.invoices.map(p => (
                    <tr key={p.id}>
                      <td style={cell}>{p.invoice_number}</td>
                      <td style={{ ...cell, whiteSpace: 'nowrap' }}>{siteToday(new Date(p.created_at).getTime())}</td>
                      <td style={cell}>{p.payer_name}</td>
                      <td style={cell}>{PAYMENT_STATUS_LABEL[p.status] || p.status}</td>
                      <td style={num}>{formatMoney(p.amount_cents, p.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={pack.missing.length ? { ...small, color: '#b91c1c', fontWeight: 700 } : small}>
                {pack.missing.length
                  ? `Missing from the club's invoice numbers, across all years: ${pack.missing.join(', ')}. A number only goes missing if its record was deleted.`
                  : 'No numbers are missing from the club\'s invoice sequence, across all years.'}
              </p>
            </section>

            <section>
              <h3 style={heading}>Limits of this pack</h3>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', color: '#334155', fontSize: '0.84rem' }}>
                <li>Prepared from the club&apos;s records in itsfootball.club. These figures have not been audited, and they haven&apos;t been checked against a bank or Stripe statement.</li>
                <li>Records can still be changed after a year ends, so a pack made later may differ from this one. Keep the copy you give your auditor.</li>
                <li>The activity log records payment status changes and deletions. It doesn&apos;t record income entered by hand, changes to an amount, or any change to an expense.</li>
                <li>Income is shown at the full amount charged, before Stripe&apos;s fees. A refunded payment comes out of the year it was paid in, whenever it was refunded. A partly refunded payment stays at its full amount.</li>
                <li>This is income and expenses only. It doesn&apos;t include a balance sheet, or what was owed at the end of the year.</li>
              </ul>
            </section>
          </article>

          <div className="glass-panel" style={{ padding: '1rem 1.25rem', marginTop: '1.25rem' }}>
            <details data-view-ok open={showRecords} onToggle={e => setShowRecords(e.currentTarget.open)}>
              <summary style={{ cursor: 'pointer', fontWeight: 700 }}>See all {pack.transactions.length} records and open their receipts</summary>
              {showRecords && (
                <div className="admin-table-wrap" style={{ marginTop: '0.75rem' }}>
                  <table className="admin-table">
                    <thead><tr>
                      <th scope="col">Date</th><th scope="col">Type</th><th scope="col">Category</th><th scope="col">Paid by or to</th><th scope="col">Status</th>
                      <th scope="col" className="is-num">Amount</th><th scope="col"><span className="sr-only">Receipt</span></th>
                    </tr></thead>
                    <tbody>
                      {pack.transactions.map(r => (
                        <tr key={r.id}>
                          <td className="is-num" style={{ textAlign: 'left' }}>{r.date}</td>
                          <td>{r.type}</td>
                          <td>{r.category}</td>
                          <td>{r.party || r.description}</td>
                          <td>{r.status}</td>
                          <td className="is-num is-strong">{formatMoney(r.cents, r.currency)}</td>
                          <td className="is-actions">
                            {r.hasReceipt && <button data-view-ok type="button" className="btn btn-secondary btn-sm" onClick={() => openReceipt(r.type === 'Income' ? 'payment' : 'expense', r.id)} aria-label={`View receipt for ${r.party || r.description || r.category}`}><FileText size={14} aria-hidden="true" /></button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </details>
          </div>
        </>
      )}
    </div>
  );
}
