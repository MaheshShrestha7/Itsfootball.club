'use client';

import React, { use, useCallback, useEffect, useMemo, useState } from 'react';
import { useClub } from '@/lib/club-context';
import { getAccessToken } from '@/lib/supabase/client';
import { DEFAULT_ROUNDUP_DAY, REMINDER_SETTINGS, ROUNDUP_DAYS, type EmailSettings, type ReminderSetting } from '@/lib/email/settings';
import { emailKindLabel } from '@/lib/email/kinds';
import { Mail, Send, Eye, AlertTriangle, CheckCircle2, History, CalendarDays, Calendar, Newspaper, RefreshCw, ChevronRight, Search } from 'lucide-react';

type NoticeKind = 'renewal' | 'match' | 'event' | 'news';

interface Overview {
  settings: EmailSettings;
  ready: { resend: boolean; unsubscribe: boolean; database: boolean };
  optOuts: number;
  history: HistoryLine[];
}

interface HistoryLine { kind: string; subject: string; sentAt: string; recipients: number; to?: { email: string; subject: string; at: string }[] }

interface Preview {
  label: string;
  recipients: number;
  optedOut: number;
  alreadySent: number;
  noEmail: number;
  /** Phones/browsers following the club that also get it as a push notification */
  followers: number;
  preview: { subject: string; html: string } | null;
}

const NOTICE_TYPES: { kind: NoticeKind; label: string; icon: React.ElementType; hint: string }[] = [
  { kind: 'match', label: 'Upcoming match', icon: CalendarDays, hint: 'Fixture details and a link to the match centre.' },
  { kind: 'event', label: 'Upcoming event', icon: Calendar, hint: 'Event details and a link to register.' },
  { kind: 'news', label: 'News article', icon: Newspaper, hint: 'The headline, summary and cover image, linking to your news.' },
  { kind: 'renewal', label: 'Membership renewal', icon: RefreshCw, hint: 'To members whose membership expires in the next 30 days or lapsed in the last 60.' },
];

const HISTORY_LABELS: Record<string, string> = {
  availability: 'Availability reminders',
  event: 'Event reminders',
  renewal: 'Renewal reminders',
  notice_renewal: 'Renewal notices',
  notice_match: 'Match notice',
  notice_event: 'Event notice',
  notice_news: 'News notice',
};

/** The automatic emails, grouped by who gets them; each key's label and description is in REMINDER_SETTINGS */
const GROUPS: { title: string; keys: ReminderSetting[]; receipts?: boolean }[] = [
  { title: 'For your admins', keys: ['admin_summary'] },
  { title: 'For players and members', keys: ['availability_reminders', 'event_reminders', 'renewal_reminders', 'fee_reminders', 'weekly_roundup'], receipts: true },
  { title: 'For sponsors', keys: ['sponsor_renewal_reminders'] },
];
type AutoPreview = 'admin_summary' | 'fee_reminders' | 'weekly_roundup' | 'receipt';
const PREVIEWABLE: Partial<Record<ReminderSetting, AutoPreview>> = { admin_summary: 'admin_summary', fee_reminders: 'fee_reminders', weekly_roundup: 'weekly_roundup' };
const NEW_KEYS: ReminderSetting[] = ['admin_summary', 'fee_reminders', 'weekly_roundup'];

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
const fmtDate = (iso: string) => new Date(iso).toLocaleString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

