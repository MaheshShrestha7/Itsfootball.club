'use client';

import React, { use, useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock, Megaphone, Radio, Settings2, Share2, Shield, Star, Trophy, Users } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import { useUrlTab } from '@/lib/use-url-tab';
import { useMatchShare } from '@/lib/use-match-share';
import { useSocialMarks, useSocialReady, useSocialSettings } from '@/lib/use-social-posts';
import { SOCIAL_TRIGGERS, TIMING_LABEL, socialQueue, splitQueue, type SocialPost, type SocialTiming, type SocialTrigger } from '@/lib/social-posts';
import { clubTimeZone, DATE_LOCALE } from '@/lib/dates';
import { publicScoreHidden } from '@/lib/teams';
import MatchShareButton from '@/components/MatchShareButton';
import EventShareButton from '@/components/admin/EventShareButton';
import ReviewSaveNote from '@/components/admin/ReviewSaveNote';
import type { CardKind } from '@/lib/share-card';

const ICON: Record<SocialTrigger, typeof Clock> = {
  fixture: CalendarDays, team: Users, kickoff: Radio, halftime: Clock, fulltime: Trophy, motm: Star, event: Megaphone,
};
const KIND: Partial<Record<SocialTrigger, CardKind>> = { team: 'lineup-list', motm: 'motm' };
const KICK_OFF: [string, string] = ['KICK', 'OFF'];

