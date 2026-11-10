'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import {
  DONE_UNTIL, QUEUE_GROUP, buildQueue, firstName, greeting, isDoneSnooze, queueItems, staleDoneKeys, timeAgo,
  type HealthSignal, type MissionTab, type QueueKind, type TodayExtras,
} from '@/lib/mission-control';
import type { HealthReport } from '@/lib/platform-health';
import { platformApi } from '@/components/admin/platform/api';
import type { PlatformAuditRow, PlatformClubItem, SupportRequest } from '@/lib/supabase/types';
import type { EmailDraft } from '@/components/admin/platform/EmailComposer';
import { Crest } from '@/components/admin/platform/McArt';
import { Clock, CreditCard, Sparkles, UserPlus, Search, Inbox, AlertTriangle, Landmark, Mail, MapPin } from 'lucide-react';

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
  onOpenTab: (tab: MissionTab) => void;
  showToast: (msg: string) => void;
}

const KIND: Record<QueueKind, { icon: React.ElementType; tone: string }> = {
  transfers: { icon: Landmark, tone: 'money' },
  payments: { icon: CreditCard, tone: 'money' },
  backlog: { icon: Clock, tone: 'wait' },
  enquiries: { icon: Mail, tone: 'support' },
  stalled: { icon: Sparkles, tone: 'setup' },
  welcome: { icon: UserPlus, tone: 'new' },
};

/** get_platform_today() (migration 20261163) */
interface TodayData extends TodayExtras {
  crashes?: { count: number; latest_at: string | null; latest_path: string | null };
  ground_drafts?: { count: number; newest_at: string | null };
}

