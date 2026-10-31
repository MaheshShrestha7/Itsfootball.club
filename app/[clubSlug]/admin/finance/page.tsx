'use client';

import React, { use, useCallback, useEffect, useMemo, useState } from 'react';
import { Download, CheckCircle2, XCircle, FileText, Plus, Trash2, CreditCard, Save, UserCheck } from 'lucide-react';
import Link from 'next/link';
import { useClub } from '@/lib/club-context';
import { useUrlTab } from '@/lib/use-url-tab';
import { clubTeamsOf } from '@/lib/teams';
import { getSupabaseClient, getAccessToken } from '@/lib/supabase/client';
import {
  INCOME_CATEGORIES, EXPENSE_CATEGORIES, PAYMENT_KIND_LABEL, PAYMENT_METHOD_LABEL, CURRENCIES,
  bookingFeeCents, formatMoney, parseMoneyToCents, toCsv, membershipTermEnd, todayIso, MONTH_NAMES,
  MEMBERSHIP_PAYMENT_POLICIES, DEFAULT_MEMBERSHIP_PAYMENT_POLICY,
} from '@/lib/finance';
import type { RenewalMode, MembershipPaymentPolicy } from '@/lib/finance';
import type {
  ClubPaymentSettings, MembershipPlan, Payment, Expense,
} from '@/lib/supabase/types';
import { PUBLIC_PAYMENT_SETTINGS } from '@/lib/supabase/types';
import { cleanAbn, formatAbn } from '@/lib/invoice';
import { askText, confirmAction } from '@/components/ConfirmDialog';
import PriceList from '@/components/admin/PriceList';
import { DATE_LOCALE } from '@/lib/dates';
import { openReceipt } from '@/lib/receipts';

type Tab = 'overview' | 'income' | 'expenses' | 'settings';
const TAB_IDS: Tab[] = ['overview', 'income', 'expenses', 'settings'];
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'income', label: 'Income' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'settings', label: 'Settings' },
];
const STATUS_TONE: Record<string, string> = {
  paid: 'is-ok', awaiting_review: 'is-warn', pending: '', rejected: 'is-danger', refunded: '', failed: 'is-danger',
};
/** "Awaiting review", "Paid", ... */
const statusText = (status: string) => status.replace('_', ' ').replace(/^./, c => c.toUpperCase());
const today = () => new Date().toISOString().slice(0, 10);

