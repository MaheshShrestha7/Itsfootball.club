'use client';

import React, { useMemo, useState } from 'react';
import { Bell, CheckCircle2, ChevronDown, ChevronRight, Copy, FileText, Plus, Send, Undo2, UserX, XCircle } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import { DATE_LOCALE } from '@/lib/dates';
import { canReopenFee, feeRequestGroups, FEE_CATEGORIES, matchesSearch, type FeeRequestGroup } from '@/lib/fee-requests';
import { formatMoney, parseMoneyToCents } from '@/lib/finance';
import { siteToday } from '@/lib/member-prices';
import { openReceipt } from '@/lib/receipts';
import { getAccessToken } from '@/lib/supabase/client';
import type { Payment } from '@/lib/supabase/types';
import { clubTeamsOf, teamMemberIds } from '@/lib/teams';
import { confirmAction } from '@/components/ConfirmDialog';

interface Props {
  club: { id: string; slug: string; name: string };
  currency: string;
  money: (cents: number) => string;
  load: () => Promise<void>;
  flash: (type: 'ok' | 'error', text: string) => void;
  payments: Payment[];
  /** Card or bank details are set up, so a bill can be paid online */
  canPayOnline: boolean;
  /** Open the Income tab, where bank transfer receipts are verified */
  onCheckReceipts: () => void;
}

const shortDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short' });
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const inAWeek = () => {
  const d = new Date(`${siteToday()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
};

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getAccessToken()}` },
    body: JSON.stringify(body),
  }).catch(() => null);
  const json = await res?.json().catch(() => ({})) ?? {};
  return { ok: !!res?.ok, json };
}

/** What happened to the emails, in a sentence */
function emailSummary(json: { emailed?: number; notEmailed?: number; alreadySent?: number; error?: string }, verb: string) {
  const parts = [`${verb} ${plural(json.emailed || 0, 'person', 'people')} by email.`];
  if (json.alreadySent) parts.push(`${plural(json.alreadySent, 'person', 'people')} already had one today.`);
  if (json.notEmailed) parts.push(`${json.notEmailed} couldn't be emailed: use Copy link for ${json.notEmailed === 1 ? 'them' : 'those'}.`);
  return json.error && !json.emailed ? `Saved. ${json.error}` : parts.join(' ');
}

