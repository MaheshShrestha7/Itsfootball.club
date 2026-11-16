'use client';

// Mission Control -> Matchday (MCF-1): every club's games for a day or weekend, which are live, and
// which finished without a score. get_platform_matchday(), migration 20261177.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, ExternalLink } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { matchStart } from '@/lib/admin-calendar';
import { gameState, matchdayRange as rangeFor, type MatchdayState as State, type MatchdayWhen as When } from '@/lib/mission-control';
import { matchPath } from '@/lib/slugs';
import { Crest } from '@/components/admin/platform/McArt';
import type { PlatformClubItem } from '@/lib/supabase/types';
import type { EmailDraft } from '@/components/admin/platform/EmailComposer';

const DAY = 86400000;
const PAGE = 50;

interface Game {
  id: string; club_id: string; club_name: string; club_slug: string; club_short: string | null; club_color: string | null; club_logo: string | null;
  team_name: string | null; match_type: string; is_club_home: boolean | null; home_team_name: string; away_team_name: string; opponent_name: string | null;
  match_date: string; match_time: string | null; status: string; period: string | null; home_score: number | null; away_score: number | null;
  current_minute: number | null; match_slug: string | null;
}
const hoursSince = (g: Game, now: number) => {
  const s = matchStart(g);
  return s ? Math.max(1, Math.round((now - s.start.getTime()) / 3600000)) : 0;
};

