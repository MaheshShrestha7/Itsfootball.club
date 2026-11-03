'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { buildQueue, firstName, greeting, timeAgo, type QueueKind } from '@/lib/mission-control';
import type { PlatformAuditRow, PlatformClubItem, SupportRequest } from '@/lib/supabase/types';
import type { EmailDraft } from '@/components/admin/platform/EmailComposer';
import { Crest } from '@/components/admin/platform/McArt';
import { Clock, CreditCard, Sparkles, UserPlus, ArrowRight, Search, Inbox } from 'lucide-react';

interface Props {
  clubs: PlatformClubItem[];
  loading: boolean;
  userName?: string | null;
  userEmail?: string | null;
  onSelectClub: (c: PlatformClubItem) => void;
  onEmail: (d: EmailDraft) => void;
  onOpenLog: () => void;
  onOpenPalette: () => void;
  onOpenSupport: (id: string) => void;
  showToast: (msg: string) => void;
}

const KIND: Record<QueueKind, { label: string; icon: React.ElementType; bg: string; color: string }> = {
  backlog: { label: 'Waiting for approval', icon: Clock, bg: 'var(--mc-amber-bg)', color: 'var(--mc-amber)' },
  payments: { label: 'Payments', icon: CreditCard, bg: 'var(--mc-red-bg)', color: 'var(--mc-red)' },
  stalled: { label: 'Stuck at setup', icon: Sparkles, bg: 'var(--mc-lilac)', color: 'var(--mc-indigo)' },
  welcome: { label: 'New club', icon: UserPlus, bg: 'var(--mc-mint)', color: 'var(--mc-green-ink)' },
};

const DONE_UNTIL = '2100-01-01T00:00:00Z';

