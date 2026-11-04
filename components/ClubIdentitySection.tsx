'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useClub } from '@/lib/club-context';
import { defaultSeasonLabel } from '@/lib/season';
import Link from 'next/link';
import { Club, ClubMember, Match, ClubEvent, Sponsor, PlayerStats, countsTowardClubRecord } from '@/lib/supabase/types';
import { publicScoreHidden } from '@/lib/teams';
import { latestFirst } from '@/lib/fixtures';
import { isSponsorOnSite } from '@/lib/sponsors';
import { isCountedMember } from '@/lib/people';
import { clubNumbers, hasClubNumbers, type ClubNumbers } from '@/lib/club-numbers';

interface ClubIdentitySectionProps {
  club: Club;
  members: ClubMember[];
  matches: Match[];
  events: ClubEvent[];
  sponsors: Sponsor[];
  playerStats?: PlayerStats[];
  onOpenContactModal?: () => void;
}


/**
 * AnimatedCounter: Eased count-up ticker triggered once section is in viewport.
 * Uses cubic-bezier ease-out (0.16, 1, 0.3, 1) and respects prefers-reduced-motion.
 */
function AnimatedCounter({
  value,
  duration = 850,
  enabled = true,
}: {
  value: number;
  duration?: number;
  enabled?: boolean;
}) {
  // Starts at the real number, so the server's HTML (what crawlers and no-JS visitors read) shows it
  const [displayCount, setDisplayCount] = useState(value);
  const shown = useRef(value);
  const counted = useRef(false);

  useEffect(() => {
    const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Before the tiles scroll into view: park at 0 (off screen, so nobody sees the drop) for the count-up
    if (!enabled) {
      if (!reduced && !counted.current) { shown.current = 0; setDisplayCount(0); }
      return;
    }
    if (reduced || value === shown.current) {
      shown.current = value;
      setDisplayCount(value);
      return;
    }

    // Counts from what's on screen: 0 the first time, the old number when a refresh changes it
    const from = shown.current;
    counted.current = true;
    let startTimestamp: number | null = null;
    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // Snappy cubic ease-out curve
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      shown.current = Math.round(from + easeProgress * (value - from));
      setDisplayCount(shown.current);

      if (progress < 1) animationFrameId = window.requestAnimationFrame(step);
    };

    animationFrameId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(animationFrameId);
  }, [value, duration, enabled]);

  return <>{displayCount.toLocaleString()}</>;
}

