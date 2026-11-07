'use client';

import React, { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, Download, Printer } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useClub } from '@/lib/club-context';
import { agmMoney, agmOwed, agmSponsors, closingBalance, membersByTier, seasonOptions, type AgmExpense, type AgmPayment, type MoneyLine } from '@/lib/agm-report';
import { matchesForTeam, membersSummary, seasonRecord } from '@/lib/club-overview';
import { isCountedMember } from '@/lib/people';
import { clubTeamsOf, publicScoreHidden } from '@/lib/teams';
import { formatDate } from '@/lib/dates';
import { formatMoney, parseMoneyToCents, paymentSeason } from '@/lib/finance';
import { formatAbn } from '@/lib/invoice';
import { fetchPaged } from '@/lib/paged';
import { formatEndDate } from '@/lib/sponsors';
import { getSupabaseClient } from '@/lib/supabase/client';

// The treasurer's report for the AGM: one season on white paper that prints or saves as a PDF. Read
// from the whole ledger, page by page: a total worked out from a partial read would be wrong without
// anyone knowing, so if a read fails this shows that instead of a report.

interface Ledger {
  payments: AgmPayment[];
  expenses: AgmExpense[];
  claims: { amount_cents: number; status: string }[];
  settings: { currency?: string; abn?: string | null; gst_registered?: boolean } | null;
}

const MAX_ROWS = 100000;
const ink = '#0f172a';
const muted = '#64748b';
const rule = '1px solid #e2e8f0';
const heavy = '2px solid #0f172a';
const cell: React.CSSProperties = { padding: '0.4rem 0.5rem 0.4rem 0', borderBottom: rule, verticalAlign: 'top' };
// A set width, so the figures line up from one table to the next
const num: React.CSSProperties = { ...cell, width: '20%', textAlign: 'right', whiteSpace: 'nowrap', paddingRight: 0, paddingLeft: '0.75rem', fontVariantNumeric: 'tabular-nums' };
const totalCell: React.CSSProperties = { ...cell, fontWeight: 800, borderBottom: heavy };
const totalNum: React.CSSProperties = { ...num, fontWeight: 800, borderBottom: heavy };
const heading: React.CSSProperties = { fontSize: '1.05rem', fontWeight: 800, color: ink, margin: '1.75rem 0 0.5rem', breakAfter: 'avoid' };
const small: React.CSSProperties = { color: muted, fontSize: '0.8rem', margin: '0.4rem 0 0' };
const th: React.CSSProperties = { ...cell, fontSize: '0.72rem', letterSpacing: '0.04em', color: muted, fontWeight: 700, textAlign: 'left' };
const thNum: React.CSSProperties = { ...th, width: '20%', textAlign: 'right', paddingRight: 0, paddingLeft: '0.75rem', whiteSpace: 'nowrap' };

