'use client';

import React, { use, useCallback, useEffect, useMemo, useState } from 'react';
import { Wallet, Download, CheckCircle2, XCircle, FileText, Plus, Trash2, CreditCard, Save } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import { getSupabaseClient, getAccessToken } from '@/lib/supabase/client';
import {
  INCOME_CATEGORIES, EXPENSE_CATEGORIES, PAYMENT_KIND_LABEL, PAYMENT_METHOD_LABEL, CURRENCIES,
  bookingFeeCents, formatMoney, parseMoneyToCents, toCsv,
} from '@/lib/finance';
import type {
  ClubPaymentSettings, MembershipPlan, SponsorshipPackage, Payment, Expense, SponsorTier,
} from '@/lib/supabase/types';
import { confirmAction, notify } from '@/components/ConfirmDialog';

type Tab = 'overview' | 'income' | 'expenses' | 'settings';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'income', label: 'Income' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'settings', label: 'Settings' },
];
const STATUS_COLOR: Record<string, string> = {
  paid: '#10B981', awaiting_review: '#F59E0B', pending: '#94A3B8', rejected: '#EF4444', refunded: '#A855F7', failed: '#EF4444',
};
const today = () => new Date().toISOString().slice(0, 10);
const cell: React.CSSProperties = { padding: '0.6rem 0.75rem', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.84rem', textAlign: 'left', verticalAlign: 'top' };

// Receipts are private: ask the API for a short-lived link, then open it
async function openReceipt(type: 'payment' | 'expense', id: string) {
  const win = window.open('', '_blank'); // opened synchronously so pop-up blockers allow it
  const token = await getAccessToken();
  const res = await fetch(`/api/payments/receipt?type=${type}&id=${id}`, { headers: { Authorization: `Bearer ${token}` } });
  const json = await res.json().catch(() => ({}));
  if (res.ok && json.url && win) win.location.href = json.url;
  else { win?.close(); await notify(json.error || 'Could not open the receipt.'); }
}

export default function FinancePage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const { clubs, selectClubBySlug, members, sponsors } = useClub();
  const club = selectClubBySlug(clubSlug) || clubs[0];
  const db = getSupabaseClient();

  const [tab, setTabState] = useState<Tab>('overview');
  const [settings, setSettings] = useState<ClubPaymentSettings | null>(null);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [packages, setPackages] = useState<SponsorshipPackage[]>([]);
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

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab') as Tab | null;
    if (t && TABS.some(x => x.id === t)) setTabState(t);
  }, []);
  const setTab = (t: Tab) => {
    setTabState(t);
    window.history.replaceState(null, '', `?tab=${t}`);
  };

  // ponytail: loads the club's whole ledger; page it by season if a club passes a few thousand rows
  const load = useCallback(async () => {
    if (!db) return;
    const [s, pl, pk, pay, exp] = await Promise.all([
      db.from('club_payment_settings').select('*').eq('club_id', club.id).maybeSingle(),
      db.from('membership_plans').select('*').eq('club_id', club.id).order('sort_order'),
      db.from('sponsorship_packages').select('*').eq('club_id', club.id).order('sort_order'),
      db.from('payments').select('*').eq('club_id', club.id).order('created_at', { ascending: false }),
      db.from('expenses').select('*').eq('club_id', club.id).order('spent_on', { ascending: false }),
    ]);
    setSettings(s.data ?? null);
    setPlans(pl.data || []);
    setPackages(pk.data || []);
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
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <span className="badge badge-primary" style={{ marginBottom: '0.4rem', letterSpacing: '0.05em' }}>CLUB GOVERNANCE • FINANCE</span>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Wallet size={30} /> Finance
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', maxWidth: '680px', marginTop: '0.2rem' }}>
            Membership and sponsorship payments, other income, expenses and receipts, all in one place.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label className="form-label m-0" htmlFor="finance-season">Season</label>
          <select data-view-ok id="finance-season" className="form-select" style={{ width: 'auto' }} value={season} onChange={e => setSeason(e.target.value)}>
            <option value="all">All seasons</option>
            {seasons.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button data-view-ok type="button" className="btn btn-secondary" onClick={exportCsv}><Download size={16} /> CSV</button>
        </div>
      </div>

      {feedback && (
        <div role="status" style={{
          background: feedback.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
          border: `1px solid ${feedback.type === 'error' ? '#EF4444' : '#10B981'}`,
          color: feedback.type === 'error' ? 'var(--c-red)' : 'var(--c-green)',
          padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontWeight: 700,
        }}>{feedback.text}</div>
      )}

      <div role="tablist" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem', flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button data-view-ok key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`btn btn-sm ${tab === t.id ? 'btn-primary' : 'btn-secondary'}`}>
            {t.label}
            {t.id === 'income' && payments.some(p => p.status === 'awaiting_review') && (
              <span className="badge" style={{ marginLeft: '0.4rem', background: '#F59E0B', color: '#000' }}>
                {payments.filter(p => p.status === 'awaiting_review').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <Overview {...shared} payments={seasonPayments} expenses={seasonExpenses} members={members.filter(m => m.club_id === club.id)}
          sponsors={sponsors.filter(s => s.club_id === club.id)} onReview={() => setTab('income')} />
      )}
      {tab === 'income' && <IncomeTab {...shared} payments={seasonPayments} plans={plans} members={members.filter(m => m.club_id === club.id)} />}
      {tab === 'expenses' && <ExpensesTab {...shared} expenses={seasonExpenses} members={members.filter(m => m.club_id === club.id)} />}
      {tab === 'settings' && <SettingsTab {...shared} settings={settings} plans={plans} packages={packages} />}
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
  sponsors: { id: string; name: string; package_status?: string; package_value?: number }[]; onReview: () => void;
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
  const pledges = sponsors.filter(s => s.package_status === 'confirmed' || s.package_status === 'prospect');

  const stat = (label: string, value: string, color: string) => (
    <div className="glass-panel" style={{ padding: '1.1rem 1.25rem' }}>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: '1.6rem', fontWeight: 900, color }}>{value}</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '1rem' }}>
        {stat('Income', money(income), '#10B981')}
        {stat('Expenses', money(spent), '#EF4444')}
        {stat('Net', money(income - spent), income - spent >= 0 ? '#10B981' : '#EF4444')}
        {stat('Receipts to check', String(toReview.length), toReview.length ? '#F59E0B' : 'var(--text-secondary)')}
      </div>

      {toReview.length > 0 && (
        <button type="button" className="btn btn-primary" onClick={onReview} style={{ alignSelf: 'flex-start' }}>
          Review {toReview.length} bank transfer{toReview.length === 1 ? '' : 's'}
        </button>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '1rem' }}>
        <Bars title="Income by category" rows={byCategory(paid, INCOME_CATEGORIES)} money={money} color="var(--c-green)" />
        <Bars title="Expenses by category" rows={byCategory(expenses, EXPENSE_CATEGORIES)} money={money} color="var(--c-red)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '1rem' }}>
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Memberships due ({expiring.length})</h3>
          {expiring.length === 0 ? <p className="text-note">Nobody expires in the next 30 days.</p> : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 260, overflowY: 'auto' }}>
              {expiring.map(m => (
                <li key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', fontSize: '0.85rem', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span>{m.full_name}</span>
                  <span style={{ color: m.days < 0 ? 'var(--c-red)' : 'var(--c-amber)', fontWeight: 700 }}>{m.days < 0 ? `expired ${-m.days}d ago` : `in ${m.days}d`}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Unpaid sponsorships ({pledges.length})</h3>
          {pledges.length === 0 ? <p className="text-note">No outstanding sponsor deals.</p> : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {pledges.map(s => (
                <li key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', fontSize: '0.85rem', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span>{s.name} <span className="text-muted">({s.package_status})</span></span>
                  <span style={{ fontWeight: 700 }}>{s.package_value ? money(Math.round(s.package_value * 100)) : '-'}</span>
                </li>
              ))}
            </ul>
          )}
          {owedToMembers.length > 0 && (
            <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--c-amber)' }}>
              {owedToMembers.length} expense{owedToMembers.length === 1 ? '' : 's'} still to reimburse to members
              ({money(owedToMembers.reduce((n, e) => n + e.amount_cents, 0))}).
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Bars({ title, rows, money, color }: { title: string; rows: { label: string; value: number }[]; money: (c: number) => string; color: string }) {
  const max = Math.max(1, ...rows.map(r => r.value));
  return (
    <div className="glass-panel" style={{ padding: '1.25rem' }}>
      <h3 style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>{title}</h3>
      {rows.length === 0 ? <p className="text-note">Nothing recorded yet.</p> : rows.map(r => (
        <div key={r.label} style={{ marginBottom: '0.6rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.2rem' }}>
            <span>{r.label}</span><strong>{money(r.value)}</strong>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: 'rgba(var(--tint-rgb), 0.06)' }}>
            <div style={{ width: `${(r.value / max) * 100}%`, height: '100%', borderRadius: 4, background: color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
function IncomeTab({ club, db, currency, money, load, flash, payments, plans, members }: Shared & {
  payments: Payment[]; plans: MembershipPlan[]; members: MemberLite[];
}) {
  const [status, setStatus] = useState('all');
  const [kind, setKind] = useState('all');
  const [adding, setAdding] = useState(false);
  const blank = { type: 'other', category: 'match_fees', description: '', amount: '', method: 'cash', payer_name: '', member_id: '', plan_id: '', date: today() };
  const [form, setForm] = useState(blank);

  const rows = payments.filter(p => (status === 'all' || p.status === status) && (kind === 'all' || p.kind === kind));
  const memberName = (id?: string | null) => members.find(m => m.id === id)?.full_name;

  const verify = async (p: Payment) => {
    const { error } = await db!.rpc('fulfil_payment', { p_payment_id: p.id });
    if (error) return flash('error', error.message);
    flash('ok', p.kind.startsWith('membership') ? 'Payment verified and membership extended.' : 'Payment verified.');
    load();
  };
  const reject = async (p: Payment) => {
    const reason = prompt('Why is this transfer being rejected? (shown to the treasurer only)');
    if (reason === null) return;
    const { error } = await db!.from('payments').update({ status: 'rejected', rejection_reason: reason, reviewed_at: new Date().toISOString() }).eq('id', p.id);
    if (error) return flash('error', error.message);
    flash('ok', 'Payment rejected.');
    load();
  };

  const record = async (e: React.FormEvent) => {
    e.preventDefault();
    const cents = parseMoneyToCents(form.amount);
    if (cents === null) return flash('error', 'Enter a valid amount, e.g. 25 or 25.50');
    const isMembership = form.type === 'membership';
    if (isMembership && (!form.member_id || !form.plan_id)) return flash('error', 'Choose the member and plan.');
    const plan = plans.find(p => p.id === form.plan_id);
    const { data, error } = await db!.from('payments').insert({
      club_id: club.id,
      kind: isMembership ? 'membership_renewal' : 'income_other',
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
    flash('ok', 'Income recorded.');
    setForm(blank);
    setAdding(false);
    load();
  };

  return (
    <div className="stack">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        <select data-view-ok className="form-select" style={{ width: 'auto' }} value={status} onChange={e => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="all">All statuses</option>
          {Object.keys(STATUS_COLOR).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <select data-view-ok className="form-select" style={{ width: 'auto' }} value={kind} onChange={e => setKind(e.target.value)} aria-label="Filter by type">
          <option value="all">All types</option>
          {Object.entries(PAYMENT_KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button type="button" className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setAdding(a => !a)}><Plus size={16} /> Record income</button>
      </div>

      {adding && (
        <form onSubmit={record} className="glass-panel" style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '0.75rem' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="inc-type">Type</label>
            <select id="inc-type" className="form-select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              <option value="other">General income</option>
              <option value="membership">Membership payment (extends expiry)</option>
            </select>
          </div>
          {form.type === 'membership' ? (
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
          <div className="form-group">
            <label className="form-label" htmlFor="inc-desc">Description</label>
            <input id="inc-desc" className="form-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="inc-amount">Amount ({currency})</label>
            <input id="inc-amount" className="form-input" inputMode="decimal" required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="inc-method">Method</label>
            <select id="inc-method" className="form-select" value={form.method} onChange={e => setForm({ ...form, method: e.target.value })}>
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="other">Other</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary" style={{ alignSelf: 'end' }}><Save size={16} /> Save</button>
        </form>
      )}

      <div className="glass-panel admin-table-container">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{['Date', 'Type', 'Description', 'Payer', 'Method', 'Amount', 'Status', ''].map(h => <th key={h} style={{ ...cell, color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} style={{ ...cell, color: 'var(--text-muted)' }}>No payments yet.</td></tr>}
            {rows.map(p => (
              <tr key={p.id}>
                <td style={cell}>{(p.paid_at || p.created_at).slice(0, 10)}</td>
                <td style={cell}>{p.kind === 'income_other' ? INCOME_CATEGORIES[p.category] : PAYMENT_KIND_LABEL[p.kind]}</td>
                <td style={cell}>{p.description}{p.reference && <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Ref {p.reference}</div>}</td>
                <td style={cell}>{p.payer_name}{p.payer_email && <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{p.payer_email}</div>}</td>
                <td style={cell}>{PAYMENT_METHOD_LABEL[p.method]}</td>
                <td style={{ ...cell, fontWeight: 800 }}>{formatMoney(p.amount_cents, p.currency)}</td>
                <td style={cell}>
                  <span style={{ color: STATUS_COLOR[p.status], fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase' }}>{p.status.replace('_', ' ')}</span>
                  {p.rejection_reason && <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{p.rejection_reason}</div>}
                </td>
                <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                  {p.receipt_key && <button data-view-ok type="button" className="btn btn-secondary btn-sm" onClick={() => openReceipt('payment', p.id)} title="View receipt"><FileText size={14} /> Receipt</button>}
                  {p.status === 'awaiting_review' && (
                    <>
                      <button type="button" className="btn btn-primary btn-sm" style={{ marginLeft: 4 }} onClick={() => verify(p)}><CheckCircle2 size={14} /> Verify</button>
                      <button type="button" className="btn btn-danger btn-sm" style={{ marginLeft: 4 }} onClick={() => reject(p)}><XCircle size={14} /> Reject</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-note">
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
      <button type="button" className="btn btn-primary" style={{ alignSelf: 'flex-end' }} onClick={() => { setForm(blank); setOpen(o => !o); }}><Plus size={16} /> Add expense</button>

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

      <div className="glass-panel admin-table-container">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{['Date', 'Category', 'Description', 'Paid to', 'Amount', ''].map(h => <th key={h} style={{ ...cell, color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {expenses.length === 0 && <tr><td colSpan={6} style={{ ...cell, color: 'var(--text-muted)' }}>No expenses yet.</td></tr>}
            {expenses.map(e => (
              <tr key={e.id}>
                <td style={cell}>{e.spent_on}</td>
                <td style={cell}>{EXPENSE_CATEGORIES[e.category] || e.category}</td>
                <td style={cell}>
                  {e.description}
                  {e.paid_by_member_id && (
                    <div style={{ fontSize: '0.75rem', color: e.reimbursed ? 'var(--text-muted)' : 'var(--c-amber)' }}>
                      Paid by {members.find(m => m.id === e.paid_by_member_id)?.full_name || 'member'}: {e.reimbursed ? 'reimbursed' : 'to reimburse'}
                    </div>
                  )}
                </td>
                <td style={cell}>{e.vendor}</td>
                <td style={{ ...cell, fontWeight: 800 }}>{formatMoney(e.amount_cents, e.currency)}</td>
                <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                  {e.receipt_key && <button data-view-ok type="button" className="btn btn-secondary btn-sm" onClick={() => openReceipt('expense', e.id)}><FileText size={14} /></button>}
                  <button type="button" className="btn btn-secondary btn-sm" style={{ marginLeft: 4 }} onClick={() => edit(e)}>Edit</button>
                  <button data-needs-full type="button" className="btn btn-danger btn-sm" style={{ marginLeft: 4 }} onClick={() => remove(e)} aria-label="Delete expense"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-note">Total shown: {money(expenses.reduce((n, e) => n + e.amount_cents, 0))}</p>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
function SettingsTab({ club, db, load, flash, settings, plans, packages }: Shared & {
  settings: ClubPaymentSettings | null; plans: MembershipPlan[]; packages: SponsorshipPackage[];
}) {
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

  const stripeState = settings?.stripe_charges_enabled ? 'connected' : settings?.stripe_account_id ? 'incomplete' : 'none';

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

      <PriceList<MembershipPlan>
        title="Membership plans" table="membership_plans" rows={plans} db={db} clubId={club.id} flash={flash} load={load}
        blank={{ name: 'New plan', price_cents: 0, duration_months: 12 }}
        extra={(row, set) => (
          <input className="form-input" type="number" min={1} max={60} style={{ width: 80 }} aria-label="Months"
            value={row.duration_months} onChange={e => set({ duration_months: Number(e.target.value) })} />
        )}
        extraLabel="Months"
      />
      <PriceList<SponsorshipPackage>
        title="Sponsorship packages" table="sponsorship_packages" rows={packages} db={db} clubId={club.id} flash={flash} load={load}
        blank={{ name: 'New package', price_cents: 0, tier: 'gold' as SponsorTier }}
        extra={(row, set) => (
          <select className="form-select" style={{ width: 130 }} aria-label="Tier" value={row.tier} onChange={e => set({ tier: e.target.value as SponsorTier })}>
            {['platinum', 'gold', 'silver', 'bronze', 'grassroots'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        extraLabel="Tier"
        textField="benefits"
      />
      <p className="text-note">
        Public sign-up pages: <a href={`/${club.slug}/member`}>/{club.slug}/member</a> and <a href={`/${club.slug}/sponsor`}>/{club.slug}/sponsor</a>
      </p>
    </div>
  );
}

// Editable price rows shared by membership plans and sponsorship packages
function PriceList<T extends { id: string; name: string; price_cents: number; is_active: boolean; sort_order: number; benefits?: string | null; description?: string | null }>({
  title, table, rows, db, clubId, flash, load, blank, extra, extraLabel, textField = 'description',
}: {
  title: string; table: string; rows: T[]; db: Shared['db']; clubId: string; flash: Shared['flash']; load: () => Promise<void>;
  blank: Partial<T>; extra: (row: T, set: (patch: Partial<T>) => void) => React.ReactNode; extraLabel: string; textField?: 'description' | 'benefits';
}) {
  const [draft, setDraft] = useState<Record<string, T>>({});
  const [prices, setPrices] = useState<Record<string, string>>({});
  useEffect(() => { setDraft(Object.fromEntries(rows.map(r => [r.id, r]))); setPrices(Object.fromEntries(rows.map(r => [r.id, (r.price_cents / 100).toFixed(2)]))); }, [rows]);

  const add = async () => {
    const { error } = await db!.from(table).insert({ ...blank, club_id: clubId, sort_order: rows.length });
    if (error) return flash('error', error.message);
    load();
  };
  const save = async (id: string) => {
    const cents = parseMoneyToCents(prices[id] || '');
    if (cents === null) return flash('error', 'Enter a valid price, e.g. 50 or 49.99');
    const row: Record<string, unknown> = { ...draft[id], price_cents: cents };
    delete row.id;
    delete row.created_at;
    const { error } = await db!.from(table).update(row).eq('id', id);
    if (error) return flash('error', error.message);
    flash('ok', `${draft[id].name} saved.`);
    load();
  };
  const remove = async (id: string) => {
    if (!(await confirmAction({ title: 'Delete this?', message: 'Past payments keep their amounts. Untick "active" instead to just hide it.', confirmLabel: 'Delete', danger: true }))) return;
    const { error } = await db!.from(table).delete().eq('id', id);
    if (error) return flash('error', error.message);
    load();
  };

  return (
    <div className="glass-panel" style={{ padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h3 style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{title}</h3>
        <button type="button" className="btn btn-secondary btn-sm" onClick={add}><Plus size={14} /> Add</button>
      </div>
      {rows.length === 0 && <p className="text-note">None yet.</p>}
      <div className="stack stack-sm">
        {rows.map(r => {
          const row = draft[r.id] || r;
          const set = (patch: Partial<T>) => setDraft(d => ({ ...d, [r.id]: { ...row, ...patch } }));
          return (
            <div key={r.id} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-subtle)' }}>
              <input className="form-input" style={{ flex: '1 1 180px' }} aria-label="Name" value={row.name} onChange={e => set({ name: e.target.value } as Partial<T>)} />
              <input className="form-input" style={{ width: 110 }} aria-label="Price" inputMode="decimal" value={prices[r.id] ?? ''} onChange={e => setPrices(p => ({ ...p, [r.id]: e.target.value }))} />
              <span title={extraLabel}>{extra(row, set)}</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.82rem' }}>
                <input type="checkbox" checked={row.is_active} onChange={e => set({ is_active: e.target.checked } as Partial<T>)} /> Active
              </label>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => save(r.id)}><Save size={14} /></button>
              <button data-needs-full type="button" className="btn btn-danger btn-sm" onClick={() => remove(r.id)} aria-label="Delete"><Trash2 size={14} /></button>
              <textarea className="form-textarea" rows={2} style={{ flexBasis: '100%' }} aria-label={textField === 'benefits' ? 'Benefits' : 'Description'}
                placeholder={textField === 'benefits' ? 'Benefits (logo on kit, website, matchday banner…)' : 'Short description (optional)'}
                value={(row[textField] as string) || ''} onChange={e => set({ [textField]: e.target.value } as Partial<T>)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