export default function ClubIdentitySection({
  club,
  members,
  matches,
  events,
  sponsors,
}: ClubIdentitySectionProps) {
  const { getActiveSeason, clubTeams } = useClub();
  const sectionRef = useRef<HTMLElement>(null);
  const [isInView, setIsInView] = useState(false);

  // The page's own (realtime-synced) data, worked out with the same rules as the server route
  const clubId = club.id;
  // Waiting and rejected applications don't count (lib/people.ts), as on the dashboard and People
  const clubMembers = members.filter(m => m.club_id === clubId && isCountedMember(m));
  const clubMatches = matches.filter(m => m.club_id === clubId);
  // No season set up: the latest played game's season (not whichever row happens to come first)
  const latestPlayed = clubMatches
    .filter(m => countsTowardClubRecord(m) && ['completed', 'full_time', 'live', 'halftime'].includes(m.status))
    .sort(latestFirst)[0];
  const currentSeason = getActiveSeason(clubId)?.name || latestPlayed?.season || defaultSeasonLabel();
  const teams = clubTeams.filter(t => t.club_id === clubId && t.is_active);
  const local = clubNumbers({
    members: clubMembers,
    matches: clubMatches,
    // Teams that hide their scores publicly (junior grassroots rules) add no goals or results
    scoreHidden: m => publicScoreHidden(m, clubTeams),
    currentSeason,
    events: events.filter(e => e.club_id === clubId),
    sponsors: sponsors.filter(s => s.club_id === clubId && isSponsorOnSite(s) && !s.event_id),
    teams: teams.length,
  });
  // Changes whenever the synced data does, which is when the server numbers are fetched again
  const localKey = JSON.stringify(local);

  // The server's numbers (straight from Supabase) once they land; the page's own until then
  const [server, setServer] = useState<ClubNumbers | null>(null);
  const n = server ?? local;

  // IntersectionObserver to trigger count-up and entrance
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const currentRef = sectionRef.current;
    if (!currentRef) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    observer.observe(currentRef);
    return () => observer.disconnect();
  }, []);

  // Fetch on mount, then again only when the realtime-synced data changes. No polling: a 30s
  // interval + focus refetch per open tab was most of the Worker's traffic and tripped its CPU
  // limit (Error 1102, Nov 2026).
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const res = await fetch(`/api/clubs/${encodeURIComponent(club.slug)}/identity-stats`);
        if (!res.ok) return;
        const json = await res.json();
        if (json.success && json.stats && isMounted && Array.isArray(json.stats.form)) setServer(json.stats as ClubNumbers);
      } catch (err) {
        console.warn('[ClubIdentitySection] Failed to fetch Supabase stats, keeping the page counts', err);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [club.slug, localKey]);

  // A brand-new club with nothing to count: no section at all rather than a wall of zeros
  if (!hasClubNumbers(n)) return null;

  const slug = club.slug;
  const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);
  const results = n.won + n.drawn + n.lost;
  const seasonGames = n.games > 0;
  const bigGames = seasonGames ? n.games : n.allTimeGames;

  // Rows with a 0 are left out
  const rows = [
    { id: 'goals', value: n.goals, label: plural(n.goals, 'Goal', 'Goals'), sub: `${n.season} season`, href: `/${slug}/fixtures`, go: 'Results' },
    { id: 'clean', value: n.cleanSheets, label: plural(n.cleanSheets, 'Clean sheet', 'Clean sheets'), sub: `${n.season} season`, href: `/${slug}/fixtures`, go: 'Results' },
    { id: 'players', value: n.players, label: plural(n.players, 'Player', 'Players'), sub: 'Signed up to play', href: `/${slug}/squad`, go: 'Squad' },
    { id: 'supporters', value: n.supporters, label: plural(n.supporters, 'Supporter', 'Supporters'), sub: 'Signed up with the club', href: null, go: null },
    { id: 'teams', value: n.teams, label: plural(n.teams, 'Team', 'Teams'), sub: 'Playing for the club', href: `/${slug}/teams`, go: 'Teams' },
  ].filter(r => r.value > 0);

  const reveal = (delayMs: number): React.CSSProperties => ({
    opacity: isInView ? 1 : 0,
    transform: isInView ? 'none' : 'translateY(10px)',
    transition: `opacity 0.42s cubic-bezier(0.16, 1, 0.3, 1) ${delayMs}ms, transform 0.42s cubic-bezier(0.16, 1, 0.3, 1) ${delayMs}ms`,
  });

  return (
    <section ref={sectionRef} id="club-identity" className="cn" aria-labelledby="club-numbers-heading">
      <div className="container">
        <p className="cn-club" style={reveal(0)}>
          <b>{club.name}</b>
          {club.founded_year ? <> · Est. {club.founded_year}</> : null}
          {club.motto ? <> · &ldquo;{club.motto}&rdquo;</> : null}
        </p>
        <h2 id="club-numbers-heading" className="cn-title" style={reveal(0)}>Club&apos;s Impact in Numbers</h2>

        <div className="cn-body">
          {bigGames > 0 && (
            <div className="glass-panel cn-lead" style={reveal(40)}>
              <div className="cn-big">
                <span className="cn-fig">
                  <AnimatedCounter value={bigGames} enabled={isInView} duration={500} />
                </span>
                <span className="cn-big-label">
                  {plural(bigGames, 'game played', 'games played')}
                  <span>{seasonGames ? `${n.season} season` : 'All time'}</span>
                </span>
              </div>

              {seasonGames && results > 0 && (
                <div className="cn-wdl">
                  <div className="cn-wdl-bar" aria-hidden="true">
                    {n.won > 0 && <i className="w" style={{ flex: n.won }} />}
                    {n.drawn > 0 && <i className="d" style={{ flex: n.drawn }} />}
                    {n.lost > 0 && <i className="l" style={{ flex: n.lost }} />}
                  </div>
                  <div className="cn-wdl-key">
                    <span><b>{n.won}</b> won</span>
                    <span><b>{n.drawn}</b> drawn</span>
                    <span><b>{n.lost}</b> lost</span>
                  </div>
                </div>
              )}

              {n.form.length > 0 && (
                <div className="cn-form">
                  <span>Last {n.form.length}</span>
                  <span className="cn-form-list" role="list" aria-label={`Last ${n.form.length} results, oldest first`}>
                    {n.form.map((o, i) => (
                      <i key={i} role="listitem" className={`o-${o}`} aria-label={o === 'W' ? 'Won' : o === 'D' ? 'Drawn' : 'Lost'}>{o}</i>
                    ))}
                  </span>
                </div>
              )}

              {seasonGames && n.allTimeGames > n.games && (
                <div className="cn-alltime">
                  All time: {n.allTimeGames} {plural(n.allTimeGames, 'game', 'games')} · {n.allTimeGoals} {plural(n.allTimeGoals, 'goal', 'goals')}
                </div>
              )}
            </div>
          )}

          <div className="cn-right">
            {(n.events > 0 || n.sponsors > 0) && (
              <div className="cn-pair">
                {n.events > 0 && (
                  <Link href={`/${slug}/events`} className="glass-panel cn-tile" style={reveal(80)}>
                    <span className="cn-fig cn-fig-md">
                      <AnimatedCounter value={n.events} enabled={isInView} duration={500} />
                    </span>
                    <span className="cn-tile-label">{plural(n.events, 'Event', 'Events')}</span>
                    {n.upcomingEvents > 0 && <span className="cn-tile-sub">{n.upcomingEvents} coming up</span>}
                    {n.eventSignups > 0 && <span className="cn-tile-sub">{n.eventSignups} {plural(n.eventSignups, 'sign-up', 'sign-ups')}</span>}
                    {n.eventTypes.length > 0 && (
                      <span className="cn-chips">
                        {n.eventTypes.map(t => <span key={t.label} className="cn-chip">{t.count} {t.label}</span>)}
                      </span>
                    )}
                    <span className="cn-go">Events →</span>
                  </Link>
                )}
                {n.sponsors > 0 && (
                  <Link href={`/${slug}/sponsor`} className="glass-panel cn-tile" style={reveal(120)}>
                    <span className="cn-fig cn-fig-md">
                      <AnimatedCounter value={n.sponsors} enabled={isInView} duration={500} />
                    </span>
                    <span className="cn-tile-label">{plural(n.sponsors, 'Sponsor', 'Sponsors')}</span>
                    <span className="cn-tile-sub">Backing the club</span>
                    {n.sponsorTiers.length > 0 && (
                      <span className="cn-chips">
                        {n.sponsorTiers.map(t => <span key={t.label} className="cn-chip">{t.count} {t.label}</span>)}
                      </span>
                    )}
                    <span className="cn-go">Become a sponsor →</span>
                  </Link>
                )}
              </div>
            )}

            {rows.length > 0 && (
              <ul className="glass-panel cn-list" style={reveal(160)}>
                {rows.map(r => {
                  const inner = (
                    <>
                      <span className="cn-v">{r.value.toLocaleString()}</span>
                      <span className="cn-t">{r.label}<span>{r.sub}</span></span>
                      {r.go ? <span className="cn-go">{r.go} →</span> : <span />}
                    </>
                  );
                  return (
                    <li key={r.id}>
                      {r.href ? <Link href={r.href} className="cn-row">{inner}</Link> : <div className="cn-row">{inner}</div>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .cn {
          position: relative;
          padding: 3rem 0 3.25rem;
          border-bottom: 1px solid var(--border-subtle);
          scroll-margin-top: 90px;
        }
        .cn-club {
          font-size: 0.85rem;
          color: var(--text-secondary);
          margin: 0 0 0.5rem;
        }
        .cn-club b { color: var(--text-primary); font-weight: 700; }
        .cn-title {
          font-size: clamp(1.6rem, 3.2vw, 2.3rem);
          font-weight: 900;
          letter-spacing: -0.02em;
          line-height: 1.15;
          color: var(--text-primary);
          margin: 0;
        }
        .cn-body {
          display: grid;
          gap: 1rem;
          margin-top: 1.5rem;
        }
        .cn-right { display: grid; gap: 1rem; align-content: start; }
        :global(.cn-fig) {
          font-family: var(--font-heading);
          font-weight: 900;
          line-height: 0.85;
          letter-spacing: -0.04em;
          color: var(--club-ink);
          font-variant-numeric: tabular-nums;
        }
        .cn-lead { padding: 1.25rem; }
        .cn-big { display: flex; align-items: baseline; gap: 0.75rem; }
        .cn-big .cn-fig { font-size: 5.5rem; }
        .cn-big-label { font-weight: 700; font-size: 1rem; line-height: 1.25; color: var(--text-primary); }
        .cn-big-label span { display: block; font-weight: 500; font-size: 0.85rem; color: var(--text-secondary); }
        .cn-wdl { margin-top: 1.1rem; }
        .cn-wdl-bar { display: flex; gap: 2px; height: 8px; border-radius: 999px; overflow: hidden; }
        .cn-wdl-bar i { display: block; }
        .cn-wdl-bar .w { background: var(--club-primary); }
        .cn-wdl-bar .d { background: rgba(var(--tint-rgb), 0.28); }
        .cn-wdl-bar .l { background: rgba(var(--tint-rgb), 0.12); }
        .cn-wdl-key {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem 1rem;
          margin-top: 0.55rem;
          font-size: 0.85rem;
          color: var(--text-secondary);
          font-variant-numeric: tabular-nums;
        }
        .cn-wdl-key b { color: var(--text-primary); font-weight: 700; }
        .cn-form {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          margin-top: 0.9rem;
          font-size: 0.8rem;
          color: var(--text-secondary);
        }
        .cn-form-list { display: flex; gap: 6px; }
        .cn-form-list i {
          font-style: normal;
          width: 24px;
          height: 24px;
          border-radius: 6px;
          display: grid;
          place-items: center;
          font-size: 0.7rem;
          font-weight: 800;
        }
        .cn-form-list .o-W { background: var(--club-primary); color: var(--club-primary-contrast, #fff); }
        .cn-form-list .o-D { background: rgba(var(--tint-rgb), 0.18); color: var(--text-primary); }
        .cn-form-list .o-L { border: 1px solid var(--border-medium); color: var(--text-secondary); }
        .cn-alltime {
          margin-top: 0.9rem;
          padding-top: 0.75rem;
          border-top: 1px solid var(--border-subtle);
          font-size: 0.8rem;
          color: var(--text-muted);
          font-variant-numeric: tabular-nums;
        }
        .cn-pair {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 130px), 1fr));
          gap: 1rem;
        }
        :global(.cn-tile) {
          padding: 1.1rem 1.1rem 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          color: inherit;
          text-decoration: none;
          min-width: 0;
        }
        :global(.cn-fig-md) { font-size: 3.4rem; }
        :global(.cn-tile-label) { font-weight: 700; font-size: 1rem; color: var(--text-primary); }
        :global(.cn-tile-sub) { font-size: 0.8rem; line-height: 1.35; color: var(--text-secondary); font-variant-numeric: tabular-nums; }
        :global(.cn-chips) { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 0.2rem; }
        :global(.cn-chip) {
          font-size: 0.72rem;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 999px;
          background: rgba(var(--tint-rgb), 0.06);
          color: var(--text-secondary);
          font-variant-numeric: tabular-nums;
        }
        :global(.cn-go) { color: var(--club-ink); font-size: 0.82rem; font-weight: 700; white-space: nowrap; }
        :global(.cn-tile .cn-go) { margin-top: auto; padding-top: 0.4rem; }
        .cn-list { list-style: none; margin: 0; padding: 0 1.25rem; }
        .cn-list li + li { border-top: 1px solid var(--border-subtle); }
        :global(.cn-row) {
          display: grid;
          grid-template-columns: 3.25rem minmax(0, 1fr) auto;
          align-items: center;
          gap: 0.75rem;
          min-height: 56px;
          padding: 0.55rem 0;
          color: inherit;
          text-decoration: none;
        }
        :global(.cn-v) {
          font-family: var(--font-heading);
          font-weight: 800;
          font-size: 1.6rem;
          letter-spacing: -0.02em;
          font-variant-numeric: tabular-nums;
          color: var(--text-primary);
        }
        :global(.cn-t) { font-weight: 600; font-size: 0.95rem; line-height: 1.25; color: var(--text-primary); }
        :global(.cn-t span) { display: block; font-weight: 500; font-size: 0.78rem; color: var(--text-muted); }
        @media (hover: hover) and (pointer: fine) {
          :global(a.cn-tile:hover) { border-color: rgba(var(--club-primary-rgb), 0.4); }
          :global(a.cn-row:hover .cn-go), :global(a.cn-tile:hover .cn-go) { text-decoration: underline; }
        }
        @media (min-width: 900px) {
          .cn { padding: 3.5rem 0; }
          .cn-body { grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: 1.25rem; align-items: start; }
          .cn-right { gap: 1.25rem; }
          .cn-lead { padding: 1.75rem; }
          .cn-big .cn-fig { font-size: 7.5rem; }
          :global(.cn-fig-md) { font-size: 4.2rem; }
          .cn-list { padding: 0.25rem 1.75rem; }
        }
        @media (prefers-reduced-motion: reduce) {
          .cn :global(*) { transition: none !important; transform: none !important; opacity: 1 !important; }
        }
      `}</style>
    </section>
  );
}
