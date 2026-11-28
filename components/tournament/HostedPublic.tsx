'use client';

// Public side of hosted tournaments: the age group switch (TX-3) and one team's page (TX-9) with its
// crest, colours, staff, squad (junior names shortened by tournament_squads_public), games, how they
// did, and the "How we did" share graphic (TX-10).
import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Image as ImageIcon, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import ShareLinkButton from '@/components/ShareLinkButton';
import { DEFAULT_CREST } from '@/lib/crest';
import { ageGroupFamily, ageGroupLabel, teamSummary, kickoffLabel, gameOutcome, ENTRY_POSITIONS } from '@/lib/hosted-tournaments';
import { fixtureWhenLabel, tournamentMatchLabel } from '@/lib/tournament-engine';
import { drawTeamCard } from '@/lib/team-card';
import LiveMinute from '@/components/LiveMinute';
import { matchPath } from '@/lib/slugs';
import { formatClock } from '@/lib/dates';
import type { Match, MatchEvent, Tournament, TournamentParticipant, TournamentSquadPlayer } from '@/lib/supabase/types';
import { tournamentOver } from '@/lib/tournament-overview';
import '@/components/tournament/hosted.css';

export function AgeGroupTabs({ tournaments, tournament, href }: { tournaments: Tournament[]; tournament: Tournament; href: (t: Tournament) => string }) {
  const family = ageGroupFamily(tournaments, tournament);
  if (family.length < 2) return null;
  return (
    <nav className="ht-ages" aria-label="Age groups">
      {family.map(t => (
        <Link key={t.id} href={href(t)} className="ht-age" aria-current={t.id === tournament.id ? 'page' : undefined}>
          {ageGroupLabel(t)}
        </Link>
      ))}
    </nav>
  );
}

const POSITION_GROUPS: [string | null, string][] = [['GK', 'Goalkeepers'], ['DEF', 'Defenders'], ['MID', 'Midfielders'], ['FWD', 'Forwards'], [null, 'Players']];
const OUTCOME_WORD = { W: 'Won', D: 'Drew', L: 'Lost' } as const;

