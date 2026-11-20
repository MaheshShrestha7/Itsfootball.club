'use client';

import React, { use, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, CheckCircle2, ChevronDown, ChevronRight, Copy, Download, Save, Sheet, Undo2, Upload } from 'lucide-react';
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
const toCents = (v: string) => parseMoneyToCents(v.replace(/\$/g, ''));
// What goes in a box: whole dollars unless there are cents, with thousands commas (parseMoneyToCents takes them back)
const boxValue = (cents: number) => (cents / 100).toLocaleString('en-AU', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 });

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
  const [tab, setTab] = useState<'track' | 'plan' | null>(null);
  // Set once someone picks "Start blank" on a season with no budget, so the empty sheet shows
  const [started, setStarted] = useState(false);
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
  // Whole dollars where there are no cents, for the budget sheet's many small figures
  const short = (cents: number) => fmt(cents).replace(/\.00$/, '');

  const savedAmounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const b of saved || []) if (b.season === season) out[budgetKey(b.kind, b.category)] = b.amount_cents;
    return out;
  }, [saved, season]);
  // The plan as it stands on screen: saved figures with any edits on top
  const amounts = useMemo(() => {
    const out = { ...savedAmounts };
    for (const [k, v] of Object.entries(drafts)) out[k] = v.trim() === '' ? 0 : toCents(v) ?? out[k] ?? 0;
    return out;
  }, [savedAmounts, drafts]);
  const badBoxes = Object.entries(drafts).filter(([, v]) => v.trim() !== '' && toCents(v) === null).map(([k]) => k);
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
    setStarted(false);
    setTab(null);
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
      for (const b of saved || []) if (b.season === previous) next[budgetKey(b.kind, b.category)] = boxValue(b.amount_cents);
    } else {
      const last = agmMoney(payments, ledger.expenses, previous, null);
      for (const l of last.income) if (l.cents > 0) next[budgetKey('income', l.key)] = boxValue(l.cents);
      for (const l of last.expenses) if (l.cents > 0) next[budgetKey('expense', l.key)] = boxValue(l.cents);
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
    setDrafts(d => ({ ...d, ...Object.fromEntries(differing.map(([k, cents]) => [k, boxValue(cents)])) }));
    const count = differing.length;
    setNotice({
      ok: result.problems.length === 0,
      text: `${count ? `${count} ${count === 1 ? 'line' : 'lines'} changed in ${season}. Nothing is saved yet: check the figures, then tap Save budget.` : `The file matches the ${season} budget, so nothing changed.`}${result.problems.length ? ' These rows weren\'t used:' : ''}`,
      list: result.problems,
    });
  };

  const undo = () => {
    setDrafts({});
    setNotice(null);
  };

  // Last season, per category, to type against: its budget and what actually came in or went out
  const lastBudget = useMemo(() => {
    const out: Record<string, number> = {};
    for (const b of saved || []) if (previous && b.season === previous) out[budgetKey(b.kind, b.category)] = b.amount_cents;
    return out;
  }, [saved, previous]);
  const lastActual = useMemo(() => {
    const out: Record<string, number> = {};
    for (const l of money?.income || []) out[budgetKey('income', l.key)] = l.previousCents;
    for (const l of money?.expenses || []) out[budgetKey('expense', l.key)] = l.previousCents;
    return out;
  }, [money]);
  const lastTotals = (kind: BudgetKind, from: Record<string, number>) => Object.entries(from).filter(([k]) => k.startsWith(`${kind}:`)).reduce((n, [, c]) => n + c, 0);
  const lastBudgetTotal = { income: lastTotals('income', lastBudget), expense: lastTotals('expense', lastBudget) };

  const hasBudget = Object.values(savedAmounts).some(c => c > 0);
  const view = tab ?? (hasBudget ? 'track' : 'plan');
  const choosing = view === 'plan' && !hasBudget && !dirty && !started && !Object.keys(drafts).length;

  // Enter moves to the next box, so a whole budget can be typed without the mouse
  const nextBox = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const boxes = [...document.querySelectorAll<HTMLInputElement>('input[data-budget-box]')].filter(b => b.offsetParent);
    boxes[boxes.indexOf(e.currentTarget) + 1]?.focus();
  };
  const closeMenu = (e: React.MouseEvent) => e.currentTarget.closest('details')?.removeAttribute('open');

  const sheet = (kind: BudgetKind, title: string, total: number) => {
    const actual = new Map(actualsFor(kind).map(a => [a.key, a.cents]));
    const keys = [...new Set([...Object.keys(CATEGORIES[kind]), ...actual.keys(), ...Object.keys(lastActual).filter(k => k.startsWith(`${kind}:`)).map(k => k.split(':')[1])])];
    // Ordered by figures that don't change while typing, so rows don't jump about
    const weight = (c: string) => { const k = budgetKey(kind, c); return Math.max(savedAmounts[k] || 0, lastBudget[k] || 0, lastActual[k] || 0, actual.get(c) || 0); };
    const rows = keys.map(category => ({ category, label: CATEGORIES[kind][category] || category, weight: weight(category) }))
      .sort((a, b) => b.weight - a.weight || a.label.localeCompare(b.label));
    const shown = rows.filter(r => r.weight > 0 || drafts[budgetKey(kind, r.category)] !== undefined);
    const more = rows.filter(r => !shown.includes(r));
    const word = kind === 'income' ? 'came in' : 'spent';
    const row = ({ category, label }: { category: string; label: string }) => {
      const key = budgetKey(kind, category);
      const id = `budget-${kind}-${category}`;
      const bad = badBoxes.includes(key);
      const now = amounts[key] || 0;
      const was = savedAmounts[key] || 0;
      const isChanged = bad || (drafts[key] !== undefined && now !== was);
      const lb = lastBudget[key] || 0;
      const la = lastActual[key] || 0;
      const suggestion = la || lb;
      return (
        <div key={key} className={`budget-row${isChanged ? ' is-changed' : ''}${bad ? ' is-bad' : ''}`}>
          <label htmlFor={id}>{label}</label>
          <div className="budget-money">
            <span aria-hidden="true">$</span>
            <input id={id} data-budget-box className="form-input" inputMode="decimal" autoComplete="off" placeholder="0" aria-invalid={bad}
              aria-describedby={`${id}-hint${bad ? ` ${id}-err` : ''}`}
              value={drafts[key] ?? (was ? boxValue(was) : '')} onChange={e => setBox(key, e.target.value)} onKeyDown={nextBox} />
          </div>
          <div className="budget-hint" id={`${id}-hint`}>
            {previous && <span>{lb || la ? `${previous}: ${lb ? `${short(lb)} budget` : 'not budgeted'}, ${short(la)} ${word}` : `Nothing in ${previous}`}</span>}
            {!!actual.get(category) && <span>{`This season so far: ${short(actual.get(category)!)}`}</span>}
            {!bad && now === 0 && suggestion > 0 && <button type="button" className="budget-use" onClick={() => setBox(key, boxValue(suggestion))} aria-label={`Use ${short(suggestion)} for ${label}`}>Use {short(suggestion)}</button>}
            {isChanged && was > 0 && <span className="budget-was">Was {short(was)}</span>}
          </div>
          {bad && <p className="budget-err" id={`${id}-err`}>That isn&apos;t an amount. Type it like 1500 or 1500.50.</p>}
        </div>
      );
    };
    return (
      <section className="admin-panel budget-sheet" aria-labelledby={`budget-${kind}-h`}>
        <div className="budget-sheet-head"><h2 id={`budget-${kind}-h`}>{title}</h2><span className="budget-sheet-total">{short(total)}</span></div>
        <div className="budget-cols" aria-hidden="true"><span>{previous ? `Category, and ${previous} to compare` : 'Category'}</span><span>{season} budget</span></div>
        {shown.map(row)}
        {more.length > 0 && (
          <details className="budget-more" open={shown.length === 0}>
            <summary><ChevronRight size={16} aria-hidden="true" /> {more.length} more {kind === 'income' ? 'income' : 'spending'} {more.length === 1 ? 'category' : 'categories'}</summary>
            {more.map(row)}
          </details>
        )}
      </section>
    );
  };

  const table = (kind: BudgetKind, title: string, lines: BudgetLine[], totals: ReturnType<typeof budgetTotals>) => {
    const statusText = (l: BudgetLine) => (l.budget === 0
      ? (l.actual !== 0 ? 'Not budgeted' : '')
      : `${varianceWord(kind, l.variance)}${l.variance !== 0 ? ` by ${fmt(Math.abs(l.variance))}` : ''}`);
    return (
      <section className="admin-panel" aria-label={title}>
        <div className="admin-panel-head">
          <h2>{title}</h2>
          <span className="admin-meta">{totals.percent === null ? 'No budget set' : `${totals.percent}% of budget`}</span>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table budget-table">
            <thead><tr><th scope="col">Category</th><th scope="col" className="is-num">Budget</th><th scope="col" className="is-num">Actual</th><th scope="col">How it&apos;s going</th></tr></thead>
            <tbody>
              {lines.map(l => {
                const over = kind === 'expense' && l.variance < 0;
                return (
                  <tr key={l.category}>
                    <td className="is-strong">{l.label}</td>
                    <td className="is-num" data-label="Budget">{l.budget ? fmt(l.budget) : '-'}</td>
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
      </section>
    );
  };

  const net = incomeTotal.actual - expenseTotal.actual;
  const netPlan = incomeTotal.budget - expenseTotal.budget;
  const signed = (cents: number) => (cents < 0 ? `-${fmt(-cents)}` : fmt(cents));
  const changeCount = new Set([...changed, ...badBoxes]).size;
  const fileInput = <input ref={fileRef} type="file" accept=".csv,text/csv" aria-label="Import a budget from a CSV file" style={{ display: 'none' }} onChange={e => void importFile(e.target.files?.[0])} />;

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
        <>
          <div role="tablist" aria-label="Budget" className="admin-tabs">
            <button data-view-ok type="button" role="tab" aria-selected={view === 'track'} className="admin-tab" onClick={() => setTab('track')}>How it&apos;s going</button>
            <button data-view-ok type="button" role="tab" aria-selected={view === 'plan'} className="admin-tab" onClick={() => setTab('plan')}>Set the budget</button>
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
          {fileInput}

          {view === 'track' ? (
            <div className="stack">
              <section className="admin-panel admin-dash-figures-wrap budget-figures" aria-label="Season totals">
                <dl className="admin-dash-figures">
                  <div><dt>Income</dt><dd>{fmt(incomeTotal.actual)}</dd><span className="admin-note">of {fmt(incomeTotal.budget)} budget</span></div>
                  <div><dt>Spending</dt><dd>{fmt(expenseTotal.actual)}</dd><span className="admin-note">of {fmt(expenseTotal.budget)} budget</span></div>
                  <div><dt>Net so far</dt><dd className={net < 0 ? 'is-live' : undefined}>{signed(net)}</dd><span className="admin-note">Budgeted {signed(netPlan)}</span></div>
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
              <div className="admin-toolbar" style={{ marginBottom: 0 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setTab('plan')}>Change the budget</button>
                <button data-view-ok type="button" className="btn btn-secondary" onClick={exportCsv}><Download size={16} aria-hidden="true" /> Export CSV</button>
              </div>
              <p className="admin-table-foot" style={{ margin: 0 }}>Actuals come from Finance: income in the season it was paid, spending in the season it was spent.</p>
            </div>
          ) : choosing ? (
            <section className="admin-panel" aria-labelledby="budget-start-h">
              <div className="admin-section budget-start" style={{ paddingTop: 'var(--space-md)' }}>
                <h2 id="budget-start-h">No budget for {season} yet</h2>
                <p>Pick a starting point. Nothing is saved until you tap Save budget, so you can change every figure first.</p>
                <div className="budget-ways">
                  {previous && lastBudgetTotal.income + lastBudgetTotal.expense > 0 && (
                    <div className="budget-way"><div><b>Copy the {previous} budget</b><span>{short(lastBudgetTotal.income)} income, {short(lastBudgetTotal.expense)} spending</span></div>
                      <button type="button" className="btn btn-primary" onClick={() => void startFrom('budget')}>Copy {previous} budget</button></div>
                  )}
                  {previous && money.previousIncome + money.previousExpenses > 0 && (
                    <div className="budget-way"><div><b>Start from what happened in {previous}</b><span>{short(money.previousIncome)} came in, {short(money.previousExpenses)} went out</span></div>
                      <button type="button" className="btn btn-secondary" onClick={() => void startFrom('actuals')}>Use {previous} actuals</button></div>
                  )}
                  <div className="budget-way"><div><b>Import a spreadsheet</b><span>A CSV with Type, Category and Budget columns, like the export</span></div>
                    <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()}><Upload size={16} aria-hidden="true" /> Import CSV</button></div>
                  <div className="budget-way"><div><b>Start blank</b><span>{previous ? `Type each figure yourself, with ${previous} shown beside every box` : 'Type each figure yourself'}</span></div>
                    <button type="button" className="btn btn-secondary" onClick={() => setStarted(true)}>Start blank</button></div>
                </div>
              </div>
            </section>
          ) : (
            <div className="stack">
              <div className="budget-tools">
                <p>Type whole dollars, like 1500. Enter moves to the next box.</p>
                <div className="budget-tools-end">
                  {previous && (
                    <details className="budget-menu">
                      <summary className="btn btn-secondary btn-sm"><Copy size={16} aria-hidden="true" /> Fill from {previous} <ChevronDown size={16} aria-hidden="true" /></summary>
                      <div className="budget-menu-list">
                        <button type="button" onClick={e => { closeMenu(e); void startFrom('budget'); }}>Copy the {previous} budget<small>{short(lastBudgetTotal.income)} income, {short(lastBudgetTotal.expense)} spending</small></button>
                        <button type="button" onClick={e => { closeMenu(e); void startFrom('actuals'); }}>Use what happened in {previous}<small>{short(money.previousIncome)} came in, {short(money.previousExpenses)} went out</small></button>
                      </div>
                    </details>
                  )}
                  <details className="budget-menu">
                    <summary className="btn btn-secondary btn-sm"><Sheet size={16} aria-hidden="true" /> Spreadsheet <ChevronDown size={16} aria-hidden="true" /></summary>
                    <div className="budget-menu-list">
                      <button data-view-ok type="button" onClick={e => { closeMenu(e); exportCsv(); }}>Export CSV<small>Every category, budget and actual</small></button>
                      <button type="button" onClick={e => { closeMenu(e); fileRef.current?.click(); }}>Import CSV<small>Same columns as the export: Type, Category and Budget</small></button>
                    </div>
                  </details>
                </div>
              </div>

              <div className="budget-sheets">
                {sheet('income', 'Income', incomeTotal.budget)}
                {sheet('expense', 'Spending', expenseTotal.budget)}
              </div>

              <div role="region" aria-label="Your budget" className={`admin-savebar budget-savebar${badBoxes.length ? ' is-error' : ''}`}>
                <dl className="budget-plan">
                  <div><dt>Income</dt><dd>{short(incomeTotal.budget)}</dd></div>
                  <div><dt>Spending</dt><dd>{short(expenseTotal.budget)}</dd></div>
                  <div><dt>{netPlan < 0 ? 'Planned loss' : 'Planned surplus'}</dt><dd className={netPlan < 0 ? 'is-bad' : 'is-ok'}>{netPlan < 0 ? `-${short(-netPlan)}` : short(netPlan)}</dd></div>
                </dl>
                <div className="budget-save-end">
                  <span className="budget-changes" role="status">
                    {changeCount ? `${changeCount} ${changeCount === 1 ? 'change' : 'changes'}` : 'All saved'}
                    {badBoxes.length > 0 && <b>, {badBoxes.length} to fix</b>}
                  </span>
                  {dirty && <button type="button" className="btn btn-secondary btn-sm" onClick={undo}><Undo2 size={16} aria-hidden="true" /> Undo</button>}
                  <button type="button" className="btn btn-primary" disabled={busy || !changeCount} onClick={save}><Save size={16} aria-hidden="true" /> {busy ? 'Saving…' : 'Save budget'}</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
