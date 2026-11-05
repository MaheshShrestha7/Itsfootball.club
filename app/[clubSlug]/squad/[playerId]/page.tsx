'use client';

import React, { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, Lock, Star } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import { getSupabaseClient } from '@/lib/supabase/client';
import { publicPlayerIds, teamsOfMember } from '@/lib/teams';
import { defaultSeasonLabel } from '@/lib/season';
import { clubResult, latestFirst } from '@/lib/fixtures';
import { matchPath } from '@/lib/slugs';
import { POSITION_NAMES, POSITION_SPOTS } from '@/lib/positions';
import { inPositionGroup } from '@/lib/top-players';
import PlayerAvatar from '@/components/PlayerAvatar';
import ResultChip from '@/components/ResultChip';
import LocalTime from '@/components/LocalTime';
import ShareLinkButton from '@/components/ShareLinkButton';

/** A small football for "scored in this game" */
function BallIcon() {
  return (
    <svg className="pp-ball" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 8l3.4 2.5-1.3 4h-4.2l-1.3-4z" fill="currentColor" />
      <path d="M12 2.5V8M15.4 10.5l5.2-1.8M14.1 14.5l3.3 4.4M9.9 14.5l-3.3 4.4M8.6 10.5L3.4 8.7" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/** /club/squad/{member id}: one adult player's public page. Juniors never get one (safeguarding). */
export default function PlayerPage({ params }: { params: Promise<{ clubSlug: string; playerId: string }> }) {
  const { clubSlug, playerId } = use(params);
  const { clubs, selectClubBySlug, members, clubTeams, clubTeamMembers, playerStats, matches, seasons, getActiveSeason, isHydrated } = useClub();
  const club = selectClubBySlug(clubSlug) || clubs[0];

  const player = useMemo(() => {
    const clubMembers = members.filter(m => m.club_id === club.id);
    const open = publicPlayerIds(clubMembers, clubTeams, clubTeamMembers, { includeU18: club.junior_includes_u18 !== false });
    return open.has(playerId) ? clubMembers.find(x => x.id === playerId) : undefined;
  }, [members, club, clubTeams, clubTeamMembers, playerId]);

  const currentSeason = getActiveSeason?.(club.id)?.name || defaultSeasonLabel();
  const career = useMemo(() => (player ? playerStats.filter(s => s.member_id === player.id) : []), [playerStats, player]);
  // The picker: the club's seasons and any season they have stats in, newest first; opens on the current one
  const seasonOptions = useMemo(() => {
    const names = new Set<string>([currentSeason, ...seasons.filter(s => s.club_id === club.id).map(s => s.name), ...career.map(s => s.season)]);
    return [...names].filter(Boolean).sort((a, b) => b.localeCompare(a));
  }, [currentSeason, seasons, club.id, career]);
  const [picked, setPicked] = useState<string | null>(null);
  const season = picked && seasonOptions.includes(picked) ? picked : currentSeason;
  const stats = career.find(s => s.season === season);
  const total = (k: 'appearances' | 'goals' | 'assists' | 'motm_awards' | 'clean_sheets') => career.reduce((n, s) => n + (s[k] || 0), 0);
  const teams = player ? teamsOfMember(clubTeamMembers, clubTeams.filter(t => t.club_id === club.id && !t.is_junior), player.id) : [];
  const [crestFailed, setCrestFailed] = useState(false);

  // Their finished games from the stats saved at full time (public_player_games, migration
  // 20261140), with goals, assists and Player of the Match. Before that migration runs, or for games
  // with no stats saved, the published line-ups they were in.
  const [statGames, setStatGames] = useState<{ match_id: string; goals: number; assists: number; motm: boolean }[] | null>(null);
  const playerKey = player?.id;
  useEffect(() => {
    if (!playerKey) return;
    let live = true;
    getSupabaseClient()?.rpc('public_player_games', { p_member_id: playerKey, p_limit: 20 })
      .then(({ data, error }) => { if (live) setStatGames(error ? [] : (data || [])); });
    return () => { live = false; };
  }, [playerKey]);
  const recent = useMemo(() => {
    if (!player) return [];
    const done = matches.filter(m => m.club_id === club.id && m.status === 'completed' && (m.season ? m.season === season : season === currentSeason));
    const byStats = new Map((statGames || []).map(g => [g.match_id, g]));
    const inLineup = (m: (typeof done)[number]) =>
      [...(m.home_lineup_coords || []), ...(m.away_lineup_coords || [])].some(p => p.member_id === player.id);
    return done
      .filter(m => byStats.has(m.id) || inLineup(m))
      .sort(latestFirst)
      .slice(0, 5)
      .map(m => ({ match: m, line: byStats.get(m.id) }));
  }, [matches, club.id, player, statGames, season, currentSeason]);

  const back = (
    <Link href={`/${club.slug}/squad`} className="pp-back">
      <ArrowLeft size={16} aria-hidden="true" /> Squad
    </Link>
  );

  if (!player) {
    return (
      <div style={{ minHeight: '85vh', padding: '3rem 0 5rem 0' }}>
        <div className="container" style={{ maxWidth: '760px' }}>
          {back}
          <div className="glass-panel row" style={{ padding: '1.25rem' }}>
            {isHydrated ? <><Lock size={16} color="var(--text-muted)" className="shrink-0" aria-hidden="true" /><span className="text-body">This player&apos;s page isn&apos;t public.</span></> : 'Loading…'}
          </div>
        </div>
      </div>
    );
  }

  const isKeeper = player.player_position === 'GK';
  // Defenders lead with clean sheets too, and keep their goals and assists (lib/top-players.ts)
  const isDefender = inPositionGroup(player.player_position, 'DEF');
  const position = player.player_position ? POSITION_NAMES[player.player_position] || player.player_position : null;
  const alsoPlays = (player.secondary_positions || []).filter(p => p !== player.player_position && p !== 'SUB' && POSITION_SPOTS[p]);
  const firstName = player.full_name.trim().split(/\s+/)[0];
  const figures: { label: string; n: number; all: number; lead?: boolean }[] = isDefender ? [
    { label: 'Games', n: stats?.appearances ?? 0, all: total('appearances') },
    { label: 'Clean sheets', n: stats?.clean_sheets ?? 0, all: total('clean_sheets'), lead: true },
    { label: 'Goals', n: stats?.goals ?? 0, all: total('goals') },
    { label: 'Assists', n: stats?.assists ?? 0, all: total('assists') },
  ] : [
    { label: 'Games', n: stats?.appearances ?? 0, all: total('appearances') },
    isKeeper
      ? { label: 'Clean sheets', n: stats?.clean_sheets ?? 0, all: total('clean_sheets'), lead: true }
      : { label: 'Goals', n: stats?.goals ?? 0, all: total('goals'), lead: true },
    { label: 'Assists', n: stats?.assists ?? 0, all: total('assists') },
    { label: 'Player of the Match', n: stats?.motm_awards ?? 0, all: total('motm_awards') },
  ];
  const extras = [
    // Four figures already, so a defender's Player of the Match awards go on the line below
    isDefender && stats?.motm_awards ? <span key="motm"><b>{stats.motm_awards}</b> Player of the Match</span> : null,
    stats?.minutes_played ? <span key="min"><b>{stats.minutes_played}</b> minutes</span> : null,
    stats?.yellow_cards ? <span key="y"><i className="pp-card pp-card-y" aria-hidden="true" /><b>{stats.yellow_cards}</b> yellow card{stats.yellow_cards === 1 ? '' : 's'}</span> : null,
    stats?.red_cards ? <span key="r"><i className="pp-card pp-card-r" aria-hidden="true" /><b>{stats.red_cards}</b> red card{stats.red_cards === 1 ? '' : 's'}</span> : null,
  ].filter(Boolean);
  const form = recent.filter(r => clubResult(r.match).outcome).slice().reverse();

  // The card maker opens filled in with them and the picked season's stats (cardFromLink)
  const cardLink = `/tools/player-card-maker?${new URLSearchParams({
    name: player.full_name.trim().split(/\s+/).pop() || '',
    ...(player.player_position ? { pos: player.player_position } : {}),
    ...(player.jersey_number != null ? { number: String(player.jersey_number) } : {}),
    club: club.name,
    season,
    ...(club.primary_color ? { colour: club.primary_color } : {}),
    ...(isKeeper ? { cs: String(stats?.clean_sheets ?? 0) } : { goals: String(stats?.goals ?? 0), assists: String(stats?.assists ?? 0) }),
    apps: String(stats?.appearances ?? 0),
    motm: String(stats?.motm_awards ?? 0),
  })}`;
  const share = (
    <ShareLinkButton url={`/${club.slug}/squad/${player.id}`} title={`${player.full_name}, ${club.name}`} className="pp-btn pp-btn-ghost" />
  );

  return (
    <div className="pp">
      <div className="container">
        {back}

        {/* The band, styled like the member pass and the Top Players leader: dark glass with the club
            colour glowing through, their shirt number huge and faded behind (beside the photo when
            there is one). The number drifts in once and leans away from the mouse on desktop. */}
        <section className={`pp-band${player.photo_url ? ' pp-band-has-photo' : ''}`} aria-labelledby="pp-name"
          onPointerMove={e => {
            if (e.pointerType !== 'mouse') return;
            const r = e.currentTarget.getBoundingClientRect();
            e.currentTarget.style.setProperty('--tp-px', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
            e.currentTarget.style.setProperty('--tp-py', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
          }}
          onPointerLeave={e => { e.currentTarget.style.setProperty('--tp-px', '0'); e.currentTarget.style.setProperty('--tp-py', '0'); }}>
          {player.jersey_number != null && <span className="pp-band-no" aria-hidden="true">{player.jersey_number}</span>}
          {player.photo_url && <div className="pp-band-photo"><PlayerAvatar photoUrl={player.photo_url} name={player.full_name} fill eager /></div>}
          <div className="pp-band-in">
            <div className="pp-band-main">
              <Link href={`/${club.slug}`} className="pp-band-club">
                {club.logo_url && !crestFailed && (
                  <img src={club.logo_url} alt="" width={40} height={40} onError={() => setCrestFailed(true)} />
                )}
                {club.name}
              </Link>
              <h1 id="pp-name" className="pp-name">{player.full_name}</h1>
              {position && <p className="pp-pos">{position}</p>}
              {teams.length > 0 && (
                <div className="pp-teams">
                  {teams.map(t => <Link key={t.id} href={`/${club.slug}/teams/${t.slug}`}>{t.name}</Link>)}
                </div>
              )}
            </div>
            <div className="pp-band-actions">
              {share}
              <Link href={cardLink} className="pp-btn pp-btn-light pp-band-card">Make a player card</Link>
            </div>
          </div>
        </section>

        <div className="pp-cols">
          <div className="pp-stack">
            <section aria-labelledby="pp-season">
              <div className="pp-head">
                <h2 id="pp-season">Season stats</h2>
                <label className="pp-picker">
                  <span className="pp-picker-label">Season</span>
                  <select value={season} onChange={e => setPicked(e.target.value)}>
                    {seasonOptions.map(name => <option key={name} value={name}>{name === currentSeason ? `${name} (current)` : name}</option>)}
                  </select>
                </label>
              </div>
              <dl className="pp-figures">
                {figures.map(f => (
                  <div key={f.label} className={f.lead ? 'pp-fig-lead' : undefined}>
                    <dd>{f.n}</dd>
                    <dt>{f.label}</dt>
                    {career.length > 1 && <small>{f.all} in all seasons</small>}
                  </div>
                ))}
              </dl>
              {extras.length > 0 && <p className="pp-extras">{extras}</p>}
            </section>

            {form.length > 0 && (
              <section aria-labelledby="pp-form">
                <div className="pp-head"><h2 id="pp-form">Form</h2><span className="pp-note">Oldest first</span></div>
                <ol className="pp-form" style={{ '--pp-form-n': form.length } as React.CSSProperties}>
                  {form.map(({ match: m, line }) => {
                    const outcome = clubResult(m).outcome!;
                    return (
                      <li key={m.id} className={`pp-form-${outcome.toLowerCase()}`}>
                        <span className="pp-form-res"><ResultChip outcome={outcome} size="md" /></span>
                        <span className="pp-form-did">
                          {line?.goals ? <BallIcon /> : null}
                          {line?.motm ? <Star size={14} fill="currentColor" aria-label="Player of the Match" /> : null}
                        </span>
                        <span className="pp-note"><LocalTime value={m.match_date} options={{ day: 'numeric', month: 'short' }} /></span>
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}

            <section aria-labelledby="pp-recent">
              <div className="pp-head"><h2 id="pp-recent">Recent games</h2></div>
              {recent.length === 0 ? (
                <p className="pp-note">No finished games {season === currentSeason ? 'yet this season' : `in ${season}`}.</p>
              ) : (
                <table className="pp-games">
                  <thead>
                    <tr><th scope="col">Date</th><th scope="col">Game</th><th scope="col">{firstName}</th><th scope="col"><span className="sr-only">Result</span></th></tr>
                  </thead>
                  <tbody>
                    {recent.map(({ match: m, line }) => {
                      const r = clubResult(m);
                      const opponent = m.opponent_name || (m.is_club_home ? m.away_team_name : m.home_team_name);
                      return (
                        <tr key={m.id}>
                          <td className="pp-g-when"><LocalTime value={m.match_date} options={{ weekday: 'short', day: 'numeric', month: 'short' }} /></td>
                          <td className="pp-g-opp">
                            <Link href={matchPath(club.slug, m)}>
                              {m.match_type === 'internal' ? `${m.home_team_name} vs ${m.away_team_name}` : `${m.is_club_home ? 'vs' : 'at'} ${opponent}`}
                            </Link>
                          </td>
                          <td className="pp-g-did">
                            {line && (line.goals || line.assists || line.motm) ? (
                              <span className="pp-did">
                                {line.goals ? <span><BallIcon />{line.goals === 1 ? 'Goal' : `${line.goals} goals`}</span> : null}
                                {line.assists ? <span>{line.assists === 1 ? 'Assist' : `${line.assists} assists`}</span> : null}
                                {line.motm ? <span className="pp-did-potm"><Star size={14} fill="currentColor" aria-hidden="true" />Player of the Match</span> : null}
                              </span>
                            ) : 'Played'}
                          </td>
                          <td className="pp-g-score">
                            <span>{r.outcome && <ResultChip outcome={r.outcome} />}{r.us} - {r.them}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </section>
          </div>

          <div className="pp-stack">
            {player.player_position && POSITION_SPOTS[player.player_position] && (
              <section aria-labelledby="pp-position">
                <div className="pp-head"><h2 id="pp-position">Position</h2></div>
                <div className="pp-pitch" role="img" aria-label={`Position diagram: ${position}${alsoPlays.length ? `, also plays ${alsoPlays.join(', ')}` : ''}`}>
                  <svg viewBox="0 0 68 60" preserveAspectRatio="none" aria-hidden="true">
                    <g className="pp-pitch-lines"><rect x="2" y="2" width="64" height="56" /><line x1="2" y1="30" x2="66" y2="30" /><circle cx="34" cy="30" r="6" /><rect x="18" y="2" width="32" height="9" /><rect x="18" y="49" width="32" height="9" /></g>
                  </svg>
                  {alsoPlays.map(p => {
                    const [x, y] = POSITION_SPOTS[p]!;
                    return <span key={p} className="pp-spot pp-spot-alt" style={{ left: `${x}%`, top: `${y}%` }}>{p}</span>;
                  })}
                  {(() => {
                    const [x, y] = POSITION_SPOTS[player.player_position]!;
                    return <span className="pp-spot pp-spot-main" style={{ left: `${x}%`, top: `${y}%` }}>{player.player_position}</span>;
                  })()}
                </div>
                <p className="pp-pitch-key"><span>Main position: {player.player_position}</span>{alsoPlays.length > 0 && <span>Also plays: {alsoPlays.join(', ')}</span>}</p>
              </section>
            )}

            {career.length > 0 && (
              <section aria-labelledby="pp-career">
                <div className="pp-head"><h2 id="pp-career">By season</h2></div>
                <table className="pp-career">
                  <thead>
                    <tr><th scope="col">Season</th><th scope="col">Games</th>{isDefender && <th scope="col">Clean sheets</th>}<th scope="col">{isKeeper ? 'Clean sheets' : 'Goals'}</th><th scope="col">Assists</th><th scope="col"><abbr title="Player of the Match">PotM</abbr></th></tr>
                  </thead>
                  <tbody>
                    {[...career].sort((a, b) => b.season.localeCompare(a.season)).map(s => (
                      <tr key={s.season}>
                        <td>{s.season}</td><td>{s.appearances || 0}</td>{isDefender && <td>{s.clean_sheets || 0}</td>}<td>{(isKeeper ? s.clean_sheets : s.goals) || 0}</td><td>{s.assists || 0}</td><td>{s.motm_awards || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                  {career.length > 1 && (
                    <tfoot>
                      <tr><td>All seasons</td><td>{total('appearances')}</td>{isDefender && <td>{total('clean_sheets')}</td>}<td>{isKeeper ? total('clean_sheets') : total('goals')}</td><td>{total('assists')}</td><td>{total('motm_awards')}</td></tr>
                    </tfoot>
                  )}
                </table>
              </section>
            )}

            <div className="pp-actions">
              <Link href={cardLink} className="pp-btn pp-btn-primary">Make a player card <ChevronRight size={16} aria-hidden="true" /></Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
