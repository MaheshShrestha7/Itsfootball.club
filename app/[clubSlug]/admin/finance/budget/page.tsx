'use client';

import React, { use, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, CheckCircle2, Download, Save, Upload } from 'lucide-react';
import { BudgetMeter, BudgetPie, CHART_STYLES, PaceChart } from '@/components/admin/BudgetCharts';
import { confirmAction } from '@/components/ConfirmDialog';
import { agmMoney, seasonOptions, type AgmExpense, type AgmPayment } from '@/lib/agm-report';
import { budgetCsv, budgetKey, budgetLines, budgetTotals, CATEGORIES, paceSeries, parseBudgetCsv, pieSlices, siteDay, varianceWord, type BudgetKind, type BudgetLine } from '@/lib/budget';
import { useClub } from '@/lib/club-context';
import { formatMoney, parseMoneyToCents, paymentSeason, expenseSeason } from '@/lib/finance';
import { siteToday } from '@/lib/member-prices';
import { fetchPaged } from '@/lib/paged';
import { getSupabaseClient } from '@/lib/supabase/client';

// Budget vs actuals for a season. Only the plan is stored (migration 20261155): actuals are worked out
// from the same ledger and rules as Finance and the AGM report, so all three agree. As with the AGM
// report, a failed read shows an error rather than figures that look real and aren't.

type Row = { season: string; kind: BudgetKind; category: string; amount_cents: number };
type Payment = AgmPayment & { paid_at?: string | null; created_at?: string | null };
type Expense = AgmExpense;

const MAX_ROWS = 100000;
const MAX_FILE_BYTES = 1024 * 1024;

