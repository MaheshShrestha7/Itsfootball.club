'use client';

import React, { use, useCallback, useEffect, useMemo, useState } from 'react';
import { useClub } from '@/lib/club-context';
import { getAccessToken } from '@/lib/supabase/client';
import { isNewsLive } from '@/lib/news';
import { REMINDER_SETTINGS, type EmailSettings, type ReminderSetting } from '@/lib/email/settings';
import { Mail, Send, Eye, AlertTriangle, CheckCircle2, History, CalendarDays, Calendar, Newspaper, RefreshCw, Users } from 'lucide-react';
import { clubTeamsOf, teamLabel } from '@/lib/teams';
import { newId } from '@/lib/ids';

type NoticeKind = 'team' | 'renewal' | 'match' | 'event' | 'news';

interface Overview {
  settings: EmailSettings;
  ready: { resend: boolean; unsubscribe: boolean; database: boolean };
  optOuts: number;
  history: { kind: string; subject: string; sentAt: string; recipients: number }[];
}

interface Preview {
  label: string;
  recipients: number;
  optedOut: number;
  alreadySent: number;
  noEmail: number;
  /** Phones/browsers following the club that also get it as a push notification */
  followers: number;
  /** Team messages: everyone in the team, who also get it in their app inbox */
  members?: number;
  preview: { subject: string; html: string } | null;
}

const NOTICE_TYPES: { kind: NoticeKind; label: string; icon: React.ElementType; hint: string }[] = [
  { kind: 'team', label: 'Message a team', icon: Users, hint: 'A quick message to one team: its players, their parents and guardians, and its coaches. It also appears in their Messages in the club app.' },
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
  notice_team: 'Team message',
  notice_fixture: 'Fixture change alert',
};

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
        background: checked ? 'var(--club-primary)' : 'rgba(var(--tint-rgb), 0.1)',
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
        background: '#FFFFFF',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        transition: 'left 0.2s var(--ease-out)',
      }} />
    </button>
  );
}