export default function FeeRequestsTab({ club, currency, money, load, flash, payments, canPayOnline, onCheckReceipts }: Props) {
  const { members, clubTeams, clubTeamMembers } = useClub();
  const today = siteToday();
  const groups = useMemo(() => feeRequestGroups(payments, today), [payments, today]);
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // What's typed in each open request's search box
  const [searches, setSearches] = useState<Record<string, string>>({});

  const people = useMemo(() => members
    .filter(m => m.club_id === club.id && (m.membership_status || 'approved') === 'approved' && m.status !== 'alumni')
    .sort((a, b) => a.full_name.localeCompare(b.full_name)), [members, club.id]);
  const teams = clubTeamsOf(clubTeams, club.id);
  const nameOf = (p: Payment) => members.find(m => m.id === p.member_id)?.full_name || p.payer_name || 'Former member';

  const settle = async (body: Record<string, string>, done: string) => {
    setBusy(true);
    const { ok, json } = await post('/api/payments/fee-requests/settle', { clubId: club.id, ...body });
    setBusy(false);
    if (!ok) return flash('error', json.error || 'That didn\'t work. Please try again.');
    flash('ok', done);
    await load();
  };

  const remind = async (group: FeeRequestGroup) => {
    setBusy(true);
    const { ok, json } = await post('/api/payments/fee-requests/remind', { clubId: club.id, requestId: group.id });
    setBusy(false);
    flash(ok ? 'ok' : 'error', ok ? emailSummary(json, 'Reminded') : json.error || 'Reminders could not be sent.');
  };

  const close = async (group: FeeRequestGroup) => {
    if (!(await confirmAction({
      title: `Close "${group.title}"?`,
      message: `${plural(group.unpaidCount, 'person', 'people')} who haven't paid will no longer owe this, and their links stop working. Anyone who already paid is not affected.`,
      confirmLabel: 'Close request', danger: true,
    }))) return;
    await settle({ requestId: group.id, action: 'close' }, 'Request closed.');
  };

  const copyLink = async (p: Payment) => {
    const link = `${window.location.origin}/${club.slug}/pay/${p.id}`;
    await navigator.clipboard?.writeText(link).then(
      () => flash('ok', `Link for ${nameOf(p)} copied. Send it to them however suits.`),
      () => flash('error', link)
    );
  };

  return (
    <div className="stack">
      <div className="admin-toolbar" style={{ marginBottom: 0 }}>
        <p className="admin-note" style={{ margin: 0 }}>Ask a team or anyone at the club for money. Each person gets their own link to pay.</p>
        <button type="button" className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setAdding(a => !a)} aria-expanded={adding}><Plus size={16} aria-hidden="true" /> New request</button>
      </div>

      {!canPayOnline && (
        <div className="admin-flash is-error" role="status">
          <XCircle size={16} aria-hidden="true" />
          <span>Nobody can pay online yet. Connect Stripe or add your bank details under Settings. You can still send requests and mark cash as paid.</span>
        </div>
      )}

      {adding && (
        <NewRequest people={people} teams={teams} teamMembers={clubTeamMembers} currency={currency} clubId={club.id}
          onSent={async text => { setAdding(false); flash('ok', text); await load(); }} onError={text => flash('error', text)} />
      )}

      {groups.length === 0 && !adding && <p className="admin-table-foot">No fee requests yet.</p>}

      {groups.map(g => {
        const isOpen = expanded === g.id;
        const percent = g.rows.length ? Math.round((g.paidCount / (g.rows.length - g.excusedCount || 1)) * 100) : 0;
        const search = searches[g.id] || '';
        const shown = g.rows.filter(p => matchesSearch(search, nameOf(p), p.payer_name, p.payer_email));
        return (
          <section key={g.id} className="admin-panel" aria-label={g.title}>
            <div className="admin-panel-head" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
              <button data-view-ok type="button" onClick={() => setExpanded(isOpen ? null : g.id)} aria-expanded={isOpen}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'inherit', font: 'inherit', textAlign: 'left', minHeight: 44 }}>
                {isOpen ? <ChevronDown size={18} aria-hidden="true" /> : <ChevronRight size={18} aria-hidden="true" />}
                <h2 style={{ margin: 0 }}>{g.title}</h2>
              </button>
              <span className="admin-meta">
                {formatMoney(g.amountCents, g.currency)} each, {g.overdue ? 'was due' : 'due'} {g.dueOn ? shortDate(g.dueOn) : 'soon'}
              </span>
              {g.overdue && <span className="admin-pill is-danger">Overdue</span>}
            </div>
            <div className="admin-section">
              <div className="admin-bar-row">
                <span>{g.paidCount} of {g.rows.length - g.excusedCount} paid{g.excusedCount ? `, ${g.excusedCount} excused` : ''}</span>
                <b>{formatMoney(g.paidCents, g.currency)} in{g.unpaidCents ? `, ${formatMoney(g.unpaidCents, g.currency)} to come` : ''}</b>
              </div>
              <div className="admin-bar-track"><span style={{ transform: `scaleX(${percent / 100})` }} /></div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.85rem' }}>
                {g.unpaidCount > 0 && (
                  <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => remind(g)}>
                    <Bell size={14} aria-hidden="true" /> Remind {plural(g.unpaidCount, 'person', 'people')}
                  </button>
                )}
                {g.toCheckCount > 0 && (
                  <button data-view-ok type="button" className="btn btn-secondary btn-sm" onClick={onCheckReceipts}>
                    <FileText size={14} aria-hidden="true" /> {plural(g.toCheckCount, 'receipt')} to check
                  </button>
                )}
                {g.unpaidCount > 0 && (
                  <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => close(g)}>Close request</button>
                )}
              </div>
            </div>
            {isOpen && (
              <div className="admin-table-wrap">
                <div className="admin-section" style={{ paddingTop: 0 }}>
                  <input data-view-ok type="search" className="form-input" aria-label={`Search people in ${g.title}`} placeholder="Search by name or email"
                    value={search} onChange={e => setSearches(s => ({ ...s, [g.id]: e.target.value }))} />
                </div>
                <table className="admin-table">
                  <thead><tr><th scope="col">Person</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
                  <tbody>
                    {shown.length === 0 && <tr><td colSpan={3}>Nobody matches that search.</td></tr>}
                    {[...shown]
                      .sort((a, b) => Number(a.status === 'paid') - Number(b.status === 'paid') || nameOf(a).localeCompare(nameOf(b)))
                      .map(p => (
                        <tr key={p.id}>
                          <td className="is-strong">{nameOf(p)}{p.payer_email ? <small>{p.payer_email}</small> : <small style={{ color: 'var(--color-warn)' }}>No email: copy the link</small>}</td>
                          <td><StatusPill p={p} today={today} /></td>
                          <td className="is-actions">
                            {p.receipt_key && <button data-view-ok type="button" className="btn btn-secondary btn-sm" onClick={() => openReceipt('payment', p.id)} aria-label={`View receipt from ${nameOf(p)}`}><FileText size={14} aria-hidden="true" /></button>}
                            {p.status === 'pending' && (
                              <>
                                <button data-view-ok type="button" className="btn btn-secondary btn-sm" onClick={() => copyLink(p)}><Copy size={14} aria-hidden="true" /> Copy link</button>
                                <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => settle({ paymentId: p.id, action: 'cash' }, `${nameOf(p)} marked as paid in cash.`)}><CheckCircle2 size={14} aria-hidden="true" /> Paid in cash</button>
                                <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => settle({ paymentId: p.id, action: 'excuse' }, `${nameOf(p)} excused.`)}><UserX size={14} aria-hidden="true" /> Excuse</button>
                              </>
                            )}
                            {canReopenFee(p) && (
                              <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => settle({ paymentId: p.id, action: 'reopen' }, `${nameOf(p)} owes this again.`)}><Undo2 size={14} aria-hidden="true" /> Undo</button>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
      {groups.length > 0 && <p className="admin-table-foot">Paid so far: {money(groups.reduce((n, g) => n + g.paidCents, 0))}. Card payments and checked transfers mark themselves as paid.</p>}
    </div>
  );
}

function StatusPill({ p, today }: { p: Payment; today: string }) {
  if (p.status === 'paid') return <span className="admin-pill is-ok">Paid{p.method === 'cash' ? ' in cash' : p.method === 'stripe' ? ' by card' : ''}</span>;
  if (p.status === 'awaiting_review') return <span className="admin-pill is-warn">Receipt to check</span>;
  if (p.status === 'rejected') return <span className="admin-pill">Excused</span>;
  if (p.status === 'refunded') return <span className="admin-pill">Refunded</span>;
  return <span className={`admin-pill ${p.due_on && p.due_on < today ? 'is-danger' : 'is-warn'}`}>{p.due_on && p.due_on < today ? 'Overdue' : 'Not paid'}</span>;
}

function NewRequest({ people, teams, teamMembers, currency, clubId, onSent, onError }: {
  people: { id: string; full_name: string }[];
  teams: { id: string; name: string }[];
  teamMembers: Parameters<typeof teamMemberIds>[0];
  currency: string;
  clubId: string;
  onSent: (text: string) => Promise<void>;
  onError: (text: string) => void;
}) {
  const [form, setForm] = useState({ title: '', amount: '', dueOn: inAWeek(), category: 'match_fees', message: '' });
  const [source, setSource] = useState('');
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const known = new Set(people.map(p => p.id));
  // Only narrows what's listed: anyone already ticked stays ticked, and the Send button counts them
  const listed = people.filter(p => matchesSearch(search, p.full_name));

  const chooseSource = (value: string) => {
    setSource(value);
    if (value === 'everyone') setPicked(new Set(known));
    else if (value === '') setPicked(new Set());
    // Players only: coaches and helpers can be ticked below if they pay too
    else setPicked(new Set(teamMemberIds(teamMembers, value).filter(id => known.has(id))));
  };
  const toggle = (id: string) => setPicked(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const cents = parseMoneyToCents(form.amount);
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cents === null) return onError('Enter a valid amount, e.g. 15 or 15.50');
    if (!picked.size) return onError('Choose who this is for.');
    setSending(true);
    const { ok, json } = await post('/api/payments/fee-requests', {
      clubId, title: form.title, amountCents: cents, dueOn: form.dueOn, category: form.category, message: form.message, memberIds: [...picked],
    });
    setSending(false);
    if (!ok) return onError(json.error || 'The request could not be sent.');
    await onSent(emailSummary(json, 'Sent to'));
  };

  return (
    <form onSubmit={send} className="glass-panel" style={{ padding: '1.25rem', display: 'grid', gap: '0.75rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '0.75rem' }}>
        <div className="form-group">
          <label className="form-label" htmlFor="fee-title">What is it for?</label>
          <input id="fee-title" className="form-input" required maxLength={120} placeholder="Match fee, Saturday v Rovers" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="fee-amount">Amount each ({currency})</label>
          <input id="fee-amount" className="form-input" inputMode="decimal" required placeholder="15.00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="fee-due">Due by</label>
          <input id="fee-due" type="date" className="form-input" required min={siteToday()} value={form.dueOn} onChange={e => setForm({ ...form, dueOn: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="fee-category">Category</label>
          <select id="fee-category" className="form-select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
            {Object.entries(FEE_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="fee-message">Message in the email (optional)</label>
        <textarea id="fee-message" className="form-input" rows={2} maxLength={1000} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} />
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="fee-source">Who is it for?</label>
        <select id="fee-source" className="form-select" value={source} onChange={e => chooseSource(e.target.value)}>
          <option value="">Pick people below</option>
          <option value="everyone">Everyone at the club</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name} players</option>)}
        </select>
      </div>
      <input type="search" className="form-input" aria-label="Search people to ask" placeholder={`Search by name, ${picked.size} ticked`}
        value={search} onChange={e => setSearch(e.target.value)}
        // Enter here looks for a name; it must not send the request
        onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }} />
      <fieldset style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '0.5rem 0.75rem', maxHeight: 260, overflowY: 'auto', margin: 0 }}>
        <legend className="sr-only">People to ask</legend>
        {people.length === 0 && <p className="admin-note">Nobody at the club yet.</p>}
        {people.length > 0 && listed.length === 0 && <p className="admin-note">Nobody matches that search.</p>}
        {listed.map(p => (
          <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minHeight: 36, fontSize: '0.9rem' }}>
            <input type="checkbox" checked={picked.has(p.id)} onChange={() => toggle(p.id)} /> {p.full_name}
          </label>
        ))}
      </fieldset>
      <button type="submit" className="btn btn-primary" disabled={sending || !picked.size} style={{ justifySelf: 'start' }}>
        <Send size={16} aria-hidden="true" />{' '}
        {sending ? 'Sending…' : picked.size
          ? `Send to ${plural(picked.size, 'person', 'people')}${cents ? `, ${formatMoney(cents * picked.size, currency)} in total` : ''}`
          : 'Choose who it’s for'}
      </button>
    </form>
  );
}