export default function BudgetPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const { clubs, selectClubBySlug, seasons, getActiveSeason } = useClub();
  const club = selectClubBySlug(clubSlug) || clubs[0];
  const [ledger, setLedger] = useState<{ payments: Payment[]; expenses: Expense[]; currency: string } | null>(null);
  const [saved, setSaved] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notReady, setNotReady] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  // What's in the boxes, by budgetKey. An entry only exists once it's been edited or imported.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string; list?: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const db = getSupabaseClient();

  useEffect(() => {
    if (!db) return setError('The club\'s records can\'t be reached right now.');
    let stopped = false;
    (async () => {
      const [payments, expenses, budgets, settings] = await Promise.all([
        fetchPaged<Payment>((from, to) => db.from('payments').select('*').eq('club_id', club.id).order('id').range(from, to), MAX_ROWS),
        fetchPaged<Expense>((from, to) => db.from('expenses').select('*').eq('club_id', club.id).order('id').range(from, to), MAX_ROWS),
        db.from('budgets').select('season, kind, category, amount_cents').eq('club_id', club.id),
        db.from('club_payment_settings').select('currency').eq('club_id', club.id).maybeSingle(),
      ]);
      if (stopped) return;
      const failed = payments.error || expenses.error;
      if (failed) return setError(`The budget couldn't be worked out, because some of the club's records couldn't be read (${failed}). Please try again.`);
      if (budgets.error) {
        if (/budgets|schema cache|does not exist/i.test(budgets.error.message)) setNotReady(true);
        else return setError(`Your budget couldn't be read (${budgets.error.message}). Please try again.`);
      }
      setSaved((budgets.data || []).map(b => ({ ...b, amount_cents: Number(b.amount_cents) })) as Row[]);
      setLedger({ payments: payments.data, expenses: expenses.data, currency: settings.data?.currency || 'AUD' });
    })().catch(() => { if (!stopped) setError('The budget couldn\'t be worked out. Check your connection and try again.'); });
    return () => { stopped = true; };
  }, [db, club.id]);

  const clubSeasons = useMemo(() => seasons.filter(s => s.club_id === club.id), [seasons, club.id]);
  const payments = useMemo(() => (ledger?.payments || []).map(p => ({ ...p, season: paymentSeason({ ...p, paid_at: p.paid_at ?? null }, clubSeasons) })), [ledger, clubSeasons]);
  const expenses = useMemo(() => (ledger?.expenses || []).map(e => ({ ...e, season: expenseSeason(e, clubSeasons) })), [ledger, clubSeasons]);
  const options = useMemo(() => seasonOptions(clubSeasons, [...payments, ...expenses, ...(saved || [])]), [clubSeasons, payments, expenses, saved]);
  const active = getActiveSeason(club.id)?.name?.trim();
  const season = picked ?? (options.some(o => o.name === active) ? active! : options[0]?.name ?? '');
  const seasonIndex = options.findIndex(o => o.name === season);
  const info = options[seasonIndex];
  const previous = options[seasonIndex + 1]?.name ?? null;

  const money = useMemo(() => (ledger && season ? agmMoney(payments, expenses, season, previous) : null), [ledger, payments, expenses, season, previous]);
  const currency = ledger?.currency || 'AUD';
  const fmt = (cents: number) => formatMoney(cents, currency);

  const savedAmounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const b of saved || []) if (b.season === season) out[budgetKey(b.kind, b.category)] = b.amount_cents;
    return out;
  }, [saved, season]);
  // The plan as it stands on screen: saved figures with any edits on top
  const amounts = useMemo(() => {
    const out = { ...savedAmounts };
    for (const [k, v] of Object.entries(drafts)) out[k] = v.trim() === '' ? 0 : parseMoneyToCents(v) ?? out[k] ?? 0;
    return out;
  }, [savedAmounts, drafts]);
  const badBoxes = Object.entries(drafts).filter(([, v]) => v.trim() !== '' && parseMoneyToCents(v) === null).map(([k]) => k);
  const changed = Object.keys(drafts).filter(k => (amounts[k] || 0) !== (savedAmounts[k] || 0));
  const dirty = changed.length > 0;

  const actualsFor = (kind: BudgetKind) => (money ? (kind === 'income' ? money.income : money.expenses).filter(l => l.cents !== 0).map(l => ({ key: l.key, cents: l.cents })) : []);
  const incomeLines = budgetLines('income', amounts, actualsFor('income'));
  const expenseLines = budgetLines('expense', amounts, actualsFor('expense'));
  const incomeTotal = budgetTotals(incomeLines);
  const expenseTotal = budgetTotals(expenseLines);

  const dated = !!(info?.start_date && info?.end_date);
  const today = siteToday();
  const incomePace = useMemo(() => (dated ? paceSeries(
    payments.filter(p => p.status === 'paid' && p.season === season).map(p => ({ day: siteDay(p.paid_at || p.created_at || new Date().toISOString()), cents: p.amount_cents })),
    incomeTotal.budget, info!.start_date!, info!.end_date!, today
  ) : []), [dated, payments, season, incomeTotal.budget, info, today]);
  const expensePace = useMemo(() => (dated ? paceSeries(
    expenses.filter(e => e.season === season).map(e => ({ day: e.spent_on || info!.start_date!, cents: e.amount_cents })),
    expenseTotal.budget, info!.start_date!, info!.end_date!, today
  ) : []), [dated, expenses, season, expenseTotal.budget, info, today]);

  const switchSeason = async (next: string) => {
    if (dirty && !(await confirmAction({ title: 'Leave without saving?', message: 'Your changes to this budget haven\'t been saved.', confirmLabel: 'Leave without saving', danger: true }))) return;
    setDrafts({});
    setNotice(null);
    setPicked(next);
  };

  const setBox = (key: string, value: string) => {
    setNotice(null);
    setDrafts(d => ({ ...d, [key]: value }));
  };

  const save = async () => {
    if (!db) return;
    if (badBoxes.length) return setNotice({ ok: false, text: 'Check the amounts marked in red, e.g. 1500 or 1500.50.' });
    setBusy(true);
    setNotice(null);
    const rows = changed.map(k => {
      const [kind, category] = k.split(':') as [BudgetKind, string];
      return { club_id: club.id, season, kind, category, amount_cents: amounts[k] || 0, updated_at: new Date().toISOString() };
    });
    const keep = rows.filter(r => r.amount_cents > 0);
    const remove = rows.filter(r => r.amount_cents === 0);
    const up = keep.length ? await db.from('budgets').upsert(keep, { onConflict: 'club_id,season,kind,category' }).select('kind, category') : { data: [], error: null };
    let failed = up.error?.message || (keep.length && up.data?.length !== keep.length ? 'you don\'t have permission to change the budget' : null);
    for (const r of failed ? [] : remove) {
      const { error: delError } = await db.from('budgets').delete().eq('club_id', club.id).eq('season', season).eq('kind', r.kind).eq('category', r.category);
      if (delError) { failed = delError.message; break; }
    }
    setBusy(false);
    if (failed) return setNotice({ ok: false, text: `The budget wasn't saved: ${failed}.` });
    setSaved(list => [
      ...(list || []).filter(b => !(b.season === season && changed.includes(budgetKey(b.kind, b.category)))),
      ...keep.map(r => ({ season, kind: r.kind, category: r.category, amount_cents: r.amount_cents })),
    ]);
    setDrafts({});
    setNotice({ ok: true, text: 'Budget saved.' });
  };

  const startFrom = async (source: 'budget' | 'actuals') => {
    if (!previous || !ledger) return;
    if (dirty && !(await confirmAction({ title: 'Replace your unsaved changes?', message: 'This fills in the budget from last season, on top of what you\'ve typed.', confirmLabel: 'Fill it in' }))) return;
    const next: Record<string, string> = {};
    if (source === 'budget') {
      for (const b of saved || []) if (b.season === previous) next[budgetKey(b.kind, b.category)] = (b.amount_cents / 100).toFixed(2);
    } else {
      const last = agmMoney(payments, ledger.expenses, previous, null);
      for (const l of last.income) if (l.cents > 0) next[budgetKey('income', l.key)] = (l.cents / 100).toFixed(2);
      for (const l of last.expenses) if (l.cents > 0) next[budgetKey('expense', l.key)] = (l.cents / 100).toFixed(2);
    }
    if (!Object.keys(next).length) return setNotice({ ok: false, text: source === 'budget' ? `${previous} has no budget to copy.` : `${previous} has no income or expenses to copy.` });
    setDrafts(next);
    setNotice({ ok: true, text: `Filled in from ${previous}. Check the figures, then tap Save budget.` });
  };

  const exportCsv = () => {
    const csv = budgetCsv(season, amounts, { income: actualsFor('income'), expense: actualsFor('expense') });
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${club.slug}-budget-${season.replace(/[^\w-]+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importFile = async (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) return setNotice({ ok: false, text: 'That file is too big for a budget. It should be a small CSV.' });
    if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') return setNotice({ ok: false, text: 'Please choose a CSV file. In Excel or Google Sheets, use Save as or Download as CSV.' });
    const result = parseBudgetCsv(await file.text());
    const read = Object.entries(result.amounts);
    if (!read.length) return setNotice({ ok: false, text: 'Nothing was imported.', list: result.problems });
    // Only what differs from the plan on screen: the export lists every category, mostly at zero
    const differing = read.filter(([k, cents]) => cents !== (amounts[k] || 0));
    setDrafts(d => ({ ...d, ...Object.fromEntries(differing.map(([k, cents]) => [k, (cents / 100).toFixed(2)])) }));
    const count = differing.length;
    setNotice({
      ok: result.problems.length === 0,
      text: `${count ? `${count} ${count === 1 ? 'line' : 'lines'} changed in ${season}. Nothing is saved yet: check the figures, then tap Save budget.` : `The file matches the ${season} budget, so nothing changed.`}${result.problems.length ? ' These rows weren\'t used:' : ''}`,
      list: result.problems,
    });
  };

  const table = (kind: BudgetKind, title: string, calculated: BudgetLine[], totals: ReturnType<typeof budgetTotals>) => {
    // Anything being edited stays on screen even at zero, and rows are ordered by the saved budget, so
    // they don't vanish or jump about while someone types
    const editing = Object.keys(drafts).filter(k => k.startsWith(`${kind}:`)).map(k => k.split(':')[1]).filter(c => !calculated.some(l => l.category === c));
    const steady = (l: BudgetLine) => Math.max(savedAmounts[budgetKey(kind, l.category)] || 0, l.actual);
    const lines: BudgetLine[] = [
      ...calculated,
      ...editing.map(category => ({ kind, category, label: CATEGORIES[kind][category] || category, budget: 0, actual: 0, percent: null, variance: 0 })),
    ].sort((a, b) => steady(b) - steady(a) || a.label.localeCompare(b.label));
    const listed = new Set(lines.map(l => l.category));
    const others = Object.entries(CATEGORIES[kind]).filter(([k]) => !listed.has(k));
    const statusText = (l: BudgetLine) => (l.budget === 0
      ? (l.actual !== 0 ? 'Not budgeted' : '')
      : `${varianceWord(kind, l.variance)}${l.variance !== 0 ? ` by ${fmt(Math.abs(l.variance))}` : ''}`);
    return (
      <section className="admin-panel" aria-label={title}>
        <div className="admin-panel-head"><h2>{title}</h2><span className="admin-meta">{totals.percent === null ? 'No budget set' : `${totals.percent}% of budget`}</span></div>
        <div className="admin-table-wrap">
          <table className="admin-table budget-table">
            <thead><tr><th scope="col">Category</th><th scope="col" className="is-num">Budget</th><th scope="col" className="is-num">Actual</th><th scope="col">How it&apos;s going</th></tr></thead>
            <tbody>
              {lines.map(l => {
                const key = budgetKey(kind, l.category);
                const bad = badBoxes.includes(key);
                const over = kind === 'expense' && l.variance < 0;
                return (
                  <tr key={key}>
                    <td className="is-strong">{l.label}</td>
                    <td className="is-num" data-label="Budget">
                      <input className="form-input" inputMode="decimal" aria-label={`${title}: ${l.label} budget`} aria-invalid={bad}
                        style={{ width: '7.5rem', textAlign: 'right', marginLeft: 'auto', ...(bad ? { borderColor: 'var(--c-red)' } : {}) }}
                        value={drafts[key] ?? (l.budget ? (l.budget / 100).toFixed(2) : '')} placeholder="0.00" onChange={e => setBox(key, e.target.value)} />
                    </td>
                    <td className="is-num is-strong" data-label="Actual">{fmt(l.actual)}</td>
                    <td style={{ minWidth: 170 }}>
                      <span style={over ? { color: 'var(--c-red)', fontWeight: 700 } : undefined}>{statusText(l)}</span>
                      {l.percent !== null && <span className="text-meta"> ({l.percent}%)</span>}
                      <BudgetMeter percent={l.percent} over={over} label={`${l.label}: ${l.percent}% of budget`} />
                    </td>
                  </tr>
                );
              })}
              {lines.length === 0 && <tr><td colSpan={4}>No budget or actual {kind === 'income' ? 'income' : 'spending'} yet.</td></tr>}
              <tr>
                <td className="is-strong">Total</td>
                <td className="is-num is-strong" data-label="Budget">{fmt(totals.budget)}</td>
                <td className="is-num is-strong" data-label="Actual">{fmt(totals.actual)}</td>
                <td className="is-strong">{totals.budget === 0 && totals.actual === 0 ? '' : varianceWord(kind, kind === 'income' ? totals.actual - totals.budget : totals.budget - totals.actual)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        {others.length > 0 && (
          <div className="admin-section">
            <label className="form-label" htmlFor={`add-${kind}`}>Add a category</label>
            <select id={`add-${kind}`} className="form-select" style={{ width: 'auto', maxWidth: '100%', alignSelf: 'flex-start' }} value=""
              onChange={e => { if (e.target.value) setBox(budgetKey(kind, e.target.value), '0.00'); }}>
              <option value="">Choose…</option>
              {others.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </div>
        )}
      </section>
    );
  };

  const net = incomeTotal.actual - expenseTotal.actual;
  const netPlan = incomeTotal.budget - expenseTotal.budget;

  return (
    <div>
      <style>{CHART_STYLES}</style>
      <div className="admin-head">
        <div>
          <Link href={`/${club.slug}/admin/finance`} className="text-meta" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.35rem' }}>
            <ArrowLeft size={14} aria-hidden="true" /> Finance
          </Link>
          <h1>Budget vs actuals</h1>
          <p>Set a budget for the season and see how the club is tracking against it.</p>
        </div>
        {options.length > 0 && (
          <div className="admin-head-actions">
            <label className="form-label m-0" htmlFor="budget-season">Season</label>
            <select data-view-ok id="budget-season" className="form-select" style={{ width: 'auto' }} value={season} onChange={e => void switchSeason(e.target.value)}>
              {options.map(o => <option key={o.name} value={o.name}>{o.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {error ? (
        <div role="alert" className="admin-flash is-error"><AlertCircle size={16} aria-hidden="true" /><span>{error}</span></div>
      ) : !ledger ? (
        <p className="text-note" role="status">Adding up the club&apos;s records…</p>
      ) : notReady ? (
        <div role="alert" className="admin-flash is-error"><AlertCircle size={16} aria-hidden="true" /><span>Budgets need the latest database update (migration 20261155) first.</span></div>
      ) : !money ? (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <p className="text-body" style={{ margin: 0 }}>Add a season first, under Seasons, and you can set a budget for it.</p>
        </div>
      ) : (
        <div className="stack">
          <div className="admin-toolbar" style={{ marginBottom: 0, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" disabled={busy || !dirty} onClick={save}><Save size={16} aria-hidden="true" /> {busy ? 'Saving…' : dirty ? 'Save budget' : 'Saved'}</button>
            <button data-view-ok type="button" className="btn btn-secondary" onClick={exportCsv}><Download size={16} aria-hidden="true" /> Export CSV</button>
            <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()}><Upload size={16} aria-hidden="true" /> Import CSV</button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" aria-label="Import a budget from a CSV file" style={{ display: 'none' }} onChange={e => void importFile(e.target.files?.[0])} />
            {previous && <button type="button" className="btn btn-secondary" onClick={() => void startFrom('budget')}>Copy {previous} budget</button>}
            {previous && <button type="button" className="btn btn-secondary" onClick={() => void startFrom('actuals')}>Start from {previous} actuals</button>}
          </div>

          {notice && (
            <div role={notice.ok ? 'status' : 'alert'} className={notice.ok ? 'admin-flash' : 'admin-flash is-error'} style={{ alignItems: 'flex-start' }}>
              {notice.ok ? <CheckCircle2 size={16} aria-hidden="true" /> : <AlertCircle size={16} aria-hidden="true" />}
              <div>
                <span>{notice.text}</span>
                {!!notice.list?.length && <ul style={{ margin: '0.35rem 0 0', paddingLeft: '1.1rem' }}>{notice.list.slice(0, 12).map(p => <li key={p}>{p}</li>)}{notice.list.length > 12 && <li>and {notice.list.length - 12} more</li>}</ul>}
              </div>
            </div>
          )}

          <section className="admin-panel admin-dash-figures-wrap budget-figures" aria-label="Season totals">
            <dl className="admin-dash-figures">
              <div><dt>Income</dt><dd>{fmt(incomeTotal.actual)}</dd><span className="admin-note">of {fmt(incomeTotal.budget)} budget</span></div>
              <div><dt>Spending</dt><dd>{fmt(expenseTotal.actual)}</dd><span className="admin-note">of {fmt(expenseTotal.budget)} budget</span></div>
              <div><dt>Net so far</dt><dd className={net < 0 ? 'is-live' : undefined}>{net < 0 ? `-${fmt(-net)}` : fmt(net)}</dd><span className="admin-note">Budgeted {netPlan < 0 ? `-${fmt(-netPlan)}` : fmt(netPlan)}</span></div>
            </dl>
          </section>

          {dated ? (
            <div className="admin-two">
              <section className="admin-panel"><div className="admin-section"><PaceChart title="Income through the season" points={incomePace} money={fmt} actualName="Income so far" /></div></section>
              <section className="admin-panel"><div className="admin-section"><PaceChart title="Spending through the season" points={expensePace} money={fmt} actualName="Spending so far" /></div></section>
            </div>
          ) : <p className="text-meta" style={{ margin: 0 }}>Season {season} has no start and end dates, so the charts over time aren&apos;t shown. Add them under Seasons.</p>}

          <div className="admin-two">
            <section className="admin-panel"><div className="admin-section"><BudgetPie title="Where the money came from" slices={pieSlices(incomeLines)} money={fmt} /></div></section>
            <section className="admin-panel"><div className="admin-section"><BudgetPie title="Where the money went" slices={pieSlices(expenseLines)} money={fmt} /></div></section>
          </div>

          {table('income', 'Income', incomeLines, incomeTotal)}
          {table('expense', 'Spending', expenseLines, expenseTotal)}
          <p className="admin-table-foot">Actuals come from Finance: income in the season it was paid, spending in the season it was spent. To import, use the same columns as the export: Type, Category and Budget.</p>
        </div>
      )}
    </div>
  );
}