export default function AdminEmailsPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const { clubs, selectClubBySlug, matches, events, news, clubTeams } = useClub();
  const club = selectClubBySlug(clubSlug) || clubs[0];

  const [overview, setOverview] = useState<Overview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<ReminderSetting | null>(null);

  const [kind, setKind] = useState<NoticeKind>('team');
  const teams = useMemo(() => clubTeamsOf(clubTeams, club.id), [clubTeams, club.id]);
  const [teamId, setTeamId] = useState('');
  const [teamTitle, setTeamTitle] = useState('');
  const [teamPush, setTeamPush] = useState(false);
  // One id per message, so pressing Send twice sends it once; a new one after each send
  const [messageId, setMessageId] = useState(() => newId());
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
    .filter(n => n.club_id === club.id && isNewsLive(n))
    .sort((a, b) => (b.published_at || '').localeCompare(a.published_at || ''))
    .slice(0, 30), [news, club.id]);

  const options: { id: string; label: string }[] =
    kind === 'match' ? upcomingMatches.map(m => ({ id: m.id, label: `${fmtDate(m.match_date)} · ${m.home_team_name} vs ${m.away_team_name}` }))
    : kind === 'event' ? upcomingEvents.map(e => ({ id: e.id, label: `${fmtDate(e.start_time)} · ${e.title}` }))
    : kind === 'news' ? articles.map(n => ({ id: n.id, label: n.title }))
    : [];

  // A different notice invalidates the preview
  useEffect(() => { setPreview(null); setFeedback(null); }, [kind, refId, audience, message, teamId, teamTitle, teamPush]);
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

  const notice = () => ({ clubId: club.id, kind, refId: refId || undefined, audience, message: message.trim() || undefined });
  const teamNotice = () => ({ clubId: club.id, teamId, messageId, title: teamTitle.trim(), body: message.trim(), push: teamPush });
  const post = async (body: object) => {
    if (kind !== 'team') return api('POST', body);
    const token = await getAccessToken();
    const res = await fetch('/api/admin/team-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    return { ok: !!res?.ok, data, error: res ? data.error : 'Network error. Check your connection.' };
  };

  const runPreview = async () => {
    setBusy('preview');
    setFeedback(null);
    const r = await post(kind === 'team' ? teamNotice() : notice());
    setBusy(null);
    if (r.ok) setPreview(r.data);
    else setFeedback({ type: 'error', text: r.error || 'Could not prepare the notice.' });
  };

  const send = async () => {
    setBusy('send');
    const r = await post({ ...(kind === 'team' ? teamNotice() : notice()), send: true });
    setBusy(null);
    if (r.ok) {
      const sent = r.data.sent ?? 0;
      const pushed = r.data.pushed ? ` Notified ${r.data.pushed} follower${r.data.pushed === 1 ? '' : 's'}.` : '';
      const inbox = r.data.inbox ? ` It's in ${r.data.inbox} ${r.data.inbox === 1 ? 'member\'s' : 'members\''} Messages in the app.` : '';
      setFeedback({ type: 'success', text: (sent ? `Emailed ${sent} ${sent === 1 ? 'person' : 'people'}.` : kind === 'team' ? 'No new emails to send.' : 'Everyone already had this one. Nothing new to send.') + inbox + pushed });
      setPreview(null);
      if (kind === 'team') {
        setMessageId(newId());
        setTeamTitle('');
        setMessage('');
      }
      load();
    } else {
      setFeedback({ type: 'error', text: r.error || 'Sending failed.' });
    }
  };

  const needsRef = kind !== 'renewal' && kind !== 'team';
  const canPreview = kind === 'team' ? !!teamId && !!teamTitle.trim() && !!message.trim() : !needsRef || !!refId;
  const ready = overview?.ready;
  const notReady = ready && (!ready.resend || !ready.database);

  return (
    <div style={{ maxWidth: '960px' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <span className="badge badge-primary" style={{ marginBottom: '0.4rem' }}>EMAIL</span>
        <h1 className="stat-value">Email Notifications</h1>
        <p className="text-body">
          Automatic reminders and one-off notices to your members, sent from {club.name} via itsfootball.club.
        </p>
      </div>

      {loadError && (
        <div className="glass-panel" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem', border: '1px solid rgba(239, 68, 68, 0.4)', color: 'var(--c-red)' }}>
          {loadError}
        </div>
      )}

      {notReady && (
        <div className="glass-panel" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start', border: '1px solid rgba(245, 158, 11, 0.4)' }}>
          <AlertTriangle size={20} color="var(--c-amber)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            <strong className="text-primary">Email isn&apos;t fully set up yet.</strong>{' '}
            {!ready.database && 'The email tables haven\'t been added to the database. '}
            {!ready.resend && 'The email service key hasn\'t been configured. '}
            You can change settings and preview notices, but nothing will send until the platform admin finishes setup.
          </div>
        </div>
      )}

      {/* Automatic reminders */}
      <section className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.25rem' }}>Automatic reminders</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
          Sent every morning at about 8 am. Each person gets each reminder once. All are off until you switch them on.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {REMINDER_SETTINGS.map((s, i) => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.9rem 0', borderTop: i ? '1px solid var(--border-subtle)' : 'none' }}>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{s.label}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{s.description}</div>
              </div>
              <Switch
                label={s.label}
                checked={!!overview?.settings[s.key]}
                disabled={!overview || savingKey === s.key}
                onChange={v => toggle(s.key, v)}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Manual notice */}
      <section className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.25rem' }}>Send a notice</h2>
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
                  background: active ? 'rgba(var(--club-primary-rgb), 0.1)' : 'rgba(var(--tint-rgb), 0.02)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                <Icon size={18} style={{ marginBottom: '0.35rem', color: active ? 'var(--club-primary)' : 'var(--text-secondary)' }} />
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{t.label}</div>
              </button>
            );
          })}
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>{NOTICE_TYPES.find(t => t.kind === kind)?.hint}</p>

        {kind === 'team' && (
          <>
            <div className="form-row-2" style={{ gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="team-message-team">Team</label>
                {teams.length ? (
                  <select id="team-message-team" className="form-select" value={teamId} onChange={e => setTeamId(e.target.value)}>
                    <option value="">Choose...</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{teamLabel(t)}</option>)}
                  </select>
                ) : (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Set up your teams on Club Teams first.</p>
                )}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="team-message-title">Subject</label>
                <input id="team-message-title" className="form-input" maxLength={120} value={teamTitle} onChange={e => setTeamTitle(e.target.value)}
                  placeholder="e.g. Training is off tonight" />
              </div>
            </div>
          </>
        )}

        {needsRef && (
          <div className="form-group">
            <label className="form-label" htmlFor="notice-ref">{kind === 'match' ? 'Match' : kind === 'event' ? 'Event' : 'Article'}</label>
            {options.length ? (
              <select id="notice-ref" className="form-select" value={refId} onChange={e => setRefId(e.target.value)}>
                <option value="">Choose...</option>
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
          <label className="form-label" htmlFor="notice-message">{kind === 'team' ? 'Message' : 'Personal message (optional)'}</label>
          <textarea
            id="notice-message"
            className="form-textarea"
            rows={kind === 'team' ? 5 : 3}
            maxLength={kind === 'team' ? 2000 : 1000}
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder={kind === 'team' ? 'e.g. The council has closed the grounds after the rain, so training is off tonight. See you Saturday.' : 'e.g. Big game this week, come and support the team!'}
          />
        </div>

        {kind === 'team' && (
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '1rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={teamPush} onChange={e => setTeamPush(e.target.checked)} style={{ marginTop: '3px', accentColor: 'var(--club-primary)' }} />
            <span>Also send it as a phone notification to everyone following the club (not only this team). Leave it off for messages only the team needs.</span>
          </label>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" className="btn btn-secondary" disabled={!canPreview || !!busy} onClick={runPreview}>
            <Eye size={16} /> {busy === 'preview' ? 'Preparing...' : 'Preview'}
          </button>
          {preview && kind === 'team' && !!preview.members && (
            <button type="button" className="btn btn-primary" disabled={!!busy} onClick={send}>
              <Send size={16} /> {busy === 'send' ? 'Sending...' : `Send to ${preview.members} in the team`}
            </button>
          )}
          {preview && kind !== 'team' && preview.recipients > 0 && (
            <button type="button" className="btn btn-primary" disabled={!!busy || !ready?.resend} onClick={send}>
              <Send size={16} /> {busy === 'send' ? 'Sending...' : `Send to ${preview.recipients} ${preview.recipients === 1 ? 'person' : 'people'}`}
            </button>
          )}
        </div>

        {feedback && (
          <div role="status" style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.9rem', color: feedback.type === 'success' ? 'var(--c-green)' : 'var(--c-red)' }}>
            {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />} {feedback.text}
          </div>
        )}

        {preview && (
          <div style={{ marginTop: '1.25rem' }}>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
              <strong className="text-primary">
                {kind === 'team' && !preview.members ? 'Nobody is in this team yet. Add players and coaches on Club Teams.'
                  : preview.recipients ? `${preview.recipients} ${preview.recipients === 1 ? 'person' : 'people'} will get this by email.` : kind === 'team' ? 'Nobody to email.' : 'Nobody new to send this to.'}
              </strong>
              {preview.alreadySent > 0 && ` ${preview.alreadySent} already received it.`}
              {preview.optedOut > 0 && ` ${preview.optedOut} unsubscribed.`}
              {preview.noEmail > 0 && ` ${preview.noEmail} member${preview.noEmail === 1 ? ' has' : 's have'} no email address.`}
              {preview.members ? ` All ${preview.members} in the team also see it in Messages in the club app.` : ''}
              {preview.followers > 0 && ` ${preview.followers} follower${preview.followers === 1 ? '' : 's'} also get a push notification (headline and link only).`}
            </div>
            {preview.preview && (
              <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <div style={{ padding: '0.6rem 0.9rem', fontSize: '0.85rem', background: 'rgba(var(--tint-rgb), 0.04)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                  <strong className="text-primary">Subject:</strong> {preview.preview.subject}
                </div>
                <iframe title="Email preview" sandbox="" srcDoc={preview.preview.html} style={{ width: '100%', height: '640px', border: 0, background: '#F1F5F9', display: 'block' }} />
              </div>
            )}
          </div>
        )}
      </section>

      {/* History */}
      <section className="glass-panel" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <History size={18} /> Recently sent
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
          {overview ? `${overview.optOuts} ${overview.optOuts === 1 ? 'person has' : 'people have'} unsubscribed from ${club.name} emails.` : ' '}
        </p>
        {!overview?.history.length ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Mail size={16} /> No emails sent yet.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {overview.history.map((h, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '0.7rem 0', borderTop: i ? '1px solid var(--border-subtle)' : 'none', flexWrap: 'wrap' }}>
                <div className="min-w-0">
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{HISTORY_LABELS[h.kind] || 'Email'}</div>
                  {h.subject && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.subject}</div>}
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <div>{h.recipients} {h.recipients === 1 ? 'recipient' : 'recipients'}</div>
                  <div className="text-muted">{fmtDate(h.sentAt)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