async function api(method: 'GET' | 'PATCH' | 'POST', body?: object, query = '') {
  const token = await getAccessToken();
  const res = await fetch(`/api/admin/emails${query}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }).catch(() => null);
  const data = res ? await res.json().catch(() => ({})) : {};
  return { ok: !!res?.ok, data, error: res ? data.error : 'Network error. Check your connection.' };
}

function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="touch-target"
      style={{
        flexShrink: 0,
        width: '48px',
        height: '28px',
        borderRadius: '999px',
        border: '1px solid var(--border-medium)',
        background: checked ? 'var(--club-primary)' : 'color-mix(in oklab, var(--color-ink) 10%, transparent)',
        position: 'relative',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background-color 0.2s ease',
      }}
    >
      <span style={{
        position: 'absolute',
        top: '3px',
        left: checked ? '23px' : '3px',
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        background: 'var(--color-print)',
        boxShadow: 'var(--shadow-pop)',
        transition: 'left 0.2s var(--ease-out)',
      }} />
    </button>
  );
}

export default function AdminEmailsPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const { clubs, selectClubBySlug, matches, events, news, members } = useClub();
  const club = selectClubBySlug(clubSlug) || clubs[0];

  const [overview, setOverview] = useState<Overview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<ReminderSetting | 'weekly_roundup_day' | null>(null);
  const [autoPreview, setAutoPreview] = useState<{ which: AutoPreview; subject?: string; html?: string; empty?: string; loading?: boolean } | null>(null);

  const [kind, setKind] = useState<NoticeKind>('match');
  const [refId, setRefId] = useState('');
  const [audience, setAudience] = useState<'members' | 'players'>('members');
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<'preview' | 'send' | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    const r = await api('GET', undefined, `?clubId=${encodeURIComponent(club.id)}`);
    if (r.ok) setOverview(r.data);
    else setLoadError(r.error || 'Could not load email settings.');
  }, [club.id]);

  useEffect(() => { load(); }, [load]);

  const upcomingMatches = useMemo(() => matches
    .filter(m => m.club_id === club.id && !['completed', 'cancelled'].includes(m.status) && new Date(m.match_date).getTime() > Date.now() - 3 * 3600000)
    .sort((a, b) => a.match_date.localeCompare(b.match_date)), [matches, club.id]);
  const upcomingEvents = useMemo(() => events
    .filter(e => e.club_id === club.id && new Date(e.start_time).getTime() > Date.now())
    .sort((a, b) => a.start_time.localeCompare(b.start_time)), [events, club.id]);
  const articles = useMemo(() => news
    .filter(n => n.club_id === club.id)
    .sort((a, b) => (b.published_at || '').localeCompare(a.published_at || ''))
    .slice(0, 30), [news, club.id]);

  const options: { id: string; label: string }[] =
    kind === 'match' ? upcomingMatches.map(m => ({ id: m.id, label: `${fmtDate(m.match_date)}, ${m.home_team_name} vs ${m.away_team_name}` }))
    : kind === 'event' ? upcomingEvents.map(e => ({ id: e.id, label: `${fmtDate(e.start_time)}, ${e.title}` }))
    : kind === 'news' ? articles.map(n => ({ id: n.id, label: n.title }))
    : [];

  // A different notice invalidates the preview
  useEffect(() => { setPreview(null); setFeedback(null); }, [kind, refId, audience, message]);
  useEffect(() => { setRefId(''); }, [kind]);

  const toggle = async (key: ReminderSetting, value: boolean) => {
    if (!overview) return;
    setSavingKey(key);
    setOverview({ ...overview, settings: { ...overview.settings, [key]: value } });
    const r = await api('PATCH', { clubId: club.id, settings: { [key]: value } });
    if (r.ok) setOverview(o => (o ? { ...o, settings: r.data.settings } : o));
    else {
      setOverview(o => (o ? { ...o, settings: { ...o.settings, [key]: !value } } : o));
      setFeedback({ type: 'error', text: r.error || 'Could not save.' });
    }
    setSavingKey(null);
  };

  const saveRoundupDay = async (day: number) => {
    if (!overview) return;
    const before = overview.settings.weekly_roundup_day;
    setSavingKey('weekly_roundup_day');
    setOverview({ ...overview, settings: { ...overview.settings, weekly_roundup_day: day } });
    const r = await api('PATCH', { clubId: club.id, settings: { weekly_roundup_day: day } });
    if (r.ok) setOverview(o => (o ? { ...o, settings: r.data.settings } : o));
    else {
      setOverview(o => (o ? { ...o, settings: { ...o.settings, weekly_roundup_day: before } } : o));
      setFeedback({ type: 'error', text: r.error || 'Could not save.' });
    }
    setSavingKey(null);
  };

  const showAutoPreview = async (which: AutoPreview) => {
    if (autoPreview?.which === which && !autoPreview.loading) return setAutoPreview(null);
    setAutoPreview({ which, loading: true });
    const r = await api('GET', undefined, `?clubId=${encodeURIComponent(club.id)}&preview=${which}`);
    setAutoPreview(r.ok ? { which, ...r.data } : { which, empty: r.error || 'Could not load the preview.' });
  };

  const previewBlock = (which: AutoPreview) => autoPreview?.which === which && (
    <div className="glass-panel" style={{ marginTop: '0.75rem', padding: '0.75rem', overflow: 'hidden' }}>
      {autoPreview.loading ? <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Preparing the preview...</p>
        : autoPreview.empty ? <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{autoPreview.empty}</p>
        : (
          <>
            <div style={{ fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-secondary)', overflowWrap: 'anywhere' }}>
              <strong className="text-primary">Subject:</strong> {autoPreview.subject}
              {(which === 'fee_reminders' || which === 'receipt') && <> (an example)</>}
            </div>
            <iframe title="Email preview" sandbox="" srcDoc={autoPreview.html} style={{ width: '100%', height: '560px', border: 0, background: 'var(--color-print-2)', display: 'block', borderRadius: '8px' }} />
          </>
        )}
    </div>
  );

  const previewLink = (which: AutoPreview) => (
    <button type="button" className="btn btn-outline btn-sm" onClick={() => showAutoPreview(which)} aria-expanded={autoPreview?.which === which}
      style={{ minHeight: '40px', display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
      <Eye size={14} aria-hidden="true" /> {autoPreview?.which === which ? 'Hide preview' : 'Preview'}
    </button>
  );

  const notice = () => ({ clubId: club.id, kind, refId: refId || undefined, audience, message: message.trim() || undefined });

  const runPreview = async () => {
    setBusy('preview');
    setFeedback(null);
    const r = await api('POST', notice());
    setBusy(null);
    if (r.ok) setPreview(r.data);
    else setFeedback({ type: 'error', text: r.error || 'Could not prepare the notice.' });
  };

  const send = async () => {
    setBusy('send');
    const r = await api('POST', { ...notice(), send: true });
    setBusy(null);
    if (r.ok) {
      const sent = r.data.sent ?? 0;
      const pushed = r.data.pushed ? ` Notified ${r.data.pushed} follower${r.data.pushed === 1 ? '' : 's'}.` : '';
      setFeedback({ type: 'success', text: (sent ? `Sent to ${sent} ${sent === 1 ? 'person' : 'people'}.` : 'Everyone already had this one. Nothing new to send.') + pushed });
      setPreview(null);
      load();
    } else {
      setFeedback({ type: 'error', text: r.error || 'Sending failed.' });
    }
  };

  const needsRef = kind !== 'renewal';
  const canPreview = !needsRef || !!refId;
  const ready = overview?.ready;
  const notReady = ready && (!ready.resend || !ready.database);

  return (
    <div style={{ maxWidth: '960px' }}>
      <div className="admin-head">
        <div>
          <h1>Emails</h1>
          <p>Automatic reminders and one-off notices to your members, sent from {club.name} through itsfootball.club.</p>
        </div>
      </div>

      {loadError && (
        <div role="alert" className="admin-flash is-error">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{loadError}</span>
        </div>
      )}

      {notReady && (
        <div className="glass-panel" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start', border: '1px solid var(--color-warn-line)' }}>
          <AlertTriangle size={20} aria-hidden="true" color="var(--color-warn)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            <strong className="text-primary">Email isn&apos;t fully set up yet.</strong>{' '}
            {!ready.database && 'The email tables haven\'t been added to the database. '}
            {!ready.resend && 'The email service key hasn\'t been configured. '}
            You can change settings and preview notices, but nothing will send until the platform admin finishes setup.
          </div>
        </div>
      )}

      {/* Automatic emails, grouped by who gets them */}
      <section className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: '0.25rem' }}>Automatic emails</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
          Sent every morning at about 8 am. Each person gets each email once. Switches start off until you turn them on.
        </p>
        {GROUPS.map(group => (
          <div key={group.title}>
            <h3 style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '1.1rem 0 0.1rem' }}>{group.title}</h3>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {group.keys.map((key, i) => {
                const s = REMINDER_SETTINGS.find(x => x.key === key)!;
                const previewable = PREVIEWABLE[key];
                return (
                  <div key={key} style={{ padding: '0.9rem 0', borderTop: i ? '1px solid var(--border-subtle)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {s.label}
                          {NEW_KEYS.includes(key) && <span className="admin-pill is-ok">New</span>}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{s.description}</div>
                        {(previewable || key === 'weekly_roundup') && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem 0.9rem', marginTop: '0.3rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {previewable && previewLink(previewable)}
                            {key === 'weekly_roundup' && (
                              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                                Send on
                                <select className="form-select" style={{ width: 'auto', minHeight: '40px', fontSize: '16px', padding: '0.25rem 2rem 0.25rem 0.6rem' }}
                                  value={overview?.settings.weekly_roundup_day ?? DEFAULT_ROUNDUP_DAY}
                                  disabled={!overview || savingKey === 'weekly_roundup_day'}
                                  onChange={e => saveRoundupDay(Number(e.target.value))}>
                                  {ROUNDUP_DAYS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                                </select>
                              </label>
                            )}
                          </div>
                        )}
                      </div>
                      <Switch
                        label={s.label}
                        checked={!!overview?.settings[key]}
                        disabled={!overview || savingKey === key}
                        onChange={v => toggle(key, v)}
                      />
                    </div>
                    {previewable && previewBlock(previewable)}
                  </div>
                );
              })}
              {group.receipts && (
                <div style={{ padding: '0.9rem 0', borderTop: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        Payment receipts <span className="admin-pill is-ok">New</span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        When someone pays for a membership, a fee request or a shop order, by card or by a bank transfer you check, they get a receipt. Ticket buyers and sponsors already get one.
                      </div>
                      <div style={{ marginTop: '0.3rem' }}>{previewLink('receipt')}</div>
                    </div>
                    <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      <CheckCircle2 size={16} aria-hidden="true" color="var(--color-success, #10b981)" /> Always sent
                    </span>
                  </div>
                  {previewBlock('receipt')}
                </div>
              )}
            </div>
          </div>
        ))}
      </section>

      {/* Manual notice */}
      <section className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: '0.25rem' }}>Send a notice</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
          Preview first: you&apos;ll see who it goes to and exactly what they&apos;ll receive. Nobody gets the same notice twice.
        </p>

        <div role="radiogroup" aria-label="Notice type" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))', gap: '0.6rem', marginBottom: '1.25rem' }}>
          {NOTICE_TYPES.map(t => {
            const active = kind === t.kind;
            const Icon = t.icon;
            return (
              <button
                key={t.kind}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setKind(t.kind)}
                style={{
                  textAlign: 'left',
                  padding: '0.85rem',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${active ? 'var(--club-primary)' : 'var(--border-subtle)'}`,
                  background: active ? 'color-mix(in oklab, var(--color-accent) 10%, transparent)' : 'color-mix(in oklab, var(--color-ink) 2%, transparent)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                <Icon size={18} aria-hidden="true" style={{ marginBottom: '0.35rem', color: active ? 'var(--color-accent-ink)' : 'var(--text-secondary)' }} />
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{t.label}</div>
              </button>
            );
          })}
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>{NOTICE_TYPES.find(t => t.kind === kind)?.hint}</p>

        {needsRef && (
          <div className="form-group">
            <label className="form-label" htmlFor="notice-ref">{kind === 'match' ? 'Match' : kind === 'event' ? 'Event' : 'Article'}</label>
            {options.length ? (
              <select id="notice-ref" className="form-select" value={refId} onChange={e => setRefId(e.target.value)}>
                <option value="">Choose…</option>
                {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            ) : (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {kind === 'match' ? 'No upcoming matches.' : kind === 'event' ? 'No upcoming events.' : 'No news articles yet.'}
              </p>
            )}
          </div>
        )}

        {kind === 'match' && (
          <fieldset className="form-group" style={{ border: 0 }}>
            <legend className="form-label" style={{ marginBottom: '0.4rem' }}>Send to</legend>
            <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
              {(['members', 'players'] as const).map(a => (
                <label key={a} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-primary)', fontSize: '0.9rem', cursor: 'pointer' }}>
                  <input type="radio" name="audience" checked={audience === a} onChange={() => setAudience(a)} />
                  {a === 'members' ? 'All members' : 'Players only'}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div className="form-group">
          <label className="form-label" htmlFor="notice-message">Personal message (optional)</label>
          <textarea
            id="notice-message"
            className="form-textarea"
            rows={3}
            maxLength={1000}
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="e.g. Big game this week, come and support the team!"
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" className="btn btn-secondary" disabled={!canPreview || !!busy} onClick={runPreview}>
            <Eye size={16} /> {busy === 'preview' ? 'Preparing...' : 'Preview'}
          </button>
          {preview && preview.recipients > 0 && (
            <button type="button" className="btn btn-primary" disabled={!!busy || !ready?.resend} onClick={send}>
              <Send size={16} /> {busy === 'send' ? 'Sending...' : `Send to ${preview.recipients} ${preview.recipients === 1 ? 'person' : 'people'}`}
            </button>
          )}
        </div>

        {feedback && (
          <div role="status" className={feedback.type === 'success' ? 'admin-flash' : 'admin-flash is-error'} style={{ marginTop: '1rem', marginBottom: 0 }}>
            {feedback.type === 'success' ? <CheckCircle2 size={16} aria-hidden="true" /> : <AlertTriangle size={16} aria-hidden="true" />} <span>{feedback.text}</span>
          </div>
        )}

        {preview && (
          <div style={{ marginTop: '1.25rem' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
              <strong className="text-primary">
                {preview.recipients ? `${preview.recipients} ${preview.recipients === 1 ? 'person' : 'people'} will get this.` : 'Nobody new to send this to.'}
              </strong>
              {preview.alreadySent > 0 && ` ${preview.alreadySent} already received it.`}
              {preview.optedOut > 0 && ` ${preview.optedOut} unsubscribed.`}
              {preview.noEmail > 0 && ` ${preview.noEmail} member${preview.noEmail === 1 ? ' has' : 's have'} no email address.`}
              {preview.followers > 0 && ` ${preview.followers} follower${preview.followers === 1 ? '' : 's'} also get a push notification (headline and link only).`}
            </div>
            {preview.preview && (
              <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <div style={{ padding: '0.6rem 0.9rem', fontSize: '0.85rem', background: 'color-mix(in oklab, var(--color-ink) 4%, transparent)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                  <strong className="text-primary">Subject:</strong> {preview.preview.subject}
                </div>
                <iframe title="Email preview" sandbox="" srcDoc={preview.preview.html} style={{ width: '100%', height: '640px', border: 0, background: 'var(--color-print-2)', display: 'block' }} />
              </div>
            )}
          </div>
        )}
      </section>

      {/* History */}
      <section className="glass-panel" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <History size={18} /> Recently sent
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
          {overview ? `${overview.optOuts} ${overview.optOuts === 1 ? 'person has' : 'people have'} unsubscribed from ${club.name} emails. Tap an email to see who got it.` : ' '}
        </p>
        {!overview?.history.length ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Mail size={16} /> No emails sent yet.
          </p>
        ) : (
          <EmailHistory history={overview.history} members={members} />
        )}
      </section>
    </div>
  );
}

/** Recently sent: tap a line to see who got it, or search a person to see every email they got */
function EmailHistory({ history, members }: { history: HistoryLine[]; members: { full_name: string; email?: string | null; guardian_email?: string | null }[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [q, setQ] = useState('');
  const names = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of members) {
      if (p.email) m.set(p.email.toLowerCase(), p.full_name);
      if (p.guardian_email && !m.has(p.guardian_email.toLowerCase())) m.set(p.guardian_email.toLowerCase(), `${p.full_name}'s guardian`);
    }
    return m;
  }, [members]);
  const nameOf = (email: string) => names.get(email.toLowerCase());

  const term = q.trim().toLowerCase();
  // shortcut: searches the emails behind the lines shown (latest 2,000 sends), page the API if clubs outgrow it
  const found = term ? history.flatMap(h => (h.to || [])
    .filter(t => t.email.toLowerCase().includes(term) || (nameOf(t.email) || '').toLowerCase().includes(term))
    .map(t => ({ ...t, kind: h.kind }))) : [];

  const row: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.1rem 1rem', padding: '0.5rem 0', borderTop: '1px solid var(--border-subtle)', fontSize: '0.85rem' };
  const list: React.CSSProperties = { listStyle: 'none', margin: '0 0 0.6rem', padding: '0.25rem 0 0.25rem 1rem', borderLeft: '2px solid var(--club-primary)' };

  return (
    <>
      <label style={{ position: 'relative', display: 'block', marginBottom: '0.75rem' }}>
        <Search size={16} aria-hidden="true" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input className="form-input" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Did someone get an email? Search a name or email"
          aria-label="Search who got emails" style={{ paddingLeft: '2.3rem', width: '100%' }} />
      </label>

      {term ? (
        found.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No emails to anyone matching &ldquo;{q.trim()}&rdquo; in this list.</p>
        ) : (
          <ul style={list} aria-label="Emails that match">
            {found.map((t, i) => (
              <li key={i} style={{ ...row, borderTop: i ? row.borderTop : 'none' }}>
                <b style={{ color: 'var(--text-primary)' }}>{nameOf(t.email) || t.email}</b>
                <time dateTime={t.at} style={{ gridRow: '1 / span 2', gridColumn: 2, alignSelf: 'center', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fmtDate(t.at)}</time>
                <span style={{ color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>{emailKindLabel(t.kind)}{t.subject ? `: ${t.subject}` : ''}{nameOf(t.email) ? ` (${t.email})` : ''}</span>
              </li>
            ))}
          </ul>
        )
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {history.map((h, i) => {
            const isOpen = open === i;
            const to = h.to || [];
            return (
              <React.Fragment key={i}>
                <button type="button" aria-expanded={isOpen} onClick={() => { setOpen(isOpen ? null : i); setShowAll(false); }}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', padding: '0.7rem 0', border: 0, borderTop: i ? '1px solid var(--border-subtle)' : 'none', background: 'none', color: 'inherit', font: 'inherit', textAlign: 'left', cursor: 'pointer', width: '100%' }}>
                  <div className="min-w-0">
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{HISTORY_LABELS[h.kind] || emailKindLabel(h.kind)}</div>
                    {h.subject && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.subject}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    <div>
                      <div>{h.recipients} {h.recipients === 1 ? 'recipient' : 'recipients'}</div>
                      <div className="text-muted">{fmtDate(h.sentAt)}</div>
                    </div>
                    <ChevronRight size={16} aria-hidden="true" style={{ color: 'var(--text-muted)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                  </div>
                </button>
                {isOpen && (
                  <ul style={list} aria-label={`Who got ${HISTORY_LABELS[h.kind] || emailKindLabel(h.kind)}`}>
                    {(showAll ? to : to.slice(0, 8)).map((t, j) => (
                      <li key={j} style={{ ...row, borderTop: j ? row.borderTop : 'none' }}>
                        <b style={{ color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{nameOf(t.email) || t.email}</b>
                        <time dateTime={t.at} style={{ gridRow: '1 / span 2', gridColumn: 2, alignSelf: 'center', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fmtTime(t.at)}</time>
                        <span style={{ color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>{nameOf(t.email) ? t.email : 'Not on the members list'}</span>
                      </li>
                    ))}
                    {!showAll && to.length > 8 && (
                      <li style={{ paddingTop: '0.5rem' }}>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAll(true)}>Show all {to.length}</button>
                      </li>
                    )}
                  </ul>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}
      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0.75rem 0 0' }}>
        This shows that an email went out. Whether it reached the inbox or bounced is in the platform&apos;s Resend account.
      </p>
    </>
  );
}