type Filter = 'all' | 'support' | 'money' | 'clubs' | 'site';
const dayOf = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : 'none');
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Today: everything across the platform that needs the founder, each with its fix. */
export default function TodayTab({ clubs, loading, userName, userEmail, onSelectClub, onEmail, onOpenLog, onOpenPalette, onOpenSupport, onOpenTab, showToast }: Props) {
  const [snoozes, setSnoozes] = useState<{ key: string; until: string }[]>([]);
  const [recent, setRecent] = useState<PlatformAuditRow[]>([]);
  const [support, setSupport] = useState<SupportRequest[]>([]);
  const [broken, setBroken] = useState<HealthSignal[]>([]);
  const [today, setToday] = useState<TodayData | null>(null);
  const [todayLoaded, setTodayLoaded] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [lastDone, setLastDone] = useState<{ key: string; title: string } | null>(null);

  const load = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client) return;
    const [s, a, q, h, t] = await Promise.all([
      client.from('platform_snoozes').select('key, until').gt('until', new Date().toISOString()),
      client.rpc('get_platform_audit', { p_club_id: null, p_limit: 6 }),
      client.from('support_requests').select('*').eq('status', 'open').order('created_at').limit(10),
      platformApi<HealthReport>('health?quick=1'),
      client.rpc('get_platform_today'),
    ]);
    setSupport((q.data || []) as SupportRequest[]);
    setBroken((h.signals || []).filter(x => x.light === 'red'));
    setSnoozes((s.data || []) as { key: string; until: string }[]);
    setRecent((a.data || []) as PlatformAuditRow[]);
    // Before migration 20261163 there's no get_platform_today: the club items still show
    setToday(t.error ? null : (t.data as TodayData));
    setTodayLoaded(!t.error);
  }, []);

  useEffect(() => { load(); }, [load]);

  const snoozed = useMemo(() => new Set(snoozes.map(r => r.key)), [snoozes]);
  const extras: TodayExtras = useMemo(() => ({ transfers: today?.transfers || [], enquiries: today?.enquiries || [] }), [today]);
  const all = useMemo(() => buildQueue(clubs, snoozed, Date.now(), extras), [clubs, snoozed, extras]);
  const queue = all.filter(i => i.kind !== 'welcome');
  const welcomes = all.filter(i => i.kind === 'welcome');

  // Site-wide items, each keyed by when it started so Done only covers this one
  const crashes = today?.crashes && Number(today.crashes.count) > 0 ? today.crashes : null;
  const drafts = today?.ground_drafts && Number(today.ground_drafts.count) > 0 ? today.ground_drafts : null;
  const crashKey = crashes ? `crashes:${dayOf(crashes.latest_at)}` : '';
  const draftKey = drafts ? `grounds:${dayOf(drafts.newest_at)}` : '';
  const showCrashes = crashes && !snoozed.has(crashKey);
  const showDrafts = drafts && !snoozed.has(draftKey);

  // A "done" whose problem has gone is cleared, so the problem shows again if it comes back (MC1).
  // Only once clubs and get_platform_today have both loaded, so nothing is cleared by mistake.
  useEffect(() => {
    if (loading || !todayLoaded || !clubs.length) return;
    const live = new Set(queueItems(clubs, Date.now(), extras).map(i => i.key));
    if (crashKey) live.add(crashKey);
    if (draftKey) live.add(draftKey);
    const stale = staleDoneKeys(snoozes.filter(r => isDoneSnooze(r.until)).map(r => r.key), live);
    if (!stale.length) return;
    const client = getSupabaseClient();
    client?.from('platform_snoozes').delete().in('key', stale).then(({ error }) => {
      if (!error) setSnoozes(prev => prev.filter(r => !stale.includes(r.key)));
    });
  }, [loading, todayLoaded, clubs, extras, snoozes, crashKey, draftKey]);

  const snooze = async (key: string, until: string, title: string) => {
    const client = getSupabaseClient();
    if (!client) return;
    const done = until === DONE_UNTIL;
    setSnoozes(prev => [...prev.filter(r => r.key !== key), { key, until }]);
    const { error } = await client.from('platform_snoozes').upsert({ key, until });
    if (error) {
      setSnoozes(prev => prev.filter(r => r.key !== key));
      showToast(`Could not save: ${error.message}`);
    } else if (done) {
      setLastDone({ key, title });
    } else {
      showToast('Snoozed for 7 days');
    }
  };

  const undo = async () => {
    if (!lastDone) return;
    const client = getSupabaseClient();
    const key = lastDone.key;
    setLastDone(null);
    setSnoozes(prev => prev.filter(r => r.key !== key));
    const { error } = await client!.from('platform_snoozes').delete().eq('key', key);
    if (error) showToast(`Could not undo: ${error.message}`);
  };

  const week = () => new Date(Date.now() + 7 * 86400000).toISOString();
  const name = firstName(userName, userEmail);
  const siteCount = broken.length + (showCrashes ? 1 : 0) + (showDrafts ? 1 : 0);
  const counts: Record<Exclude<Filter, 'all'>, number> = {
    support: support.length,
    money: queue.filter(i => QUEUE_GROUP[i.kind] === 'money').length,
    clubs: queue.filter(i => QUEUE_GROUP[i.kind] === 'clubs').length,
    site: siteCount,
  };
  const urgent = counts.support + counts.money + counts.clubs + counts.site;
  const show = (f: Exclude<Filter, 'all'>) => filter === 'all' || filter === f;
  const shownQueue = queue.filter(i => filter === 'all' || QUEUE_GROUP[i.kind] === filter);
  const FILTERS: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: urgent },
    { id: 'support', label: 'Support', count: counts.support },
    { id: 'money', label: 'Money', count: counts.money },
    { id: 'clubs', label: 'Clubs', count: counts.clubs },
    { id: 'site', label: 'Site', count: counts.site },
  ];
  const nothing = !loading && (filter === 'all' ? urgent === 0 : counts[filter as Exclude<Filter, 'all'>] === 0);

  const doneButtons = (key: string, title: string, withDone = true) => (
    <>
      <button type="button" className="mc-pill-btn ghost" onClick={() => snooze(key, week(), title)}>Snooze 7 days</button>
      {withDone && <button type="button" className="mc-pill-btn ghost" onClick={() => snooze(key, DONE_UNTIL, title)}>Done</button>}
    </>
  );

  return (
    <div>
      <div className="mc-page-h">
        <div>
          <h1>{greeting(new Date().getHours())}{name ? `, ${name}` : ''}</h1>
          <p>{loading ? 'Loading clubs…' : urgent === 0 ? 'Nothing needs you right now.' : `${urgent} ${urgent === 1 ? 'thing needs' : 'things need'} you. Support and broken things come first.`}</p>
        </div>
        <div className="right">
          <button type="button" className="mc-search-btn" onClick={onOpenPalette}>
            <Search size={14} aria-hidden="true" /> Find a club, person or page <kbd>Ctrl K</kbd>
          </button>
        </div>
      </div>

      <div className="mc-today">
        <section className="mc-card" aria-labelledby="mc-needs-h">
          <div className="mc-card-h" style={{ flexWrap: 'wrap', gap: 8 }}>
            <h2 id="mc-needs-h">Needs you</h2>
            <span className="mc-seg" role="group" aria-label="Show">
              {FILTERS.filter(f => f.id === 'all' || f.count > 0 || filter === f.id).map(f => (
                <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label} {f.count}</button>
              ))}
            </span>
          </div>

          {lastDone && (
            <div className="mc-undo" role="status">
              <span><b>Marked done.</b> If this happens again, it comes back here.</span>
              <button type="button" className="mc-pill-btn ghost" onClick={undo}>Undo</button>
            </div>
          )}

          {show('support') && support.map(r => (
            <div key={r.id} className="mc-q">
              <span className="mc-sq tone-support"><Inbox size={16} /></span>
              <div className="body">
                <div className="t"><b>{clubs.find(c => c.id === r.club_id)?.name || r.from_email}: {r.topic}</b> <span className="when">{timeAgo(r.created_at)}</span></div>
                <p>{r.from_name || r.from_email}: &ldquo;{r.message.length > 160 ? `${r.message.slice(0, 160)}…` : r.message}&rdquo;</p>
                <div className="acts"><button type="button" className="mc-pill-btn" onClick={() => onOpenSupport(r.id)}>Reply</button></div>
              </div>
            </div>
          ))}

          {show('site') && broken.map(s => (
            <div key={s.key} className="mc-q">
              <span className="mc-sq tone-money"><AlertTriangle size={16} /></span>
              <div className="body">
                <div className="t"><b>{s.label}</b> <span className="mc-flag bad">Broken</span></div>
                <p>{s.summary}</p>
                <div className="acts"><button type="button" className="mc-pill-btn" onClick={() => onOpenTab('health')}>Open System health</button></div>
              </div>
            </div>
          ))}

          {shownQueue.map(item => {
            const k = KIND[item.kind];
            const Icon = k.icon;
            return (
              <div key={item.key} className="mc-q">
                <span className={`mc-sq tone-${k.tone}`}><Icon size={16} /></span>
                <div className="body">
                  <div className="t">
                    <button type="button" className="mc-q-club" onClick={() => onSelectClub(item.club)} aria-label={`Open ${item.club.name}`}>
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
                    {doneButtons(item.key, item.title)}
                  </div>
                </div>
              </div>
            );
          })}

          {show('site') && showDrafts && drafts && (
            <div className="mc-q">
              <span className="mc-sq tone-site"><MapPin size={16} /></span>
              <div className="body">
                <div className="t"><b>{plural(Number(drafts.count), 'ground is a draft', 'grounds are drafts')} waiting to go live</b></div>
                <p>Visitors can&apos;t find them in the grounds directory until you publish them.</p>
                <div className="acts">
                  <button type="button" className="mc-pill-btn" onClick={() => onOpenTab('grounds')}>Review the drafts</button>
                  {doneButtons(draftKey, 'Ground drafts', false)}
                </div>
              </div>
            </div>
          )}

          {show('site') && showCrashes && crashes && (
            <div className="mc-q">
              <span className="mc-sq tone-site"><AlertTriangle size={16} /></span>
              <div className="body">
                <div className="t"><b>{plural(Number(crashes.count), 'page')} crashed for a visitor today</b></div>
                <p>{crashes.latest_path ? `The most recent was on ${crashes.latest_path}, ${timeAgo(crashes.latest_at)}.` : `The most recent was ${timeAgo(crashes.latest_at)}.`}</p>
                <div className="acts">
                  <button type="button" className="mc-pill-btn" onClick={() => onOpenTab('overview')}>See the crashes in Overview</button>
                  {doneButtons(crashKey, 'Page crashes')}
                </div>
              </div>
            </div>
          )}

          {nothing && <div className="mc-empty">All clear. Nothing waiting on you.</div>}
          {loading && urgent === 0 && <div className="mc-empty">Loading…</div>}
        </section>

        <div className="mc-col">
          {welcomes.length > 0 && (
            <section className="mc-card" aria-labelledby="mc-new-h">
              <div className="mc-card-h"><h2 id="mc-new-h">New this week</h2></div>
              {welcomes.map(item => (
                <div key={item.key} className="mc-q">
                  <span className="mc-sq tone-new"><UserPlus size={16} /></span>
                  <div className="body">
                    <div className="t">
                      <button type="button" className="mc-q-club" onClick={() => onSelectClub(item.club)} aria-label={`Open ${item.club.name}`}>
                        <Crest logoUrl={item.club.logo_url} label={item.club.short_name} color={item.club.primary_color} />
                      </button>
                      <b>{item.title}</b>
                    </div>
                    <p>{item.detail}</p>
                    <div className="acts">
                      <button type="button" className="mc-pill-btn ghost" onClick={() => onEmail({ club: item.club, to: item.action.to, template: item.action.template })}>{item.action.label}</button>
                      <button type="button" className="mc-pill-btn ghost" onClick={() => snooze(item.key, DONE_UNTIL, item.title)}>Done</button>
                    </div>
                  </div>
                </div>
              ))}
            </section>
          )}

          <section className="mc-card" aria-labelledby="mc-done-h">
            <div className="mc-card-h">
              <h2 id="mc-done-h">Done recently</h2>
              <button type="button" className="mc-pill-btn ghost" onClick={onOpenLog}>Action log</button>
            </div>
            {recent.length === 0 && <p className="mc-muted">Nothing yet. Changes you make to clubs show here.</p>}
            <div className="mc-feed">
              {recent.map(r => (
                <div key={r.id} className="mc-feed-row">
                  <div>
                    <b>{r.summary}</b>{r.club_name ? <>, {r.club_name}</> : null}
                    <time dateTime={r.created_at}>{r.actor_email || 'system'}, {timeAgo(r.created_at)}</time>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