export default function FinancePage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const { clubs, selectClubBySlug, members, sponsors } = useClub();
  const club = selectClubBySlug(clubSlug) || clubs[0];
  const db = getSupabaseClient();

  // ?tab= in the URL, so the admin menu's Finance sub-items open a tab
  const [tab, setTab] = useUrlTab(TAB_IDS);
  const [settings, setSettings] = useState<ClubPaymentSettings | null>(null);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [season, setSeason] = useState('all');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const currency = settings?.currency || 'AUD';
  const money = (cents: number) => formatMoney(cents, currency);
  const flash = (type: 'ok' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };


  // ponytail: loads the club's whole ledger; page it by season if a club passes a few thousand rows
  const load = useCallback(async () => {
    if (!db) return;
    const [s, pl, pay, exp] = await Promise.all([
      // The Stripe account id isn't readable here (migration 20261116); stripe_connected says whether there is one.
      // Before that migration stripe_connected doesn't exist yet, so fall back to every column.
      db.from('club_payment_settings').select(`${PUBLIC_PAYMENT_SETTINGS}, stripe_connected`).eq('club_id', club.id).maybeSingle()
        .then(res => (res.error ? db.from('club_payment_settings').select('*').eq('club_id', club.id).maybeSingle() : res)),
      db.from('membership_plans').select('*').eq('club_id', club.id).order('sort_order'),
      db.from('payments').select('*').eq('club_id', club.id).order('created_at', { ascending: false }),
      db.from('expenses').select('*').eq('club_id', club.id).order('spent_on', { ascending: false }),
    ]);
    setSettings(s.data ?? null);
    setPlans(pl.data || []);
    setPayments(pay.data || []);
    setExpenses(exp.data || []);
  }, [db, club.id]);
  useEffect(() => { load(); }, [load]);

  const seasons = useMemo(
    () => Array.from(new Set([...payments, ...expenses].map(r => r.season).filter(Boolean) as string[])).sort().reverse(),
    [payments, expenses]
  );
  const inSeason = <T extends { season?: string | null }>(rows: T[]) => (season === 'all' ? rows : rows.filter(r => r.season === season));
  const seasonPayments = inSeason(payments);
  const seasonExpenses = inSeason(expenses);

  const exportCsv = () => {
    const rows: (string | number | null | undefined)[][] = [
      ['Type', 'Date', 'Season', 'Category', 'Description', 'Party', 'Method', 'Status', 'Amount', 'Currency', 'Reference'],
      ...seasonPayments.map(p => ['Income', (p.paid_at || p.created_at).slice(0, 10), p.season, INCOME_CATEGORIES[p.category] || p.category,
        p.description, p.payer_name, PAYMENT_METHOD_LABEL[p.method], p.status, (p.amount_cents / 100).toFixed(2), p.currency, p.reference]),
      ...seasonExpenses.map(e => ['Expense', e.spent_on, e.season, EXPENSE_CATEGORIES[e.category] || e.category,
        e.description, e.vendor, PAYMENT_METHOD_LABEL[e.method], e.reimbursed ? 'reimbursed' : 'paid', (e.amount_cents / 100).toFixed(2), e.currency, '']),
    ];
    const url = URL.createObjectURL(new Blob(['﻿' + toCsv(rows)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${club.slug}-finance-${season === 'all' ? 'all' : season.replace('/', '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const shared = { club, db, currency, money, load, flash };

  return (
    <div>
      <div className="admin-head">
        <div>
          <h1>Finance</h1>
          <p>Membership and sponsorship payments, other income, expenses and receipts.</p>
        </div>
        <div className="admin-head-actions">
          <label className="form-label m-0" htmlFor="finance-season">Season</label>
          <select data-view-ok id="finance-season" className="form-select" style={{ width: 'auto' }} value={season} onChange={e => setSeason(e.target.value)}>
            <option value="all">All seasons</option>
            {seasons.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button data-view-ok type="button" className="btn btn-secondary" onClick={exportCsv}><Download size={16} aria-hidden="true" /> Export CSV</button>
        </div>
      </div>

      {feedback && (
        <div role="status" className={feedback.type === 'error' ? 'admin-flash is-error' : 'admin-flash'}>
          {feedback.type === 'error' ? <XCircle size={16} aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
          <span>{feedback.text}</span>
        </div>
      )}

      <div role="tablist" aria-label="Finance" className="admin-tabs">
        {TABS.map(t => (
          <button data-view-ok key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className="admin-tab">
            {t.label}
            {t.id === 'income' && payments.some(p => p.status === 'awaiting_review') && (
              <span className="admin-count">
                <span className="sr-only">, </span>{payments.filter(p => p.status === 'awaiting_review').length}<span className="sr-only"> to check</span>
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <Overview {...shared} payments={seasonPayments} expenses={seasonExpenses} members={members.filter(m => m.club_id === club.id)}
          sponsors={sponsors.filter(s => s.club_id === club.id)} onReview={() => setTab('income')} />
      )}
      {tab === 'income' && <IncomeTab {...shared} payments={seasonPayments} plans={plans} members={members.filter(m => m.club_id === club.id)}
        sponsors={sponsors.filter(s => s.club_id === club.id).map(s => ({ id: s.id, name: s.name, package_value: s.package_value }))} />}
      {tab === 'expenses' && <ExpensesTab {...shared} expenses={seasonExpenses} members={members.filter(m => m.club_id === club.id)} />}
      {tab === 'settings' && <SettingsTab {...shared} settings={settings} plans={plans} />}
    </div>
  );
}

type Shared = {
  club: { id: string; slug: string; name: string };
  db: ReturnType<typeof getSupabaseClient>;
  currency: string;
  money: (cents: number) => string;
  load: () => Promise<void>;
  flash: (type: 'ok' | 'error', text: string) => void;
};
type MemberLite = { id: string; full_name: string; membership_status?: string; membership_expires_at?: string };

// ------------------------------------------------------------------------------------------------
function Overview({ money, payments, expenses, members, sponsors, onReview }: Shared & {
  payments: Payment[]; expenses: Expense[]; members: MemberLite[];
  sponsors: { id: string; name: string; package_status?: string; package_value?: number | null }[]; onReview: () => void;
}) {
  const paid = payments.filter(p => p.status === 'paid');
  const income = paid.reduce((n, p) => n + p.amount_cents, 0);
  const spent = expenses.reduce((n, e) => n + e.amount_cents, 0);
  const toReview = payments.filter(p => p.status === 'awaiting_review');
  const owedToMembers = expenses.filter(e => e.paid_by_member_id && !e.reimbursed);

  const byCategory = (rows: { category: string; amount_cents: number }[], labels: Record<string, string>) => {
    const totals = new Map<string, number>();
    rows.forEach(r => totals.set(r.category, (totals.get(r.category) || 0) + r.amount_cents));
    return [...totals].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: labels[k] || k, value: v }));
  };

  const now = Date.now();
  const expiring = members
    .filter(m => m.membership_status === 'approved' && m.membership_expires_at)
    .map(m => ({ ...m, days: Math.ceil((new Date(m.membership_expires_at!).getTime() - now) / 86400000) }))
    .filter(m => m.days <= 30)
    .sort((a, b) => a.days - b.days);
  // Deals with money still to come: not ones paying in kind (no value, SPE-21), and not ones whose
  // bank transfer receipt is already waiting above (SPE-7)
  const receiptFrom = new Set(toReview.filter(p => p.kind === 'sponsorship' && p.sponsor_id).map(p => p.sponsor_id));
  const pledges = sponsors.filter(s => (s.package_status === 'confirmed' || s.package_status === 'prospect')
    && Number(s.package_value) > 0 && !receiptFrom.has(s.id));

  const owedTotal = owedToMembers.reduce((n, e) => n + e.amount_cents, 0);
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

  return (
    <div className="admin-stack">
      {(toReview.length > 0 || owedToMembers.length > 0) && (
        <section className="admin-panel" aria-labelledby="fin-todo-title">
          <div className="admin-panel-head"><h2 id="fin-todo-title">Needs you</h2></div>
          <ul className="admin-dash-queue">
            {toReview.length > 0 && (
              <li className="is-urgent">
                <button type="button" onClick={onReview} className="admin-queue-row">
                  <span className="admin-dash-mark"><span className="sr-only">Urgent: </span><FileText size={18} aria-hidden="true" /></span>
                  <span>{plural(toReview.length, 'bank transfer receipt')} to check</span>
                  <span className="admin-dash-go" aria-hidden="true">Review</span>
                </button>
              </li>
            )}
            {owedToMembers.length > 0 && (
              <li>
                <div className="admin-queue-row">
                  <span className="admin-dash-mark"><UserCheck size={18} aria-hidden="true" /></span>
                  <span>{plural(owedToMembers.length, 'expense')} to reimburse to members, {money(owedTotal)}</span>
                  <span />
                </div>
              </li>
            )}
          </ul>
        </section>
      )}

      <section className="admin-panel admin-dash-figures-wrap" aria-label="This season's money">
        <dl className="admin-dash-figures">
          <div><dt>Income</dt><dd>{money(income)}</dd><span className="admin-note">Paid payments</span></div>
          <div><dt>Expenses</dt><dd>{money(spent)}</dd></div>
          <div><dt>Net</dt><dd className={income - spent < 0 ? 'is-live' : undefined}>{money(income - spent)}</dd></div>
          <div><dt>Receipts to check</dt><dd>{toReview.length}</dd></div>
        </dl>
      </section>

      <div className="admin-two">
        <Bars title="Income by category" rows={byCategory(paid, INCOME_CATEGORIES)} money={money} />
        <Bars title="Expenses by category" rows={byCategory(expenses, EXPENSE_CATEGORIES)} money={money} spend />
      </div>

      <div className="admin-two">
        <section className="admin-panel" aria-labelledby="fin-due-title">
          <div className="admin-panel-head"><h2 id="fin-due-title">Memberships due</h2><span className="admin-meta">{plural(expiring.length, 'member')} in 30 days</span></div>
          <div className="admin-section">
            {expiring.length === 0 ? <p className="admin-table-foot" style={{ margin: 0 }}>Nobody expires in the next 30 days.</p> : (
              <ul className="admin-list" style={{ maxHeight: 280, overflowY: 'auto' }}>
                {expiring.map(m => (
                  <li key={m.id}>
                    <span>{m.full_name}</span>
                    <span className={m.days < 0 ? 'is-danger' : 'is-warn'}>{m.days < 0 ? `expired ${plural(-m.days, 'day')} ago` : m.days === 0 ? 'today' : `in ${plural(m.days, 'day')}`}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
        <section className="admin-panel" aria-labelledby="fin-pledge-title">
          <div className="admin-panel-head"><h2 id="fin-pledge-title">Unpaid sponsorships</h2><span className="admin-meta">{plural(pledges.length, 'deal')}</span></div>
          <div className="admin-section">
            {pledges.length === 0 ? <p className="admin-table-foot" style={{ margin: 0 }}>No outstanding sponsor deals.</p> : (
              <ul className="admin-list">
                {pledges.map(s => (
                  <li key={s.id}>
                    <span>{s.name} <span style={{ color: 'var(--color-muted)' }}>({s.package_status === 'prospect' ? 'not paid yet' : 'agreed'})</span></span>
                    <span>{s.package_value ? money(Math.round(s.package_value * 100)) : '—'}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Bars({ title, rows, money, spend }: { title: string; rows: { label: string; value: number }[]; money: (c: number) => string; spend?: boolean }) {
  const max = Math.max(1, ...rows.map(r => r.value));
  return (
    <section className="admin-panel" aria-label={title}>
      <div className="admin-panel-head"><h2>{title}</h2></div>
      <div className="admin-section">
        {rows.length === 0 ? <p className="admin-table-foot" style={{ margin: 0 }}>Nothing recorded yet.</p> : (
          <div className={spend ? 'admin-bars is-spend' : 'admin-bars'}>
            {rows.map(r => (
              <div key={r.label}>
                <div className="admin-bar-row"><span>{r.label}</span><b>{money(r.value)}</b></div>
                <div className="admin-bar-track"><span style={{ transform: `scaleX(${r.value / max})` }} /></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------------------------------------
function IncomeTab({ club, db, currency, money, load, flash, payments, plans, members, sponsors }: Shared & {
  sponsors: { id: string; name: string; package_value?: number | null }[];
  payments: Payment[]; plans: MembershipPlan[]; members: MemberLite[];
}) {
  const [status, setStatus] = useState('all');
  const [kind, setKind] = useState('all');
  const [adding, setAdding] = useState(false);
  const blank = { type: 'other', category: 'match_fees', description: '', amount: '', method: 'cash', payer_name: '', member_id: '', plan_id: '', sponsor_id: '', date: today() };
  const [form, setForm] = useState(blank);

  const rows = payments.filter(p => (status === 'all' || p.status === status) && (kind === 'all' || p.kind === kind));
  const memberName = (id?: string | null) => members.find(m => m.id === id)?.full_name;

  const verify = async (p: Payment) => {
    const { data, error } = await db!.rpc('fulfil_payment', { p_payment_id: p.id });
    if (error) return flash('error', error.message);
    // fulfil_payment files a renewal for a still-pending applicant as their sign-up
    const kind = (data as Payment | null)?.kind || p.kind;
    // A bank-transfer ticket order: verifying issues the tickets (fulfil_payment), then the buyer gets them by email
    if (kind === 'event_ticket') {
      const res = await fetch('/api/payments/tickets-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getAccessToken()}` },
        body: JSON.stringify({ clubId: club.id, paymentId: p.id }),
      }).then(r => r.json()).catch(() => null);
      flash('ok', res?.sent ? 'Payment verified. Tickets issued and emailed to the buyer.' : 'Payment verified and tickets issued. The email didn\'t send: share the ticket link from the order.');
      return load();
    }
    if (kind === 'sponsorship') {
      const res = await fetch('/api/payments/tickets-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getAccessToken()}` },
        body: JSON.stringify({ clubId: club.id, paymentId: p.id }),
      }).then(r => r.json()).catch(() => null);
      flash('ok', res?.sent ? 'Payment verified. The sponsor was emailed a thank-you with the link to their sponsor page.' : 'Payment verified. Put them on the site from the Sponsors page.');
      return load();
    }
    flash('ok', kind === 'membership_signup' ? 'Payment verified. Approve the application in Members (the Application button opens it).'
      : kind.startsWith('membership') ? 'Payment verified and membership extended.' : 'Payment verified.');
    load();
  };
  const reject = async (p: Payment) => {
    // SPP-2: an invoice sent before payment, with nothing paid against it yet: cancelling it is quiet
    if (p.status === 'pending' && p.due_on) {
      if (!(await confirmAction({ title: 'Cancel this invoice?', message: 'Use this if they won\'t be paying it. It stays in your records as cancelled, and they can ask for a new one.', confirmLabel: 'Cancel invoice', danger: true }))) return;
      const { error } = await db!.from('payments').update({ status: 'rejected', rejection_reason: 'Invoice cancelled', reviewed_at: new Date().toISOString() }).eq('id', p.id);
      if (error) return flash('error', error.message);
      flash('ok', 'Invoice cancelled.');
      return load();
    }
    // SPE-8: a sponsor is emailed the reason with a link to pay again; for anyone else it stays with the club
    const sponsorship = p.kind === 'sponsorship';
    const reason = await askText({ title: 'Reject this transfer?', message: sponsorship ? 'The payment is marked rejected. The sponsor is emailed your note with a link to pay again.' : 'The payment is marked rejected. Your reason is only shown to the club\'s finance team.', label: sponsorship ? 'Note to the sponsor' : 'Reason', placeholder: 'e.g. No money received yet', confirmLabel: 'Reject transfer', danger: true });
    if (reason === null) return;
    // SPP-2: turning down a receipt for an invoice the club sent leaves the invoice due (same number)
    const { error } = await db!.from('payments').update({ status: p.due_on ? 'pending' : 'rejected', rejection_reason: reason, reviewed_at: new Date().toISOString() }).eq('id', p.id);
    if (error) return flash('error', error.message);
    if (sponsorship) {
      const res = await fetch('/api/payments/tickets-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getAccessToken()}` },
        body: JSON.stringify({ clubId: club.id, paymentId: p.id }),
      }).then(r => r.json()).catch(() => null);
      flash('ok', res?.sent ? 'Payment rejected. The sponsor was emailed your note and a link to pay again.' : 'Payment rejected. The email didn\'t send, so let the sponsor know yourself.');
      return load();
    }
    flash('ok', 'Payment rejected.');
    load();
  };

  const record = async (e: React.FormEvent) => {
    e.preventDefault();
    const cents = parseMoneyToCents(form.amount);
    if (cents === null) return flash('error', 'Enter a valid amount, e.g. 25 or 25.50');
    // SPP-3: a sponsor's payment goes against their sponsorship: Paid, end date, invoice (app/api/sponsors/record-payment)
    if (form.type === 'sponsorship') {
      if (!form.sponsor_id) return flash('error', 'Choose the sponsor.');
      const res = await fetch('/api/sponsors/record-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getAccessToken()}` },
        body: JSON.stringify({ clubId: club.id, sponsorId: form.sponsor_id, amountCents: cents, method: form.method, paidOn: form.date }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return flash('error', json.error || 'Could not record the payment.');
      flash('ok', json.sent ? 'Payment recorded. The sponsor was emailed a thank-you with their invoice on their sponsor page.' : 'Payment recorded. Their invoice is on their sponsor page.');
      setForm(blank);
      setAdding(false);
      return load();
    }
    const isMembership = form.type === 'membership';
    if (isMembership && (!form.member_id || !form.plan_id)) return flash('error', 'Choose the member and plan.');
    const plan = plans.find(p => p.id === form.plan_id);
    // Paying for an application that is still pending is the sign-up payment, not a renewal
    const isSignup = isMembership && members.find(m => m.id === form.member_id)?.membership_status === 'pending';
    const { data, error } = await db!.from('payments').insert({
      club_id: club.id,
      kind: isMembership ? (isSignup ? 'membership_signup' : 'membership_renewal') : 'income_other',
      category: isMembership ? 'membership' : form.category,
      member_id: isMembership ? form.member_id : null,
      plan_id: isMembership ? form.plan_id : null,
      description: form.description || (isMembership ? `${plan?.name} (${memberName(form.member_id)})` : null),
      amount_cents: cents,
      currency,
      method: form.method,
      status: isMembership ? 'pending' : 'paid',
      paid_at: isMembership ? null : new Date(form.date).toISOString(),
      payer_name: form.payer_name || (isMembership ? memberName(form.member_id) : null),
    }).select('id').single();
    if (error || !data) return flash('error', error?.message || 'Could not save.');
    // Membership payments go through fulfilment so the expiry date moves too
    if (isMembership) {
      const res = await db!.rpc('fulfil_payment', { p_payment_id: data.id });
      if (res.error) return flash('error', res.error.message);
    }
    flash('ok', isSignup ? 'Payment recorded. The application can now be approved in Members.' : 'Income recorded.');
    setForm(blank);
    setAdding(false);
    load();
  };

  return (
    <div className="stack">
      <div className="admin-toolbar" style={{ marginBottom: 0 }}>
        <select data-view-ok className="form-select" value={status} onChange={e => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="all">All statuses</option>
          {Object.keys(STATUS_TONE).map(s => <option key={s} value={s}>{statusText(s)}</option>)}
        </select>
        <select data-view-ok className="form-select" value={kind} onChange={e => setKind(e.target.value)} aria-label="Filter by type">
          <option value="all">All types</option>
          {Object.entries(PAYMENT_KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button type="button" className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setAdding(a => !a)} aria-expanded={adding}><Plus size={16} aria-hidden="true" /> Record income</button>
      </div>

      {adding && (
        <form onSubmit={record} className="glass-panel" style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '0.75rem' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="inc-type">Type</label>
            <select id="inc-type" className="form-select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              <option value="other">General income</option>
              <option value="membership">Membership payment (extends expiry)</option>
              <option value="sponsorship">Sponsorship payment (marks the sponsor paid)</option>
            </select>
          </div>
          {form.type === 'sponsorship' ? (
            <>
              <div className="form-group">
                <label className="form-label" htmlFor="inc-sponsor">Sponsor</label>
                <select id="inc-sponsor" className="form-select" value={form.sponsor_id}
                  onChange={e => { const sp = sponsors.find(x => x.id === e.target.value); setForm({ ...form, sponsor_id: e.target.value, amount: sp?.package_value ? Number(sp.package_value).toFixed(2) : form.amount }); }}>
                  <option value="">Choose…</option>
                  {[...sponsors].sort((a, b) => a.name.localeCompare(b.name)).map(sp => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="inc-sp-date">Date received</label>
                <input id="inc-sp-date" type="date" className="form-input" max={today()} value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
              </div>
            </>
          ) : form.type === 'membership' ? (
            <>
              <div className="form-group">
                <label className="form-label" htmlFor="inc-member">Member</label>
                <select id="inc-member" className="form-select" value={form.member_id} onChange={e => setForm({ ...form, member_id: e.target.value })}>
                  <option value="">Choose…</option>
                  {[...members].sort((a, b) => a.full_name.localeCompare(b.full_name)).map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="inc-plan">Plan</label>
                <select id="inc-plan" className="form-select" value={form.plan_id}
                  onChange={e => { const p = plans.find(x => x.id === e.target.value); setForm({ ...form, plan_id: e.target.value, amount: p ? (p.price_cents / 100).toFixed(2) : form.amount }); }}>
                  <option value="">Choose…</option>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label" htmlFor="inc-cat">Category</label>
                <select id="inc-cat" className="form-select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {Object.entries(INCOME_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="inc-from">From</label>
                <input id="inc-from" className="form-input" value={form.payer_name} onChange={e => setForm({ ...form, payer_name: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="inc-date">Date</label>
                <input id="inc-date" type="date" className="form-input" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
              </div>
            </>
          )}
          {form.type !== 'sponsorship' && (
            <div className="form-group">
              <label className="form-label" htmlFor="inc-desc">Description</label>
              <input id="inc-desc" className="form-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
          )}
          <div className="form-group">
            <label className="form-label" htmlFor="inc-amount">Amount ({currency})</label>
            <input id="inc-amount" className="form-input" inputMode="decimal" required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="inc-method">Method</label>
            <select id="inc-method" className="form-select" value={form.method} onChange={e => setForm({ ...form, method: e.target.value })}>
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank transfer</option>
              {form.type === 'sponsorship' && <option value="cheque">Cheque</option>}
              <option value="other">Other</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary" style={{ alignSelf: 'end' }}><Save size={16} /> Save</button>
        </form>
      )}

      <div className="admin-panel admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Date</th><th scope="col">Type</th><th scope="col">Description</th><th scope="col">Payer</th>
              <th scope="col">Method</th><th scope="col" className="is-num">Amount</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8}>No payments yet.</td></tr>}
            {rows.map(p => (
              <tr key={p.id}>
                <td className="is-num" style={{ textAlign: 'left' }}>{(p.paid_at || p.created_at).slice(0, 10)}</td>
                <td>{p.kind === 'income_other' ? INCOME_CATEGORIES[p.category] : PAYMENT_KIND_LABEL[p.kind]}</td>
                <td className="is-strong">{p.description}{p.reference && <small>Ref {p.reference}</small>}</td>
                <td>{p.payer_name}{p.payer_email && <small>{p.payer_email}</small>}</td>
                <td>{PAYMENT_METHOD_LABEL[p.method]}</td>
                <td className="is-num is-strong">{formatMoney(p.amount_cents, p.currency)}</td>
                <td>
                  {/* SPP-2: an invoice sent before payment */}
                  <span className={`admin-pill ${p.status === 'pending' && p.due_on ? 'is-warn' : STATUS_TONE[p.status] || ''}`}>
                    {p.status === 'pending' && p.due_on ? `Invoice due ${p.due_on}` : statusText(p.status)}
                  </span>
                  {p.rejection_reason && <small>{p.rejection_reason}</small>}
                </td>
                <td className="is-actions">
                  {p.receipt_key && <button data-view-ok type="button" className="btn btn-secondary btn-sm" onClick={() => openReceipt('payment', p.id)} title="View receipt"><FileText size={14} aria-hidden="true" /> Receipt</button>}
                  {/* A pending cash or bank payment (e.g. one whose fulfilment failed) can be finished here too */}
                  {/* The same application's card in Members: verify and approve there in one go */}
                  {p.kind === 'membership_signup' && p.member_id && members.find(m => m.id === p.member_id)?.membership_status === 'pending' && (
                    <Link data-view-ok href={`/${club.slug}/admin/people?tab=applications&member=${p.member_id}`} className="btn btn-secondary btn-sm" title="Open this application in People">
                      <UserCheck size={14} aria-hidden="true" /> Application
                    </Link>
                  )}
                  {(p.status === 'awaiting_review' || (p.status === 'pending' && p.method !== 'stripe')) && (
                    <>
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => verify(p)}><CheckCircle2 size={14} aria-hidden="true" /> {p.status === 'pending' && p.due_on ? 'Mark paid' : 'Verify'}</button>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => reject(p)}><XCircle size={14} aria-hidden="true" /> {p.status === 'pending' && p.due_on ? 'Cancel invoice' : 'Reject'}</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="admin-table-foot">
        Total shown (paid): {money(rows.filter(p => p.status === 'paid').reduce((n, p) => n + p.amount_cents, 0))}. Card refunds are made in your Stripe dashboard and update here automatically.
      </p>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
function ExpensesTab({ club, db, currency, money, load, flash, expenses, members }: Shared & { expenses: Expense[]; members: MemberLite[] }) {
  const blank = { id: '', category: 'facility_hire', description: '', vendor: '', amount: '', spent_on: today(), method: 'bank_transfer', paid_by_member_id: '', reimbursed: false, receipt_key: '' };
  const [form, setForm] = useState(blank);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const edit = (e: Expense) => {
    setForm({ id: e.id, category: e.category, description: e.description, vendor: e.vendor || '', amount: (e.amount_cents / 100).toFixed(2),
      spent_on: e.spent_on, method: e.method, paid_by_member_id: e.paid_by_member_id || '', reimbursed: e.reimbursed, receipt_key: e.receipt_key || '' });
    setOpen(true);
  };

  const upload = async (file: File) => {
    setUploading(true);
    const body = new FormData();
    body.append('clubId', club.id);
    body.append('receipt', file);
    const res = await fetch('/api/payments/receipt', { method: 'POST', body, headers: { Authorization: `Bearer ${await getAccessToken()}` } });
    const json = await res.json().catch(() => ({}));
    setUploading(false);
    if (!res.ok) return flash('error', json.error || 'Upload failed.');
    setForm(f => ({ ...f, receipt_key: json.key }));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const cents = parseMoneyToCents(form.amount);
    if (cents === null) return flash('error', 'Enter a valid amount, e.g. 120 or 120.50');
    const row = {
      club_id: club.id, category: form.category, description: form.description, vendor: form.vendor || null, amount_cents: cents,
      currency, spent_on: form.spent_on, method: form.method, paid_by_member_id: form.paid_by_member_id || null,
      reimbursed: form.reimbursed, receipt_key: form.receipt_key || null,
    };
    const { error } = form.id ? await db!.from('expenses').update(row).eq('id', form.id) : await db!.from('expenses').insert(row);
    if (error) return flash('error', error.message);
    flash('ok', form.id ? 'Expense updated.' : 'Expense added.');
    setForm(blank);
    setOpen(false);
    load();
  };

  const remove = async (e: Expense) => {
    if (!(await confirmAction({ title: `Delete "${e.description}"?`, message: 'This expense will be removed from your records.', confirmLabel: 'Delete expense', danger: true }))) return;
    const { error } = await db!.from('expenses').delete().eq('id', e.id);
    if (error) return flash('error', error.message);
    load();
  };

  return (
    <div className="stack">
      <button type="button" className="btn btn-primary" style={{ alignSelf: 'flex-end' }} onClick={() => { setForm(blank); setOpen(o => !o); }} aria-expanded={open}><Plus size={16} aria-hidden="true" /> Add expense</button>

      {open && (
        <form onSubmit={save} className="glass-panel" style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '0.75rem' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="exp-cat">Category</label>
            <select id="exp-cat" className="form-select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="exp-desc">Description</label>
            <input id="exp-desc" className="form-input" required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="exp-vendor">Paid to</label>
            <input id="exp-vendor" className="form-input" value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="exp-amount">Amount ({currency})</label>
            <input id="exp-amount" className="form-input" inputMode="decimal" required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="exp-date">Date</label>
            <input id="exp-date" type="date" className="form-input" required value={form.spent_on} onChange={e => setForm({ ...form, spent_on: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="exp-method">Method</label>
            <select id="exp-method" className="form-select" value={form.method} onChange={e => setForm({ ...form, method: e.target.value })}>
              <option value="bank_transfer">Bank transfer</option>
              <option value="card">Card</option>
              <option value="cash">Cash</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="exp-paidby">Paid by a member (to reimburse)</label>
            <select id="exp-paidby" className="form-select" value={form.paid_by_member_id} onChange={e => setForm({ ...form, paid_by_member_id: e.target.value })}>
              <option value="">Club paid directly</option>
              {[...members].sort((a, b) => a.full_name.localeCompare(b.full_name)).map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
          </div>
          {form.paid_by_member_id && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
              <input type="checkbox" checked={form.reimbursed} onChange={e => setForm({ ...form, reimbursed: e.target.checked })} /> Reimbursed
            </label>
          )}
          <div className="form-group">
            <label className="form-label" htmlFor="exp-receipt">Receipt {form.receipt_key && '(attached)'}</label>
            <input id="exp-receipt" type="file" className="form-input" accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={uploading} style={{ alignSelf: 'end' }}>
            <Save size={16} /> {uploading ? 'Uploading…' : form.id ? 'Update' : 'Save'}
          </button>
        </form>
      )}

      <div className="admin-panel admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Date</th><th scope="col">Category</th><th scope="col">Description</th><th scope="col">Paid to</th>
              <th scope="col" className="is-num">Amount</th><th scope="col"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 && <tr><td colSpan={6}>No expenses yet.</td></tr>}
            {expenses.map(e => (
              <tr key={e.id}>
                <td className="is-num" style={{ textAlign: 'left' }}>{e.spent_on}</td>
                <td>{EXPENSE_CATEGORIES[e.category] || e.category}</td>
                <td className="is-strong">
                  {e.description}
                  {e.paid_by_member_id && (
                    <small style={e.reimbursed ? undefined : { color: 'var(--color-warn)' }}>
                      Paid by {members.find(m => m.id === e.paid_by_member_id)?.full_name || 'member'}: {e.reimbursed ? 'reimbursed' : 'to reimburse'}
                    </small>
                  )}
                </td>
                <td>{e.vendor}</td>
                <td className="is-num is-strong">{formatMoney(e.amount_cents, e.currency)}</td>
                <td className="is-actions">
                  {e.receipt_key && <button data-view-ok type="button" className="btn btn-secondary btn-sm" onClick={() => openReceipt('expense', e.id)} aria-label="View receipt"><FileText size={14} aria-hidden="true" /></button>}
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => edit(e)}>Edit</button>
                  <button data-needs-full type="button" className="btn btn-danger btn-sm" onClick={() => remove(e)} aria-label="Delete expense"><Trash2 size={14} aria-hidden="true" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="admin-table-foot">Total shown: {money(expenses.reduce((n, e) => n + e.amount_cents, 0))}</p>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
const longDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'long', year: 'numeric' });

// Membership application payment & approval controls
function MembershipPaymentPolicyPanel({ clubId, db, flash }: { clubId: string; db: Shared['db']; flash: Shared['flash'] }) {
  const { clubs, updateClubBranding } = useClub();
  const club = clubs.find(c => c.id === clubId);
  const savedPolicy = club?.membership_payment_policy || DEFAULT_MEMBERSHIP_PAYMENT_POLICY;
  const [policy, setPolicy] = useState<MembershipPaymentPolicy>(savedPolicy);
  useEffect(() => { setPolicy(savedPolicy); }, [savedPolicy]);

  const dirty = policy !== savedPolicy;

  const save = async () => {
    const { error } = await db!.rpc('set_membership_payment_policy', { p_club_id: clubId, p_policy: policy });
    if (error) return flash('error', error.message);
    updateClubBranding(clubId, { membership_payment_policy: policy });
    flash('ok', 'Membership approval & payment policy saved.');
  };

  // Free supporter passes approved straight away (migration 20261120)
  const autoFree = !!club?.auto_approve_free;
  const [savingFree, setSavingFree] = useState(false);
  const toggleAutoFree = async () => {
    setSavingFree(true);
    const { error } = await db!.rpc('set_auto_approve_free', { p_club_id: clubId, p_on: !autoFree });
    setSavingFree(false);
    if (error) return flash('error', error.code === 'PGRST202' ? 'This needs the 20261120_auto_approve_free.sql database migration.' : error.message);
    updateClubBranding(clubId, { auto_approve_free: !autoFree });
    flash('ok', !autoFree ? 'Free supporter sign-ups are now approved straight away.' : 'Free supporter sign-ups now wait for the committee again.');
  };

  return (
    <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h3 style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
            Membership sign-up and payment
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem' }}>
            Control whether applicants can be approved before paying, permit committee fee waivers, or auto-approve on payment.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '0.65rem' }}>
        {MEMBERSHIP_PAYMENT_POLICIES.map(p => {
          const isSelected = policy === p.id;
          return (
            <label key={p.id} className="admin-option">
              <input type="radio" name="membership-payment-policy" checked={isSelected} onChange={() => setPolicy(p.id)} />
              <span>
                <b>{p.title} <span className={isSelected ? 'admin-pill is-ok' : 'admin-pill'} style={{ display: 'inline-flex', marginTop: 0 }}>{p.badge}</span></b>
                <span>{p.description}</span>
              </span>
            </label>
          );
        })}
      </div>

      <button
        type="button"
        className="btn btn-primary"
        style={{ alignSelf: 'flex-start', marginTop: '0.25rem' }}
        onClick={save}
        disabled={!dirty}
      >
        <Save size={16} aria-hidden="true" /> Save policy
      </button>

      <label className="admin-option">
        <input type="checkbox" checked={autoFree} disabled={savingFree} onChange={toggleAutoFree} />
        <span>
          <b>Approve free supporter sign-ups straight away</b>
          <span>
            Adults joining as a supporter on a $0 plan get their member pass as soon as they sign up. Players, juniors and paid plans still come to you for approval.
          </span>
        </span>
      </label>
    </div>
  );
}

// How memberships renew. Saved through set_membership_renewal(), so Finance roles don't need the
// branding page's rights over the rest of the club record.
function RenewalPanel({ clubId, db, flash }: { clubId: string; db: Shared['db']; flash: Shared['flash'] }) {
  const { clubs, updateClubBranding } = useClub();
  const club = clubs.find(c => c.id === clubId);
  const savedMode = club?.membership_renewal || 'anniversary';
  const savedMonth = club?.fiscal_year_start_month || 7;
  const savedGrace = club?.fiscal_grace_days || 0;
  const [mode, setMode] = useState<RenewalMode>(savedMode);
  const [month, setMonth] = useState(savedMonth);
  const [grace, setGrace] = useState(savedGrace);
  useEffect(() => { setMode(savedMode); setMonth(savedMonth); setGrace(savedGrace); }, [savedMode, savedMonth, savedGrace]);

  const rule = { membership_renewal: mode, fiscal_year_start_month: month, fiscal_grace_days: grace };
  const today = todayIso();
  const firstEnd = membershipTermEnd(today, rule);
  const dirty = mode !== savedMode || (mode === 'fiscal' && (month !== savedMonth || grace !== savedGrace));
  // The fiscal year start this year's joiners renew on, and the first day the grace period moves them to the next one
  const nextStart = membershipTermEnd(today, { ...rule, fiscal_grace_days: 0 });
  const graceFrom = (() => { const d = new Date(`${nextStart}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - grace); return d.toISOString().slice(0, 10); })();

  const save = async () => {
    const { error } = await db!.rpc('set_membership_renewal', { p_club_id: clubId, p_mode: mode, p_fiscal_start_month: month, p_grace_days: grace });
    if (error) return flash('error', error.message);
    updateClubBranding(clubId, { membership_renewal: mode, fiscal_year_start_month: month, fiscal_grace_days: grace });
    flash('ok', 'Renewal method saved. It applies to new members and renewals from now on.');
  };

  const option = (value: RenewalMode, title: string, desc: string) => (
    <label className="admin-option">
      <input type="radio" name="renewal-mode" checked={mode === value} onChange={() => setMode(value)} />
      <span>
        <b>{title}</b>
        <span>{desc}</span>
      </span>
    </label>
  );

  return (
    <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <h3 style={{ fontWeight: 800, color: 'var(--text-primary)' }}>Membership renewal</h3>
      <div style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))' }}>
        {option('anniversary', 'Year to year', 'Each membership renews on the anniversary of the day it started: joined 1 August 2025, renews 1 August 2026.')}
        {option('fiscal', 'Fiscal year to fiscal year', 'Everyone renews together at the start of the club’s fiscal year, whenever they joined.')}
      </div>
      {mode === 'fiscal' && (
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" htmlFor="fiscal-month">Fiscal year starts on the 1st of</label>
          <select id="fiscal-month" className="form-select" style={{ maxWidth: 220 }} value={month} onChange={e => setMonth(Number(e.target.value))}>
            {MONTH_NAMES.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
          </select>
        </div>
      )}
      {mode === 'fiscal' && (
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" htmlFor="fiscal-grace">Grace period (days before the fiscal year starts)</label>
          <input id="fiscal-grace" className="form-input" type="number" inputMode="numeric" min={0} max={183} style={{ maxWidth: 140 }}
            value={grace} onChange={e => setGrace(Math.max(0, Math.min(183, Math.round(Number(e.target.value) || 0))))} />
          <p className="text-meta" style={{ marginTop: '0.35rem' }}>
            {grace > 0
              ? <>Anyone joining from <strong>{longDate(graceFrom)}</strong> renews on <strong>{longDate(membershipTermEnd(nextStart, rule))}</strong>, not {longDate(nextStart)}. 0 turns it off.</>
              : 'Off: someone joining just before the fiscal year starts renews a few days later. Set the number of days that should count towards the next year instead.'}
          </p>
        </div>
      )}
      <p className="text-meta" role="status">
        Someone joining today ({longDate(today)}) renews on <strong>{longDate(firstEnd)}</strong>, then on{' '}
        <strong>{longDate(membershipTermEnd(firstEnd, rule))}</strong>.
        {mode === 'fiscal' && ' Plan lengths (Months) are not used: every plan runs to the next fiscal year.'}
        {' '}Existing members keep their current expiry until they next renew.
      </p>
      <button type="button" className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={save} disabled={!dirty}><Save size={16} /> Save</button>
    </div>
  );
}

/** ABN and GST registration, printed on sponsorship invoices (SP-F4, migration 20261133). Hidden
 *  until that migration runs, so the rest of Settings keeps saving. */
function InvoiceDetailsPanel({ clubId, db, flash, load, hasSettings }: { clubId: string; db: Shared['db']; flash: Shared['flash']; load: Shared['load']; hasSettings: boolean }) {
  const [ready, setReady] = useState<boolean | null>(null);
  const [abn, setAbn] = useState('');
  const [gst, setGst] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    db?.from('club_payment_settings').select('abn, gst_registered').eq('club_id', clubId).maybeSingle()
      .then(({ data, error }) => {
        setReady(!error);
        setAbn(data?.abn ? formatAbn(data.abn) : '');
        setGst(!!data?.gst_registered);
      });
  }, [db, clubId]);
  if (!ready) return null;

  const abnDigits = abn.trim() ? cleanAbn(abn) : null;
  const abnWrong = !!abn.trim() && !abnDigits;
  const save = async () => {
    if (abnWrong) return flash('error', 'That ABN doesn\'t look right. Check it on abr.business.gov.au.');
    setSaving(true);
    const values = { abn: abnDigits, gst_registered: gst, updated_at: new Date().toISOString() };
    const { error } = hasSettings
      ? await db!.from('club_payment_settings').update(values).eq('club_id', clubId)
      : await db!.from('club_payment_settings').insert({ club_id: clubId, ...values });
    setSaving(false);
    if (error) return flash('error', error.message);
    flash('ok', 'Invoice details saved.');
    load();
  };

  return (
    <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div>
        <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}><FileText size={18} /> Invoices</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.35rem 0 0' }}>
          Printed on the invoices sponsors open from their own page.
        </p>
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="set-abn">ABN (Australian Business Number)</label>
        <input id="set-abn" className="form-input" inputMode="numeric" autoComplete="off" style={{ maxWidth: 240 }} value={abn}
          placeholder="12 345 678 901" aria-invalid={abnWrong} onChange={e => setAbn(e.target.value)}
          onBlur={() => abnDigits && setAbn(formatAbn(abnDigits))} />
        {/* SPE-22: 11 digits that fail the ABN check get their own message */}
        {abnWrong && <p role="alert" style={{ color: 'var(--c-red)', fontSize: '0.8rem', margin: '0.35rem 0 0' }}>
          {abn.replace(/\D/g, '').length === 11
            ? <>That isn&apos;t a valid ABN: one of the digits is probably wrong. Check it on abr.business.gov.au.</>
            : <>That ABN doesn&apos;t look right: it should be 11 digits.</>}
        </p>}
      </div>
      <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', cursor: 'pointer' }}>
        <input type="checkbox" checked={gst} onChange={e => setGst(e.target.checked)} style={{ width: 18, height: 18, marginTop: 2, flexShrink: 0 }} />
        <span>
          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Registered for GST</span>
          <span className="text-meta" style={{ display: 'block' }}>
            {gst
              ? 'Sponsors get a "Tax invoice". Your prices include GST, and the invoice shows it (1/11th of the price).'
              : 'Sponsors get an "Invoice" that says no GST has been charged. Most small clubs aren\'t registered.'}
          </span>
        </span>
      </label>
      {gst && !abnDigits && <p className="text-note" style={{ margin: 0, color: 'var(--c-amber)' }}>Add your ABN too: a tax invoice needs it. Until then sponsors get a plain invoice.</p>}
      <button type="button" className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={save} disabled={saving}><Save size={16} /> {saving ? 'Saving…' : 'Save'}</button>
    </div>
  );
}

function SettingsTab({ club, db, load, flash, settings, plans }: Shared & {
  settings: ClubPaymentSettings | null; plans: MembershipPlan[];
}) {
  // Clubs with several teams can tie a plan to one team (e.g. junior fees)
  const { clubTeams } = useClub();
  const teams = clubTeamsOf(clubTeams, club.id);
  const [currency, setCurrency] = useState(settings?.currency || 'AUD');
  const [bank, setBank] = useState(settings?.bank_details || '');
  const [connecting, setConnecting] = useState(false);
  useEffect(() => { setCurrency(settings?.currency || 'AUD'); setBank(settings?.bank_details || ''); }, [settings]);

  const saveSettings = async () => {
    // Admins may only write these columns (see the migration's column grants), so no upsert
    const values = { currency, bank_details: bank.trim() || null, updated_at: new Date().toISOString() };
    const { error } = settings
      ? await db!.from('club_payment_settings').update(values).eq('club_id', club.id)
      : await db!.from('club_payment_settings').insert({ club_id: club.id, ...values });
    if (error) return flash('error', error.message);
    flash('ok', 'Payment settings saved.');
    load();
  };

  const connectStripe = async () => {
    setConnecting(true);
    const res = await fetch('/api/stripe/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getAccessToken()}` },
      body: JSON.stringify({ clubId: club.id }),
    });
    const json = await res.json().catch(() => ({}));
    if (json.url) return void (window.location.href = json.url);
    setConnecting(false);
    if (!res.ok) return flash('error', json.error || 'Could not reach Stripe.');
    flash('ok', 'Stripe is connected and ready to take card payments.');
    load();
  };

  const disconnectStripe = async () => {
    if (!(await confirmAction({ title: 'Disconnect Stripe?', message: 'Card payments will stop until you connect again. Bank transfers keep working, and your Stripe account itself is not closed.', confirmLabel: 'Disconnect', danger: true }))) return;
    const res = await fetch(`/api/stripe/connect?clubId=${club.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${await getAccessToken()}` },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return flash('error', json.error || 'Could not disconnect Stripe.');
    flash('ok', 'Stripe disconnected. Card payments are off.');
    load();
  };

  const stripeState = settings?.stripe_charges_enabled ? 'connected' : (settings?.stripe_connected ?? settings?.stripe_account_id) ? 'incomplete' : 'none';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}><CreditCard size={18} /> Card payments (Stripe)</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
          {stripeState === 'connected' && 'Connected. Card payments go straight into the club’s own Stripe account.'}
          {stripeState === 'incomplete' && 'Stripe setup isn’t finished yet. Continue to add the club’s details and bank account.'}
          {stripeState === 'none' && 'Connect the club’s Stripe account (or create one) to take card payments. Money goes straight to the club.'}
          {bookingFeeCents(10000) > 0 && ' Payers see a small booking fee on top of your price at checkout; it goes to itsfootball.club, so the club still receives its full price (less Stripe’s card fee). A full refund returns the booking fee too.'}
        </p>
        <button type="button" className="btn btn-primary" onClick={connectStripe} disabled={connecting}>
          {connecting ? 'Opening Stripe…' : stripeState === 'connected' ? 'Refresh status' : stripeState === 'incomplete' ? 'Continue Stripe setup' : 'Connect Stripe'}
        </button>
        {stripeState !== 'none' && (
          <>
            {/* Standard accounts sign in to Stripe directly with the club's own login */}
            <a href="https://dashboard.stripe.com/" target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ marginLeft: '0.5rem' }}>
              Open Stripe dashboard
            </a>
            <button type="button" className="btn btn-danger" style={{ marginLeft: '0.5rem' }} onClick={disconnectStripe}>
              Disconnect
            </button>
          </>
        )}
      </div>

      <MembershipPaymentPolicyPanel clubId={club.id} db={db} flash={flash} />
      <RenewalPanel clubId={club.id} db={db} flash={flash} />

      <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h3 style={{ fontWeight: 800, color: 'var(--text-primary)' }}>Currency & bank transfer</h3>
        <div className="form-group">
          <label className="form-label" htmlFor="set-currency">Currency</label>
          <select id="set-currency" className="form-select" style={{ maxWidth: 200 }} value={currency} onChange={e => setCurrency(e.target.value)}>
            {Array.from(new Set([...CURRENCIES, currency])).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="set-bank">Bank details shown to payers (leave empty to turn off bank transfer)</label>
          <textarea id="set-bank" className="form-textarea" rows={4} value={bank} onChange={e => setBank(e.target.value)}
            placeholder={'Account name: Example FC\nBSB: 000-000   Account: 12345678\nUse the reference shown so we can match your payment.'} />
        </div>
        <button type="button" className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={saveSettings}><Save size={16} /> Save</button>
      </div>

      <InvoiceDetailsPanel clubId={club.id} db={db} flash={flash} load={load} hasSettings={!!settings} />

      <PriceList<MembershipPlan>
        title="Membership plans" table="membership_plans" rows={plans} db={db} clubId={club.id} flash={flash} load={load}
        blank={{ name: 'New plan', price_cents: 0, duration_months: 12 }}
        extra={(row, set) => (
          <span style={{ display: 'inline-flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input className="form-input" type="number" min={1} max={60} style={{ width: 80 }} aria-label="Months"
              value={row.duration_months} onChange={e => set({ duration_months: Number(e.target.value) })} />
            {teams.length > 1 && (
              <select className="form-select" style={{ width: 150 }} aria-label="Team" title="Team"
                value={row.team_id || ''} onChange={e => set({ team_id: e.target.value || null })}>
                <option value="">All teams</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
            {/* Who sees it on the Join page: under 18s aren't offered adult plans and start on a junior one */}
            <select className="form-select" style={{ width: 140 }} aria-label="Who can choose" title="Who can choose this plan"
              value={row.audience || 'all'} onChange={e => set({ audience: e.target.value as MembershipPlan['audience'] })}>
              <option value="all">Everyone</option>
              <option value="junior">Under 18s</option>
              <option value="adult">Adults (18+)</option>
            </select>
          </span>
        )}
        extraLabel="Months"
      />
      <p className="text-note">
        Sponsorship packages are set up on the <Link href={`/${club.slug}/admin/sponsors?tab=packages`}>Sponsors page</Link>, next to the sponsors they sign up.
      </p>
      <p className="text-note">
        Public sign-up pages: <a href={`/${club.slug}/member`}>/{club.slug}/member</a> and <a href={`/${club.slug}/sponsor`}>/{club.slug}/sponsor</a>
      </p>
    </div>
  );
}