/** Today: everything across the platform that needs the founder, each with its fix. */
export default function TodayTab({ clubs, loading, userName, userEmail, onSelectClub, onEmail, onOpenLog, onOpenPalette, onOpenSupport, showToast }: Props) {
  const [snoozed, setSnoozed] = useState<Set<string>>(new Set());
  const [recent, setRecent] = useState<PlatformAuditRow[]>([]);
  const [support, setSupport] = useState<SupportRequest[]>([]);
  const [filter, setFilter] = useState<QueueKind | 'all'>('all');

  const load = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client) return;
    const [s, a, q] = await Promise.all([
      client.from('platform_snoozes').select('key, until').gt('until', new Date().toISOString()),
      client.rpc('get_platform_audit', { p_club_id: null, p_limit: 6 }),
      client.from('support_requests').select('*').eq('status', 'open').order('created_at').limit(10),
    ]);
    setSupport((q.data || []) as SupportRequest[]);
    setSnoozed(new Set((s.data || []).map((r: { key: string }) => r.key)));
    setRecent((a.data || []) as PlatformAuditRow[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  const queue = useMemo(() => buildQueue(clubs, snoozed), [clubs, snoozed]);
  const counts = queue.reduce<Record<string, number>>((acc, i) => ({ ...acc, [i.kind]: (acc[i.kind] || 0) + 1 }), {});
  const shown = queue.filter(i => filter === 'all' || i.kind === filter);

  const snooze = async (key: string, until: string, msg: string) => {
    const client = getSupabaseClient();
    if (!client) return;
    setSnoozed(prev => new Set(prev).add(key));
    const { error } = await client.from('platform_snoozes').upsert({ key, until });
    if (error) {
      setSnoozed(prev => { const n = new Set(prev); n.delete(key); return n; });
      showToast(`Could not save: ${error.message}`);
    } else showToast(msg);
  };

  const name = firstName(userName, userEmail);
  const urgent = queue.filter(i => i.kind !== 'welcome').length + support.length;

  return (
    <div>
      <div className="mc-page-h">
        <div>
          <h1>{greeting(new Date().getHours())}{name ? `, ${name}` : ''}.</h1>
          <p>{loading ? 'Loading clubs…' : urgent === 0 ? 'No club needs you right now.' : `${urgent} ${urgent === 1 ? 'thing needs' : 'things need'} you.`}</p>
        </div>
        <div className="right">
          <button type="button" className="mc-pill-btn ghost" onClick={onOpenPalette}>
            <Search size={14} /> Find anything <kbd style={{ fontSize: 11, opacity: 0.7 }}>Ctrl K</kbd>
          </button>
        </div>
      </div>

      <div className="mc-today">
        <section className="mc-card">
          <div className="mc-card-h" style={{ flexWrap: 'wrap', gap: 8 }}>
            <h3>Needs you</h3>
            <span className="mc-tabs" role="group" aria-label="Filter the list" style={{ margin: 0 }}>
              <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All {queue.length + support.length}</button>
              {(Object.keys(KIND) as QueueKind[]).filter(k => counts[k]).map(k => (
                <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>{KIND[k].label} {counts[k]}</button>
              ))}
            </span>
          </div>

          {filter === 'all' && support.map(r => (
            <div key={r.id} className="mc-q">
              <span className="mc-sq" style={{ background: 'var(--mc-sky)', color: 'var(--mc-sky-ink)' }}><Inbox size={16} /></span>
              <div className="body">
                <div className="t"><b>{clubs.find(c => c.id === r.club_id)?.name || r.from_email} · {r.topic}</b></div>
                <p>{r.from_name || r.from_email} · {timeAgo(r.created_at)}: &ldquo;{r.message.length > 160 ? `${r.message.slice(0, 160)}…` : r.message}&rdquo;</p>
                <div className="acts"><button type="button" className="mc-pill-btn" onClick={() => onOpenSupport(r.id)}>Reply</button></div>
              </div>
            </div>
          ))}

          {!loading && shown.length === 0 && support.length === 0 && <div className="mc-empty">All clear. Nothing waiting on you.</div>}

          {shown.map(item => {
            const k = KIND[item.kind];
            const Icon = k.icon;
            return (
              <div key={item.key} className="mc-q">
                <span className="mc-sq" style={{ background: k.bg, color: k.color }}><Icon size={16} /></span>
                <div className="body">
                  <div className="t">
                    <button type="button" className="mc-q-club" onClick={() => onSelectClub(item.club)} title="Open the club console">
                      <Crest logoUrl={item.club.logo_url} label={item.club.short_name} color={item.club.primary_color} />
                    </button>
                    <b>{item.title}</b>
                  </div>
                  <p>{item.detail}</p>
                  <div className="acts">
                    <button type="button" className="mc-pill-btn" onClick={() => onEmail({ club: item.club, to: item.action.to, template: item.action.template })}>
                      {item.action.label}
                    </button>
                    <button type="button" className="mc-pill-btn ghost" onClick={() => onSelectClub(item.club)}>Open club</button>
                    <button type="button" className="mc-pill-btn ghost" onClick={() => snooze(item.key, new Date(Date.now() + 7 * 86400000).toISOString(), 'Snoozed for 7 days')}>Snooze 7 days</button>
                    <button type="button" className="mc-pill-btn ghost" onClick={() => snooze(item.key, DONE_UNTIL, 'Marked done')}>Done</button>
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        <section className="mc-card">
          <div className="mc-card-h">
            <h3>Done recently</h3>
            <button type="button" className="mc-icon-btn" onClick={onOpenLog} aria-label="Open the full log"><ArrowRight size={14} /></button>
          </div>
          {recent.length === 0 && <p className="mc-muted">Nothing yet. Changes you make to clubs show here.</p>}
          <div className="mc-feed">
            {recent.map(r => (
              <div key={r.id} className="mc-feed-row">
                <div>
                  <b>{r.summary}</b>{r.club_name ? <> · {r.club_name}</> : null}
                  <time dateTime={r.created_at}>{r.actor_email || 'system'} · {timeAgo(r.created_at)}</time>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