export default function AgmReportPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const { clubs, selectClubBySlug, members, sponsors, matches, clubTeams, events, seasons, getActiveSeason } = useClub();
  const { can } = useAuth();
  const club = selectClubBySlug(clubSlug) || clubs[0];
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [opening, setOpening] = useState('');

  useEffect(() => {
    const db = getSupabaseClient();
    if (!db) return setError('The club\'s records can\'t be reached right now.');
    let stopped = false;
    (async () => {
      const [payments, expenses, claims, settings] = await Promise.all([
        fetchPaged<AgmPayment>((from, to) => db.from('payments').select('*').eq('club_id', club.id).order('id').range(from, to), MAX_ROWS),
        fetchPaged<AgmExpense>((from, to) => db.from('expenses').select('*').eq('club_id', club.id).order('id').range(from, to), MAX_ROWS),
        fetchPaged<{ amount_cents: number; status: string }>((from, to) => db.from('expense_claims').select('amount_cents, status').eq('club_id', club.id).order('id').range(from, to), MAX_ROWS),
        db.from('club_payment_settings').select('currency, abn, gst_registered').eq('club_id', club.id).maybeSingle(),
      ]);
      if (stopped) return;
      const failed = payments.error || expenses.error || claims.error;
      if (failed) return setError(`The report wasn't made, because some of the club's records couldn't be read (${failed}). Please try again.`);
      setLedger({ payments: payments.data, expenses: expenses.data, claims: claims.data, settings: settings.data });
    })().catch(() => { if (!stopped) setError('The report wasn\'t made, because the club\'s records couldn\'t be read. Check your connection and try again.'); });
    return () => { stopped = true; };
  }, [club.id]);

  const clubSeasons = useMemo(() => seasons.filter(s => s.club_id === club.id), [seasons, club.id]);
  // Money received counts in the season it was paid, whatever season the bill was raised in
  const payments = useMemo(() => (ledger?.payments || []).map(p => ({ ...p, season: paymentSeason(p, clubSeasons) })), [ledger, clubSeasons]);
  const options = useMemo(() => seasonOptions(clubSeasons, [...payments, ...(ledger?.expenses || [])]), [clubSeasons, payments, ledger]);
  const active = getActiveSeason(club.id)?.name?.trim();
  const season = picked ?? (options.some(o => o.name === active) ? active! : options[0]?.name ?? '');
  const seasonIndex = options.findIndex(o => o.name === season);
  const info = options[seasonIndex];
  const previous = options[seasonIndex + 1]?.name ?? null;

  const money = useMemo(() => (ledger && season ? agmMoney(payments, ledger.expenses, season, previous) : null), [ledger, payments, season, previous]);
  const owed = useMemo(() => (ledger ? agmOwed(ledger.payments, ledger.expenses, ledger.claims) : null), [ledger]);
  const sponsorLines = useMemo(() => (ledger && season ? agmSponsors(payments, sponsors.filter(s => s.club_id === club.id), season) : []), [ledger, payments, sponsors, club.id, season]);

  const seesPeople = can(club.id, 'members') || can(club.id, 'squad');
  const clubMembers = useMemo(() => members.filter(m => m.club_id === club.id), [members, club.id]);
  const seasonRange = info?.start_date && info?.end_date
    ? { from: new Date(`${info.start_date}T00:00:00`), to: new Date(`${info.end_date}T23:59:59`) }
    : null;
  // With no dates to look between, "joined this season" can't be worked out, so it isn't shown
  const people = membersSummary(clubMembers, seasonRange ?? { from: new Date(0), to: new Date(0) });
  // The same members People and the headline number count, so the table adds up to it
  const counted = clubMembers.filter(isCountedMember);
  // This goes out to members, so teams that keep their scores private (junior rules) stay private
  const games = useMemo(() => matchesForTeam(matches.filter(m => m.club_id === club.id), clubTeams, null)
    .filter(m => !publicScoreHidden(m, clubTeamsOf(clubTeams, club.id))), [matches, club.id, clubTeams]);
  const record = seasonRecord(games, { season, from: new Date(0), to: new Date(0) } as Parameters<typeof seasonRecord>[1]);
  const heldEvents = seasonRange ? events.filter(e => e.club_id === club.id && new Date(e.start_time) >= seasonRange.from && new Date(e.start_time) <= seasonRange.to && new Date(e.start_time) <= new Date()).length : null;

  const currency = ledger?.settings?.currency || 'AUD';
  const fmt = (cents: number) => (cents < 0 ? `(${formatMoney(-cents, currency)})` : formatMoney(cents, currency));
  const openingCents = opening.trim() ? parseMoneyToCents(opening) : null;
  const openingBad = !!opening.trim() && openingCents === null;
  const closing = money ? closingBalance(openingCents, money.surplus) : null;

  const moneyRows = (rows: MoneyLine[]) => rows.map(l => (
    <tr key={l.key}>
      <td style={cell}>{l.label}</td>
      <td style={num}>{fmt(l.cents)}</td>
      {previous && <td style={{ ...num, color: muted }}>{fmt(l.previousCents)}</td>}
    </tr>
  ));
  const columns = (first: string) => (
    <thead><tr><th scope="col" style={th}>{first}</th><th scope="col" style={thNum}>{season}</th>{previous && <th scope="col" style={thNum}>{previous}</th>}</tr></thead>
  );

  return (
    <div>
      <style>{`
        @media print {
          @page { margin: 14mm; }
          /* color-scheme: the dark theme otherwise paints the page margins black */
          html, body { background: #fff !important; color-scheme: light !important; }
          body::before, body::after { display: none !important; }
          body * { visibility: hidden; }
          .agm-paper, .agm-paper * { visibility: visible; }
          .agm-paper { position: absolute; left: 0; top: 0; width: 100%; box-sizing: border-box; max-width: none !important; box-shadow: none !important; padding: 0 3px !important; border-radius: 0 !important; }
          .agm-paper section, .agm-paper tr { break-inside: avoid; }
        }
      `}</style>

      <div className="admin-head">
        <div>
          <Link href={`/${club.slug}/admin/finance`} className="text-meta" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.35rem' }}>
            <ArrowLeft size={14} aria-hidden="true" /> Finance
          </Link>
          <h1>AGM report</h1>
          <p>The season&apos;s money and numbers, ready to print or save as a PDF for your members.</p>
        </div>
        <div className="admin-head-actions">
          {options.length > 0 && (
            <>
              <label className="form-label m-0" htmlFor="agm-season">Season</label>
              <select data-view-ok id="agm-season" className="form-select" style={{ width: 'auto' }} value={season} onChange={e => setPicked(e.target.value)}>
                {options.map(o => <option key={o.name} value={o.name}>{o.name}</option>)}
              </select>
            </>
          )}
          <button data-view-ok type="button" className="btn btn-primary" disabled={!money || openingBad} onClick={() => window.print()}>
            <Printer size={16} aria-hidden="true" /> Print or save as PDF
          </button>
        </div>
      </div>

      {error ? (
        <div role="alert" className="admin-flash is-error"><AlertCircle size={16} aria-hidden="true" /><span>{error}</span></div>
      ) : !ledger ? (
        <p className="text-note" role="status">Adding up the club&apos;s records…</p>
      ) : !money ? (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <p className="text-body" style={{ margin: 0 }}>There&apos;s nothing to report yet. Add a season, or record some income or expenses in Finance.</p>
        </div>
      ) : (
        <>
          <div className="glass-panel" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
            <div className="form-group" style={{ margin: 0, maxWidth: 320 }}>
              <label className="form-label" htmlFor="agm-opening">Bank balance at the start of the season ({currency}, optional)</label>
              <input data-view-ok id="agm-opening" className="form-input" inputMode="decimal" placeholder="e.g. 12500.00" value={opening} aria-invalid={openingBad} onChange={e => setOpening(e.target.value)} />
            </div>
            <p className={openingBad ? undefined : 'text-meta'} role={openingBad ? 'alert' : undefined} style={{ margin: '0.4rem 0 0', ...(openingBad ? { color: 'var(--c-red)', fontSize: '0.85rem' } : {}) }}>
              {openingBad ? 'Enter an amount like 12500 or 12500.50.' : 'The app can\'t see your bank account. Enter this and the report shows the closing balance to check against your statement. It isn\'t saved.'}
            </p>
          </div>

          <article className="agm-paper" style={{ background: '#fff', color: ink, borderRadius: 14, padding: 'clamp(1.25rem, 5vw, 3rem)', boxShadow: '0 20px 50px rgba(0,0,0,0.35)', fontSize: '0.92rem', lineHeight: 1.45, maxWidth: 860, margin: '0 auto' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', paddingBottom: '1rem', borderBottom: heavy }}>
              <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center', minWidth: 0 }}>
                {club.logo_url && <img src={club.logo_url} alt="" style={{ width: 56, height: 56, objectFit: 'contain', flexShrink: 0 }} />}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: '1.15rem', overflowWrap: 'anywhere' }}>{club.name}</div>
                  {ledger.settings?.abn && <div style={{ color: muted, fontSize: '0.82rem' }}>ABN {formatAbn(ledger.settings.abn)}</div>}
                </div>
              </div>
              <div style={{ textAlign: 'right', marginLeft: 'auto' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0, color: ink }}>Annual General Meeting report</h2>
                <div style={{ fontWeight: 700 }}>
                  Season {season}{info?.start_date && info?.end_date ? `: ${formatEndDate(info.start_date)} to ${formatEndDate(info.end_date)}` : ''}
                </div>
                <div style={{ color: muted, fontSize: '0.85rem' }}>Prepared {formatDate(new Date().toISOString())}</div>
              </div>
            </header>

            <section>
              <h3 style={heading}>Income and expenses</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                {columns('Income')}
                <tbody>
                  {money.income.length === 0 && <tr><td style={{ ...cell, color: muted }} colSpan={previous ? 3 : 2}>No income recorded.</td></tr>}
                  {moneyRows(money.income)}
                  <tr><td style={totalCell}>Total income</td><td style={totalNum}>{fmt(money.totalIncome)}</td>{previous && <td style={{ ...totalNum, color: muted }}>{fmt(money.previousIncome)}</td>}</tr>
                </tbody>
              </table>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
                {columns('Expenses')}
                <tbody>
                  {money.expenses.length === 0 && <tr><td style={{ ...cell, color: muted }} colSpan={previous ? 3 : 2}>No expenses recorded.</td></tr>}
                  {moneyRows(money.expenses)}
                  <tr><td style={totalCell}>Total expenses</td><td style={totalNum}>{fmt(money.totalExpenses)}</td>{previous && <td style={{ ...totalNum, color: muted }}>{fmt(money.previousExpenses)}</td>}</tr>
                  <tr>
                    <td style={{ ...totalCell, fontSize: '1rem' }}>{money.surplus < 0 ? 'Deficit for the season' : 'Surplus for the season'}</td>
                    <td style={{ ...totalNum, fontSize: '1rem', color: money.surplus < 0 ? '#b91c1c' : ink }}>{fmt(money.surplus)}</td>
                    {previous && <td style={{ ...totalNum, color: muted }}>{fmt(money.previousSurplus)}</td>}
                  </tr>
                </tbody>
              </table>
            </section>

            {closing !== null && openingCents !== null && (
              <section>
                <h3 style={heading}>Bank balance</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr><td style={cell}>Balance at the start of the season</td><td style={num}>{fmt(openingCents)}</td></tr>
                    <tr><td style={cell}>{money.surplus < 0 ? 'Deficit for the season' : 'Surplus for the season'}</td><td style={num}>{fmt(money.surplus)}</td></tr>
                    <tr><td style={totalCell}>Expected balance at the end of the season</td><td style={totalNum}>{fmt(closing)}</td></tr>
                  </tbody>
                </table>
                <p style={small}>Worked out from the records, and to be checked against the bank statement.{money.anyCard ? ' It will differ by Stripe\'s fees (see the notes).' : ''}</p>
              </section>
            )}

            {owed && (
              <section>
                <h3 style={heading}>What&apos;s owed, as at {formatDate(new Date().toISOString())}</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th scope="col" style={th}>Owed to the club</th><th scope="col" style={thNum}>Number</th><th scope="col" style={thNum}>Amount</th></tr></thead>
                  <tbody>
                    <tr><td style={cell}>Sponsor invoices and instalments not yet paid</td><td style={num}>{owed.sponsorInvoices.count}</td><td style={num}>{fmt(owed.sponsorInvoices.cents)}</td></tr>
                    <tr><td style={cell}>Fees requested and not yet paid</td><td style={num}>{owed.fees.count}</td><td style={num}>{fmt(owed.fees.cents)}</td></tr>
                    <tr><td style={cell}>Bank transfers waiting to be checked</td><td style={num}>{owed.receipts.count}</td><td style={num}>{fmt(owed.receipts.cents)}</td></tr>
                    <tr><td style={totalCell} colSpan={2}>Total owed to the club</td><td style={totalNum}>{fmt(owed.totalToClub)}</td></tr>
                  </tbody>
                </table>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
                  <thead><tr><th scope="col" style={th}>Owed by the club</th><th scope="col" style={thNum}>Number</th><th scope="col" style={thNum}>Amount</th></tr></thead>
                  <tbody>
                    <tr><td style={cell}>Expenses to pay back to members</td><td style={num}>{owed.toMembers.count}</td><td style={num}>{fmt(owed.toMembers.cents)}</td></tr>
                    <tr><td style={cell}>Expense claims not yet decided</td><td style={num}>{owed.claims.count}</td><td style={num}>{fmt(owed.claims.cents)}</td></tr>
                    <tr><td style={totalCell} colSpan={2}>Total owed by the club</td><td style={totalNum}>{fmt(owed.totalByClub)}</td></tr>
                  </tbody>
                </table>
              </section>
            )}

            {sponsorLines.length > 0 && (
              <section>
                <h3 style={heading}>Sponsors</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th scope="col" style={th}>Sponsor</th><th scope="col" style={thNum}>Paid in {season}</th><th scope="col" style={thNum}>Still owing</th></tr></thead>
                  <tbody>
                    {sponsorLines.map((s, i) => (
                      <tr key={`${s.name}-${i}`}><td style={cell}>{s.name}</td><td style={num}>{fmt(s.paidCents)}</td><td style={num}>{s.owingCents ? fmt(s.owingCents) : '-'}</td></tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            <section>
              <h3 style={heading}>The season in numbers</h3>
              <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', margin: 0 }}>
                {[
                  ['Games played', record.played],
                  ['Won, drawn, lost', `${record.won}, ${record.drawn}, ${record.lost}`],
                  ['Goals for, against', `${record.goalsFor}, ${record.goalsAgainst}`],
                  ...(heldEvents !== null ? [['Events held', heldEvents] as [string, number]] : []),
                ].map(([label, value]) => (
                  <div key={String(label)} style={{ border: rule, borderRadius: 8, padding: '0.6rem 0.75rem' }}>
                    <dt style={{ color: muted, fontSize: '0.75rem' }}>{label}</dt>
                    <dd style={{ margin: 0, fontWeight: 800, fontSize: '1.1rem' }}>{value}</dd>
                  </div>
                ))}
              </dl>
              <p style={small}>Results are club games, not tournaments or internal matches, in teams that show their scores publicly.</p>
            </section>

            {seesPeople && (
              <section>
                <h3 style={heading}>Members, as at {formatDate(new Date().toISOString())}</h3>
                <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', margin: '0 0 0.75rem' }}>
                  {[
                    ['Members', people.counted],
                    ['Players', people.players],
                    ['Others', people.others],
                    ...(seasonRange ? [['Joined this season', people.added] as [string, number]] : []),
                  ].map(([label, value]) => (
                    <div key={String(label)} style={{ border: rule, borderRadius: 8, padding: '0.6rem 0.75rem' }}>
                      <dt style={{ color: muted, fontSize: '0.75rem' }}>{label}</dt>
                      <dd style={{ margin: 0, fontWeight: 800, fontSize: '1.1rem' }}>{value}</dd>
                    </div>
                  ))}
                </dl>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th scope="col" style={th}>Membership type</th><th scope="col" style={thNum}>Members</th></tr></thead>
                  <tbody>{membersByTier(counted).map(t => <tr key={t.tier}><td style={cell}>{t.tier}</td><td style={num}>{t.count}</td></tr>)}</tbody>
                </table>
              </section>
            )}

            <section>
              <h3 style={heading}>Notes</h3>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', color: '#334155', fontSize: '0.84rem' }}>
                <li>Prepared from the club&apos;s records in itsfootball.club. These figures have not been audited.</li>
                <li>Income is money received, counted in the season it was paid. Refunds are left out{money.refundedCents > 0 ? ` (${fmt(money.refundedCents)} this season)` : ''}. Money owed isn&apos;t counted as income until it&apos;s paid.</li>
                {money.anyCard && <li>Card payments are shown at the full amount charged. Stripe&apos;s processing fees come out before the money reaches the club&apos;s bank, and aren&apos;t included unless they were recorded as an expense.</li>}
                {ledger.settings?.gst_registered && <li>Amounts include GST where it was charged.</li>}
                {money.unfiledCents > 0 && <li>{fmt(money.unfiledCents)} of records aren&apos;t filed under any season, so they aren&apos;t in these totals.</li>}
              </ul>
            </section>

            <section style={{ marginTop: '2.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '2rem' }}>
              {['Treasurer', 'President'].map(role => (
                <div key={role} style={{ borderTop: `1px solid ${ink}`, paddingTop: '0.35rem', marginTop: '1.5rem', fontSize: '0.84rem' }}>{role}: name, signature and date</div>
              ))}
            </section>
          </article>
          <p className="text-meta" style={{ textAlign: 'center', marginTop: '1rem' }}>
            <Download size={13} aria-hidden="true" style={{ verticalAlign: 'text-bottom' }} /> Need every transaction for the auditor? Use Export CSV on the <Link href={`/${club.slug}/admin/finance`}>Finance page</Link>.
          </p>
        </>
      )}
    </div>
  );
}