/** "Fri 6:00 pm", or "Today 6:00 pm" */
function shortWhen(ms: number, tz: string) {
  const d = new Date(ms);
  const day = d.toLocaleDateString(DATE_LOCALE, { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');
  const today = new Date().toLocaleDateString(DATE_LOCALE, { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');
  const time = d.toLocaleTimeString(DATE_LOCALE, { timeZone: tz, hour: 'numeric', minute: '2-digit' });
  return `${day === today ? 'Today' : day}, ${time}`;
}

export default function AdminSocialPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const { clubs, selectClubBySlug, matches, events, clubTeams } = useClub();
  const { user, can } = useAuth();
  const club = selectClubBySlug(clubSlug) || clubs[0];
  const canEdit = can(club.id, 'content', 'edit');
  const [tab, setTab] = useUrlTab(['posts', 'rules'] as const);
  const db = useSocialReady();
  const name = user?.full_name || '';
  const { settings, change, saveState, retry, ready: settingsReady, failed } = useSocialSettings(club.id, db, name);
  const { marks, error: marksError, mark } = useSocialMarks(club.id, db, name);
  const shareProps = useMatchShare(club);
  const tz = clubTimeZone(club);

  // Re-worked out each minute, so a post becomes ready without a reload
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t); }, []);

  const posts = useMemo(() => socialQueue({
    matches: matches.filter(m => m.club_id === club.id),
    events: events.filter(e => e.club_id === club.id),
    settings, club, timeZone: tz, now,
    hideScore: m => publicScoreHidden(m, clubTeams),
    motm: m => shareProps(m).motm?.name,
    hasLineup: m => !!((m.is_club_home ?? true) ? m.home_lineup_coords : m.away_lineup_coords)?.length,
  }), [matches, events, club, settings, tz, now, clubTeams, shareProps]);
  const { todo, later, done } = splitQueue(posts, marks || {});

  // Captions as edited here, before the post is marked (then the mark keeps them)
  const [edits, setEdits] = useState<Record<string, string>>({});
  const captionOf = (p: SocialPost) => edits[p.key] ?? marks?.[p.key]?.caption ?? p.caption;
  const [saveError, setSaveError] = useState(false);
  const setMark = async (p: SocialPost, status: 'shared' | 'skipped' | null) => {
    setSaveError(!(await mark(p.key, status, status ? captionOf(p) : undefined)));
  };

  const shareButton = (p: SocialPost) => {
    const trigger = (open: () => void) => (
      <button type="button" className="btn btn-primary btn-sm" onClick={open}><Share2 size={14} aria-hidden="true" /> Share from my phone</button>
    );
    const common = { caption: captionOf(p), onCaption: (c: string) => setEdits(e => ({ ...e, [p.key]: c })), onShared: () => void setMark(p, 'shared'), trigger };
    if (p.event) return <EventShareButton event={p.event} club={club} {...common} />;
    if (!p.match) return null;
    return <MatchShareButton {...shareProps(p.match)} {...common} initialKind={KIND[p.trigger]} headline={p.trigger === 'kickoff' && p.match.home_score + p.match.away_score === 0 ? KICK_OFF : undefined} />;
  };

  const row = (p: SocialPost, state: 'todo' | 'later' | 'done') => {
    const Icon = ICON[p.trigger];
    const m = marks?.[p.key];
    return (
      <li key={p.key} className="glass-panel social-post">
        <span className="social-post-icon" aria-hidden="true"><Icon size={18} /></span>
        <div className="social-post-body">
          <h3>{p.title}</h3>
          <p className="social-post-when">
            {state === 'later' ? `Ready ${shortWhen(p.readyAt, tz)}`
              : state === 'done' && m ? `${m.status === 'shared' ? 'Shared' : 'Skipped'}${m.by_name ? ` by ${m.by_name}` : ''}, ${shortWhen(Date.parse(m.at), tz)}`
              : p.trigger === 'kickoff' || p.trigger === 'halftime' ? 'Happening now' : 'Ready to share'}
          </p>
          {state !== 'done' && <p className="social-post-caption">{captionOf(p)}</p>}
        </div>
        {canEdit && (
          <div className="social-post-actions">
            {state === 'done' ? (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void setMark(p, null)}>Undo</button>
            ) : (
              <>
                {shareButton(p)}
                {state === 'todo' && <>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => void setMark(p, 'shared')}>
                    <CheckCircle2 size={14} aria-hidden="true" /> Mark as posted
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => void setMark(p, 'skipped')}>Skip</button>
                </>}
              </>
            )}
          </div>
        )}
      </li>
    );
  };

  const setRule = (key: SocialTrigger, next: { on?: boolean; when?: SocialTiming }) =>
    change({ ...settings, rules: { ...settings.rules, [key]: { ...settings.rules[key], ...next } } });

  return (
    <div>
      <div className="admin-head">
        <div>
          <h1>Social media</h1>
          <p>Posts for your club&apos;s Facebook, Instagram, TikTok and WhatsApp, made from your fixtures, results and events. Share each one from your phone with the graphic and caption ready.</p>
        </div>
      </div>

      <div className="admin-tabs" role="tablist" aria-label="Social media">
        <button type="button" role="tab" aria-selected={tab === 'posts'} data-view-ok onClick={() => setTab('posts')} className="admin-tab">
          <Megaphone size={14} aria-hidden="true" /> Posts {todo.length > 0 && <span className="num">{todo.length} ready</span>}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'rules'} data-view-ok onClick={() => setTab('rules')} className="admin-tab">
          <Settings2 size={14} aria-hidden="true" /> When to post
        </button>
      </div>

      {db === false && (
        <p className="admin-notice" role="status">Saved in this browser only for now. Once the database update runs, every admin sees the same list.</p>
      )}
      {(saveError || marksError) && <p className="admin-notice is-danger" role="alert">That didn&apos;t save. Check your connection and try again.</p>}

      {tab === 'posts' ? (
        marks === null ? <p className="text-note" role="status">Loading posts…</p> : (
          <>
            <section aria-labelledby="social-todo">
              <h2 id="social-todo" className="social-h2">Ready to share <span className="num">{todo.length}</span></h2>
              {todo.length ? <ul className="social-list">{todo.map(p => row(p, 'todo'))}</ul>
                : <p className="admin-empty glass-panel">Nothing to share right now. New posts show up here when a game is near, a team is picked, a game kicks off or finishes, or you add an event.</p>}
            </section>
            {later.length > 0 && (
              <section aria-labelledby="social-later">
                <h2 id="social-later" className="social-h2">Coming up <span className="num">{later.length}</span></h2>
                <ul className="social-list">{later.slice(0, 10).map(p => row(p, 'later'))}</ul>
              </section>
            )}
            {done.length > 0 && (
              <section aria-labelledby="social-done">
                <h2 id="social-done" className="social-h2">Done <span className="num">{done.length}</span></h2>
                <ul className="social-list">{done.map(p => row(p, 'done'))}</ul>
              </section>
            )}
            <p className="social-foot"><Shield size={14} aria-hidden="true" /> Junior games follow your junior rules: short names, no photos without consent, no scores where a team hides them.</p>
          </>
        )
      ) : (
        <section className="glass-panel social-rules" aria-label="When to post">
          {!settingsReady ? <p className="text-note" role="status">{failed ? 'Couldn’t load your settings. Reload to try again.' : 'Loading…'}</p> : (
            <>
              <ul>
                {SOCIAL_TRIGGERS.map(t => {
                  const rule = settings.rules[t.key];
                  return (
                    <li key={t.key} className={rule.on ? undefined : 'is-off'}>
                      <div>
                        <h3 id={`rule-${t.key}`}>{t.label}</h3>
                        <p>{t.what}</p>
                      </div>
                      {t.timings && (
                        <select className="form-input" aria-label={`When the ${t.label} post is ready`} value={rule.when} disabled={!rule.on || !canEdit}
                          onChange={e => setRule(t.key, { when: e.target.value as SocialTiming })}>
                          {t.timings.map(v => <option key={v} value={v}>{TIMING_LABEL[v]}</option>)}
                        </select>
                      )}
                      <input type="checkbox" role="switch" className="mc-switch" aria-labelledby={`rule-${t.key}`} checked={rule.on} disabled={!canEdit}
                        onChange={e => setRule(t.key, { on: e.target.checked })} />
                    </li>
                  );
                })}
              </ul>
              <div className="social-tags">
                <label htmlFor="social-hashtags">Added to every caption</label>
                <input id="social-hashtags" className="form-input" maxLength={300} placeholder="#YourClub #YourLeague" value={settings.hashtags} disabled={!canEdit}
                  onChange={e => change({ ...settings, hashtags: e.target.value })} />
                <p>There&apos;s no post for each goal on purpose: one post per goal floods your followers.</p>
              </div>
              <ReviewSaveNote state={saveState} retry={retry} idle="Saves as you change it" />
            </>
          )}
        </section>
      )}
    </div>
  );
}