export default function MatchdayTab({ clubs, onSelectClub, onEmail }: {
  clubs: PlatformClubItem[];
  onSelectClub: (c: PlatformClubItem) => void;
  onEmail: (d: EmailDraft) => void;
}) {
  const [when, setWhen] = useState<When>('weekend');
  const [games, setGames] = useState<Game[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client) return;
    setLoading(true);
    const t = Date.now();
    const { from, to } = rangeFor(when, new Date(t));
    // A day either side: date-only fixtures are stored as midnight UTC, which can sit outside local midnight
    const { data, error: e } = await client.rpc('get_platform_matchday', {
      p_from: new Date(from.getTime() - DAY).toISOString(), p_to: new Date(to.getTime() + DAY).toISOString(),
    });
    setLoading(false);
    setNow(t);
    if (e) {
      setError(/function|does not exist/i.test(e.message) ? 'Run migration 20261177_mission_control_features.sql to see every club\'s games here.' : e.message);
      setGames([]);
      return;
    }
    setError('');
    setShown(PAGE);
    setGames(((data || []) as Game[]).filter(g => {
      const s = matchStart(g);
      return s && s.start >= from && s.start < to;
    }).sort((a, b) => matchStart(a)!.start.getTime() - matchStart(b)!.start.getTime()));
  }, [when]);
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => (games || []).map(g => ({ g, state: gameState(g, now) })), [games, now]);
  const count = (s: State) => rows.filter(r => r.state === s).length;
  const clubCount = new Set(rows.map(r => r.g.club_id)).size;
  const live = rows.filter(r => r.state === 'live');
  const missing = useMemo(() => {
    const by = new Map<string, { name: string; n: number; teams: Set<string> }>();
    rows.filter(r => r.state === 'unscored').forEach(({ g }) => {
      const cur = by.get(g.club_id) || { name: g.club_name, n: 0, teams: new Set<string>() };
      cur.n += 1;
      if (g.team_name) cur.teams.add(g.team_name);
      by.set(g.club_id, cur);
    });
    return [...by.entries()].sort((a, b) => b[1].n - a[1].n);
  }, [rows]);
  const club = (id: string) => clubs.find(c => c.id === id);

  const opponent = (g: Game) => g.match_type === 'internal'
    ? `${g.home_team_name} vs ${g.away_team_name}`
    : `vs ${g.opponent_name?.trim() || (g.is_club_home !== false ? g.away_team_name : g.home_team_name)}`;
  const score = (g: Game, state: State) => {
    if (state !== 'live' && state !== 'scored') return '';
    if (g.match_type === 'internal') return `${g.home_score ?? 0}-${g.away_score ?? 0}`;
    const home = g.is_club_home !== false;
    return `${home ? g.home_score ?? 0 : g.away_score ?? 0}-${home ? g.away_score ?? 0 : g.home_score ?? 0}`;
  };
  const stateFlag = (g: Game, state: State) => {
    switch (state) {
      case 'live': return <span className="mc-flag ok">{g.status === 'halftime' || g.period === 'halftime' ? 'Live, half time' : `Live${g.current_minute ? `, ${g.current_minute}'` : ''}`}</span>;
      case 'scored': return <span className="mc-flag">Finished</span>;
      case 'unscored': return <span className="mc-flag warn">No score, {hoursSince(g, now) >= 48 ? `${Math.round(hoursSince(g, now) / 24)} days` : `${hoursSince(g, now)} hours`}</span>;
      case 'postponed': return <span className="mc-flag">Postponed</span>;
      default: return <span className="mc-flag">Later</span>;
    }
  };
  const kickoff = (g: Game) => {
    const s = matchStart(g);
    if (!s) return '';
    const day = when === 'today' ? '' : s.start.toLocaleDateString('en-AU', { weekday: 'short' }) + ' ';
    return s.timeKnown ? day + s.start.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false }) : `${day}time not set`;
  };
  const { from } = rangeFor(when, new Date(now));
  const heading = when === 'today'
    ? from.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' })
    : `Weekend of ${from.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`;

  return (
    <div>
      <div className="mc-page-h">
        <div>
          <h1>Matchday</h1>
          <p>Every club&apos;s games, straight from their fixtures.</p>
        </div>
        <div className="right">
          <span className="mc-seg" role="group" aria-label="When">
            {([['today', 'Today'], ['weekend', 'This weekend'], ['last', 'Last weekend']] as const).map(([k, label]) => (
              <button key={k} type="button" aria-pressed={when === k} onClick={() => setWhen(k)}>{label}</button>
            ))}
          </span>
          <button type="button" className="mc-icon-btn" onClick={load} disabled={loading} aria-label="Refresh"><RefreshCw size={14} className={loading ? 'spin' : ''} /></button>
        </div>
      </div>

      {error ? <div className="mc-card mc-empty" role="alert">{error}</div> : (
        <div className="mc-today">
          <section className="mc-card" aria-labelledby="mc-md-h">
            <div className="mc-card-h">
              <h2 id="mc-md-h">{heading}</h2>
              <span className="mc-muted">{games ? `${rows.length} ${rows.length === 1 ? 'game' : 'games'} across ${clubCount} ${clubCount === 1 ? 'club' : 'clubs'}` : 'Loading…'}</span>
            </div>
            {games && rows.length > 0 && (
              <div className="mc-ov-nums mc-md-nums">
                <div><b className="num">{count('live')}</b><small>live now</small></div>
                <div><b className="num">{count('scored')}</b><small>finished with a score</small></div>
                <div><b className={`num${count('unscored') ? ' mc-md-warn' : ''}`}>{count('unscored')}</b><small>finished, no score yet</small></div>
              </div>
            )}
            {games && rows.length === 0 && <div className="mc-empty">No games in this range. Clubs add fixtures from their admin area.</div>}
            {!games && <div className="mc-empty">Loading…</div>}
            {rows.length > 0 && (
              <div className="mc-md-scroll">
                <table className="mc-table">
                  <thead><tr><th>Club</th><th>Game</th><th>Kick off</th><th>Score</th><th>State</th></tr></thead>
                  <tbody>
                    {rows.slice(0, shown).map(({ g, state }) => {
                      const c = club(g.club_id);
                      return (
                        <tr key={g.id}>
                          <td>
                            <button type="button" className="mc-md-club" onClick={() => c && onSelectClub(c)} disabled={!c}>
                              <Crest logoUrl={g.club_logo} label={g.club_short || g.club_name} color={g.club_color} size={28} />
                              <span><b>{g.club_name}</b><small>{g.team_name || (g.match_type === 'internal' ? 'In-house game' : 'Club game')}</small></span>
                            </button>
                          </td>
                          <td><a href={matchPath(g.club_slug, { id: g.id, slug: g.match_slug })} target="_blank" rel="noopener" className="mc-md-link">{opponent(g)} <ExternalLink size={11} aria-hidden="true" /></a></td>
                          <td className="num">{kickoff(g)}</td>
                          <td className="num">{score(g, state)}</td>
                          <td>{stateFlag(g, state)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {rows.length > shown && (
              <p className="mc-muted" style={{ marginTop: 10 }}>
                Showing {shown} of {rows.length}. <button type="button" className="mc-pill-btn ghost" onClick={() => setShown(s => s + PAGE)}>Show more</button>
              </p>
            )}
          </section>

          <div className="mc-col">
            <section className="mc-card" aria-labelledby="mc-md-miss">
              <div className="mc-card-h"><h2 id="mc-md-miss">Missing scores</h2>{missing.length > 0 && <span className="mc-flag warn">{count('unscored')} {count('unscored') === 1 ? 'game' : 'games'}</span>}</div>
              {missing.length === 0
                ? <p className="mc-muted" style={{ margin: 0 }}>Every game that has finished has a score.</p>
                : (
                  <>
                    <p className="mc-muted" style={{ margin: '0 0 6px' }}>Games 2 hours past kickoff that still say upcoming. They show on Today too.</p>
                    {missing.map(([id, m]) => {
                      const c = club(id);
                      return (
                        <div key={id} className="mc-feed-row mc-md-miss">
                          <div>
                            <b>{m.name}</b>
                            <time>{m.n} {m.n === 1 ? 'game' : 'games'}{m.teams.size ? `, ${[...m.teams].slice(0, 3).join(', ')}` : ''}</time>
                          </div>
                          {c && <button type="button" className="mc-pill-btn ghost" onClick={() => onEmail({ club: c, to: 'admins', template: 'scores' })}>Remind</button>}
                        </div>
                      );
                    })}
                  </>
                )}
            </section>
            <section className="mc-card" aria-labelledby="mc-md-live">
              <div className="mc-card-h"><h2 id="mc-md-live">Live now</h2></div>
              {live.length === 0 && <p className="mc-muted" style={{ margin: 0 }}>No games being scored live right now.</p>}
              <div className="mc-feed">
                {live.map(({ g }) => (
                  <div key={g.id} className="mc-feed-row">
                    <div>
                      <b>{g.home_team_name} {g.home_score ?? 0}, {g.away_team_name} {g.away_score ?? 0}</b>
                      <time>{g.club_name}{g.status === 'halftime' ? ', half time' : g.current_minute ? `, ${g.current_minute}'` : ''}</time>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