export function TeamDetail({ team, tournament, matches, events, squad, participants, clubSlug, host, showName, onClose, clubPage }: {
  team: TournamentParticipant;
  tournament: Tournament;
  matches: Match[];
  events: MatchEvent[];
  squad: TournamentSquadPlayer[];
  /** Every team in the tournament, for the opponents' crests */
  participants: TournamentParticipant[];
  clubSlug: string;
  host: { name: string; logo_url?: string | null };
  showName: (n: string) => string;
  onClose: () => void;
  /** The team is a club on itsfootball.club that accepted the link */
  clubPage?: { name: string; href: string };
}) {
  const ids = new Set(matches.map(m => m.id));
  const s = teamSummary(team.name, matches, events.filter(e => ids.has(e.match_id)));
  const players = squad.filter(p => p.participant_id === team.id);
  const done = s.games.length > 0 && s.games.every(g => g.status === 'completed');
  const title = tournament.age_group ? `${tournament.name} (${tournament.age_group})` : tournament.name;
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const canvas = useRef<HTMLCanvasElement | null>(null);

  const share = async () => {
    setBusy(true);
    try {
      const c = canvas.current || (canvas.current = document.createElement('canvas'));
      await drawTeamCard(c, { team, tournament: title, host, summary: s, showName });
      const blob = await new Promise<Blob | null>(r => c.toBlob(r, 'image/png'));
      if (!blob) return;
      const file = new File([blob], `${team.name.replace(/[^\w]+/g, '-').toLowerCase()}-tournament.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${team.name} at ${title}` }).catch(() => {});
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }
    } finally { setBusy(false); }
  };

  const staff = [team.manager_name && `Manager ${team.manager_name}`, team.coach_name && `coach ${team.coach_name}`].filter(Boolean).join(', ');
  const crestOf = (name: string) => participants.find(p => p.name === name)?.logo_url || DEFAULT_CREST;
  const sideIn = (m: Match) => (m.home_team_name === team.name ? 'home' : 'away') as 'home' | 'away';
  const form = s.games.map(m => gameOutcome(m, sideIn(m))).filter((o): o is 'W' | 'D' | 'L' => !!o);

  // One heading per day, so each row only needs the kick-off time
  const days: { day: string; games: Match[] }[] = [];
  for (const m of s.games) {
    const day = fixtureWhenLabel({ match_date: m.match_date, match_time: '' });
    const last = days[days.length - 1];
    if (last?.day === day) last.games.push(m); else days.push({ day, games: [m] });
  }
  const groups = POSITION_GROUPS
    .map(([pos, label]) => ({ label, list: players.filter(p => (pos ? p.position === pos : !(ENTRY_POSITIONS as readonly (string | null | undefined)[]).includes(p.position))) }))
    .filter(g => g.list.length);

  return (
    <section className="ht-team glass-panel" aria-labelledby="ht-team-name"
      style={{ '--ht-c1': team.color || undefined, '--ht-c2': team.secondary_color || team.color || undefined } as React.CSSProperties}>
      {/* The team's two kit colours run along the top: the one thing every club recognises as its own */}
      <header className="ht-team-head">
        <span className="ht-crest ht-crest-lg"><img src={team.logo_url || DEFAULT_CREST} alt="" width={72} height={72} /></span>
        <div className="ht-team-id">
          <h2 id="ht-team-name">{team.name}</h2>
          {(team.group || s.finish) && (
            <p className="ht-team-tags">
              {team.group && <span>Group {team.group}</span>}
              {s.finish && <span className="is-finish">{s.finish}</span>}
            </p>
          )}
          {staff && <p className="ht-team-meta">{staff}</p>}
          {clubPage && <Link className="ht-link-btn" href={clubPage.href}>{clubPage.name}&rsquo;s club page <ExternalLink size={13} aria-hidden="true" /></Link>}
          <div className="ht-team-share">
            <ShareLinkButton url={`${pathname}?team=${team.id}`} title={`${team.name} at ${title}`} label="Share team page" campaign={`tournament-team/${team.name}`} />
            {s.played > 0 && (
              <button type="button" className="btn btn-secondary btn-sm ht-share" onClick={share} disabled={busy}>
                <ImageIcon size={14} aria-hidden="true" /> {busy ? 'Making the graphic…' : done ? 'Share how we did' : 'Share results so far'}
              </button>
            )}
          </div>
        </div>
        <button type="button" className="ht-icon-btn" onClick={onClose} aria-label="Close team"><X size={18} /></button>
      </header>

      {s.played > 0 && (
        <div className="ht-record">
          <dl className="ht-record-nums">
            <div><dt>Played</dt><dd>{s.played}</dd></div>
            <div><dt>Won</dt><dd>{s.won}</dd></div>
            <div><dt>Drawn</dt><dd>{s.drawn}</dd></div>
            <div><dt>Lost</dt><dd>{s.lost}</dd></div>
            <div><dt>Goals</dt><dd>{s.goalsFor}<span className="ht-record-sep">–</span>{s.goalsAgainst}</dd></div>
          </dl>
          <ol className="ht-formline" aria-label="Results in order">
            {form.map((o, i) => <li key={i} className={`is-${o}`}><span aria-hidden="true">{o}</span><span className="sr-only">{OUTCOME_WORD[o]}</span></li>)}
          </ol>
        </div>
      )}

      <div className="ht-team-cols">
        <div>
          <h3>Games</h3>
          {days.length ? days.map(({ day, games }) => (
            <div key={day} className="ht-day">
              {days.length > 1 || day !== 'TBD' ? <h4 className="ht-day-title">{day === 'TBD' ? 'Date to be set' : day}</h4> : null}
              <ul className="ht-games">
                {games.map(m => {
                  const side = sideIn(m);
                  const opp = side === 'home' ? m.away_team_name : m.home_team_name;
                  const o = gameOutcome(m, side);
                  const us = side === 'home' ? m.home_score : m.away_score;
                  const them = side === 'home' ? m.away_score : m.home_score;
                  const pens = m.home_penalty_score != null && m.away_penalty_score != null && (m.home_penalty_score || m.away_penalty_score)
                    ? `${side === 'home' ? m.home_penalty_score : m.away_penalty_score}–${side === 'home' ? m.away_penalty_score : m.home_penalty_score} pens` : null;
                  const stage = (m.tournament_stage || 'group') === 'group' ? m.tournament_group : tournamentMatchLabel(m);
                  return (
                    <li key={m.id}>
                      <Link href={matchPath(clubSlug, m)} className="ht-game">
                        <span className="ht-game-time">
                          {m.match_time ? formatClock(m.match_time) : 'Time TBC'}
                          {m.pitch_label && <span className="ht-sub">{m.pitch_label}</span>}
                        </span>
                        <span className="ht-game-opp">
                          <img src={crestOf(opp)} alt="" width={28} height={28} />
                          <span className="ht-game-name">
                            <span className="sr-only">Against </span>{opp}
                            {stage && <span className="ht-sub">{stage}</span>}
                          </span>
                        </span>
                        {o ? (
                          <span className={`ht-game-res is-${o}`}>
                            <span className="sr-only">{OUTCOME_WORD[o]} </span>{us}–{them}
                            {pens && <span className="ht-game-pens">{pens}</span>}
                          </span>
                        ) : isOn(m) ? (
                          <span className="ht-game-res is-live">{us}–{them}<span className="ht-game-pens">{m.status === 'halftime' || m.period === 'halftime' ? 'Half time' : <>Live <LiveMinute match={m} />&prime;</>}</span></span>
                        ) : (
                          <span className="ht-game-res is-next">{m.status === 'cancelled' ? 'Off' : 'To play'}</span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )) : <p className="ht-hint">The draw isn&apos;t out yet.</p>}
        </div>

        <div>
          {s.scorers.length > 0 && (
            <>
              <h3>Goals</h3>
              <ul className="ht-scorers">
                {s.scorers.map(p => <li key={p.name}><span>{showName(p.name)}</span><strong>{p.goals}</strong></li>)}
              </ul>
            </>
          )}
          <h3>Squad</h3>
          {groups.length ? groups.map(g => (
            <div key={g.label} className="ht-squad-group">
              <h4 className="ht-day-title">{g.label}</h4>
              <ul className="ht-squad">
                {g.list.map(p => <li key={p.id}><span className="ht-shirt">{p.shirt_number ?? ''}</span><span>{p.name}</span></li>)}
              </ul>
            </div>
          )) : <p className="ht-hint">The squad hasn&apos;t been sent yet.</p>}
        </div>
      </div>

    </section>
  );
}

const playOrder = (m: Match) => (m.match_time ? `${(m.match_date || '').slice(0, 10)}T${m.match_time}` : m.match_date || '');
const isOn = (m: Match) => m.status === 'live' || m.status === 'halftime';

/** "On now": every game being played (two pitches at once on a cup day), else the next kick-off's games */
export function OnNowStrip({ matches, clubSlug, showName, title = 'Next up' }: { matches: Match[]; clubSlug: string; showName: (n: string) => string; title?: string }) {
  const live = matches.filter(isOn);
  const upcoming = matches.filter(m => m.status === 'upcoming' && m.home_team_name !== 'TBD' && m.away_team_name !== 'TBD')
    .sort((a, b) => playOrder(a).localeCompare(playOrder(b)));
  const games = (live.length ? live : upcoming.filter(m => playOrder(m) === playOrder(upcoming[0] ?? m)))
    .sort((a, b) => (a.pitch_label || '').localeCompare(b.pitch_label || '', undefined, { numeric: true }));
  if (!games.length) return null;
  return (
    <section className="ht-onnow" aria-label={live.length ? 'On now' : title}>
      <h2 className="ht-onnow-title">{live.length ? <><span className="ht-onnow-dot" aria-hidden="true" />On now</> : title}</h2>
      <div className="ht-onnow-list">
        {games.map(m => (
          <Link key={m.id} href={matchPath(clubSlug, m)} className="ht-onnow-game">
            <span className="ht-onnow-meta">
              {m.pitch_label && <span>{m.pitch_label}</span>}
              <span className={isOn(m) ? 'is-live' : undefined}>
                {m.status === 'halftime' || m.period === 'halftime' ? 'Half time' : isOn(m) ? <><LiveMinute match={m} />&prime;</> : formatClock(m.match_time || '') || kickoffLabel(m)}
              </span>
            </span>
            <span className="ht-onnow-team"><img src={m.home_team_logo || DEFAULT_CREST} alt="" width={28} height={28} loading="lazy" />{showName(m.home_team_name)}</span>
            <span className="ht-onnow-score">{isOn(m) ? `${m.home_score ?? 0}–${m.away_score ?? 0}` : 'v'}</span>
            <span className="ht-onnow-team"><img src={m.away_team_logo || DEFAULT_CREST} alt="" width={28} height={28} loading="lazy" />{showName(m.away_team_name)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Who won it, once the final (or the last league game) is played: the page people share at the end of the day */
export function ChampionBanner({ tournament, matches, events, standingsLeader, showName }: {
  tournament: Tournament;
  matches: Match[];
  events: MatchEvent[];
  /** A league's top team */
  standingsLeader?: string;
  showName: (n: string) => string;
}) {
  const final = matches.find(m => m.tournament_stage === 'final' && m.status === 'completed');
  if (!tournamentOver(tournament, matches)) return null;
  let champion = tournament.format === 'league' ? standingsLeader : undefined;
  let finalLine: string | null = null;
  if (final) {
    const homeWon = final.winner_side ? final.winner_side === 'home'
      : final.home_score !== final.away_score ? final.home_score > final.away_score
      : (final.home_penalty_score ?? 0) > (final.away_penalty_score ?? 0);
    champion = homeWon ? final.home_team_name : final.away_team_name;
    const [w, l] = homeWon ? [final.home_score, final.away_score] : [final.away_score, final.home_score];
    const pens = final.home_score === final.away_score && (final.home_penalty_score || final.away_penalty_score)
      ? ` (${homeWon ? final.home_penalty_score : final.away_penalty_score}–${homeWon ? final.away_penalty_score : final.home_penalty_score} on penalties)` : '';
    finalLine = `Beat ${showName(homeWon ? final.away_team_name : final.home_team_name)} ${w}–${l}${pens} in the final.`;
  }
  if (!champion) return null;

  // Top scorer: real names only ("<Team> Player" is a one-tap goal with nobody named)
  const goals = new Map<string, { team: string; n: number }>();
  for (const e of events) {
    const m = matches.find(x => x.id === e.match_id);
    if (!m || (e.event_type !== 'goal' && e.event_type !== 'penalty')) continue;
    const team = e.team_side === 'away' ? m.away_team_name : m.home_team_name;
    const name = e.player_name?.trim();
    if (!name || name === `${team} Player`) continue;
    const key = `${name}|${team}`;
    goals.set(key, { team, n: (goals.get(key)?.n || 0) + 1 });
  }
  const best = Math.max(0, ...[...goals.values()].map(g => g.n));
  const top = best > 0 ? [...goals].filter(([, g]) => g.n === best).map(([k, g]) => `${showName(k.split('|')[0])} (${showName(g.team)})`) : [];

  return (
    <section className="ht-champion" aria-label="Champions">
      <p className="ht-champion-kicker">Champions</p>
      <h2>{showName(champion)} win the {tournament.name}</h2>
      {finalLine && <p>{finalLine}</p>}
      {top.length > 0 && <p className="ht-champion-scorer">Top scorer: {top.join(', ')}, {best} goal{best === 1 ? '' : 's'}</p>}
    </section>
  );
}
