'use client';

// Public side of hosted tournaments: the age group switch (TX-3) and one team's page (TX-9) with its
// crest, colours, staff, squad (junior names shortened by tournament_squads_public), games, how they
// did, and the "How we did" share graphic (TX-10).
import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { TeamCrest } from '@/components/tournament/TournamentTeamsTab';
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

  const [view, setView] = useState<'overview' | 'matches' | 'squad'>('overview');
  const teamOf = (name: string) => participants.find(p => p.name === name);
  const crest = (name: string, size: number) => {
    const p = teamOf(name);
    return p ? <TeamCrest team={p} size={size} /> : <img className="tt-crest" src={DEFAULT_CREST} alt="" width={size} height={size} />;
  };
  const short = (name: string) => (teamOf(name)?.short_name?.trim() || name.slice(0, 3)).toUpperCase();
  const recent = s.games.filter(m => m.status === 'completed' || isOn(m));
  const upcoming = s.games.filter(m => m.status === 'upcoming');
  const cleanSheetsOf = (name: string, games: Match[]) => games.filter(m => m.status === 'completed' && (m.home_team_name === name ? m.away_score : m.home_score) === 0).length;
  const cleanSheets = cleanSheetsOf(team.name, s.games);
  // Compare clubs: any other team, side by side, and their games against each other
  const [rivalId, setRivalId] = useState('');
  const rival = participants.find(p => p.id === rivalId && p.id !== team.id);
  const rs = rival ? teamSummary(rival.name, matches, events.filter(e => ids.has(e.match_id))) : null;
  const meetings = rival ? s.games.filter(m => m.status === 'completed' && (m.home_team_name === rival.name || m.away_team_name === rival.name)) : [];
  const avg = (n: number) => (s.played ? (n / s.played).toFixed(1) : '0');
  // The ring: won, drawn and lost as parts of the games played
  const arc = [s.won, s.drawn, s.lost].map(n => (s.played ? (n / s.played) * 100 : 0));

  const gameRow = (m: Match) => {
    const side = sideIn(m);
    const opp = side === 'home' ? m.away_team_name : m.home_team_name;
    const o = gameOutcome(m, side);
    const us = side === 'home' ? m.home_score : m.away_score;
    const them = side === 'home' ? m.away_score : m.home_score;
    const pens = m.home_penalty_score != null && m.away_penalty_score != null && (m.home_penalty_score || m.away_penalty_score)
      ? `${side === 'home' ? m.home_penalty_score : m.away_penalty_score}–${side === 'home' ? m.away_penalty_score : m.home_penalty_score} pens` : null;
    const stage = (m.tournament_stage || 'group') === 'group' ? m.tournament_group && `Group ${m.tournament_group}` : tournamentMatchLabel(m);
    return (
      <li key={m.id}>
        <Link href={matchPath(clubSlug, m)} className="ht-game">
          <span className="ht-game-time">
            {m.match_time ? formatClock(m.match_time) : 'Time TBC'}
            {m.pitch_label && <span className="ht-sub">{m.pitch_label}</span>}
          </span>
          <span className="ht-game-opp">
            {crest(opp, 28)}
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
  };

  return (
    <section className="tp" aria-labelledby="ht-team-name"
      style={{ '--ht-c1': team.color || undefined, '--ht-c2': team.secondary_color || team.color || undefined } as React.CSSProperties}>
      <header className="tp-hero">
        <button type="button" className="tp-back" onClick={onClose}><ArrowLeft size={16} aria-hidden="true" />All teams</button>
        <div className="tp-id">
          <TeamCrest team={team} size={84} />
          <div className="tp-id-text">
            <h2 id="ht-team-name">{team.name}</h2>
            <p className="tp-tags">
              {team.group && <span>Group {team.group}</span>}
              {s.finish && <span className="is-finish">{s.finish === 'Winners' ? 'Champions' : s.finish}</span>}
            </p>
          </div>
        </div>
        {form.length > 0 && (
          <div className="tp-form">
            <span>Form guide</span>
            <ol aria-label="Results in order">
              {form.map((o, i) => <li key={i} className={`is-${o}`}><span aria-hidden="true">{o}</span><span className="sr-only">{OUTCOME_WORD[o]}</span></li>)}
            </ol>
          </div>
        )}
        {staff && <p className="tp-meta">{staff}</p>}
        <div className="tp-actions">
          {clubPage && <Link className="ht-link-btn" href={clubPage.href}>{clubPage.name}&rsquo;s club page <ExternalLink size={13} aria-hidden="true" /></Link>}
          <ShareLinkButton url={`${pathname}?team=${team.id}`} title={`${team.name} at ${title}`} label="Share team page" campaign={`tournament-team/${team.name}`} />
          {s.played > 0 && (
            <button type="button" className="btn btn-secondary btn-sm ht-share" onClick={share} disabled={busy}>
              <ImageIcon size={14} aria-hidden="true" /> {busy ? 'Making the graphic…' : done ? 'Share how we did' : 'Share results so far'}
            </button>
          )}
        </div>
      </header>

      <div className="tp-tabs" role="tablist" aria-label={`${team.name} sections`}>
        {(['overview', 'matches', 'squad'] as const).map(v => (
          <button key={v} type="button" role="tab" aria-selected={view === v} className="tp-tab" onClick={() => setView(v)}>
            {v === 'overview' ? 'Overview' : v === 'matches' ? 'Matches' : 'Squad'}
          </button>
        ))}
      </div>

      {view === 'overview' && (
        <div className="tp-body">
          {recent.length > 0 && (
            <ul className="tp-results" aria-label="Results">
              {recent.map(m => {
                const side = sideIn(m);
                const opp = side === 'home' ? m.away_team_name : m.home_team_name;
                const o = gameOutcome(m, side);
                return (
                  <li key={m.id}>
                    <Link href={matchPath(clubSlug, m)} className="tp-result" data-o={o || 'live'}>
                      <span className="tp-result-ring">{crest(m.home_team_name, 26)}{crest(m.away_team_name, 26)}</span>
                      <span className="tp-result-score">{short(m.home_team_name)} {m.home_score}-{m.away_score} {short(m.away_team_name)}</span>
                      <span className="sr-only">{o ? `${OUTCOME_WORD[o]} against ${opp}` : `Playing ${opp} now`}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {upcoming.length > 0 && (
            <section className="tp-card" aria-labelledby="tp-next">
              <h3 id="tp-next">Matches</h3>
              <ul className="tp-next">
                {upcoming.map(m => (
                  <li key={m.id}>
                    <Link href={matchPath(clubSlug, m)} className="tp-fixture">
                      <span className="tp-fixture-when">{[fixtureWhenLabel({ match_date: m.match_date, match_time: '' }), m.match_time && formatClock(m.match_time), m.pitch_label].filter(Boolean).join(', ')}</span>
                      <span className="tp-fixture-team">{crest(m.home_team_name, 20)}{m.home_team_name}</span>
                      <span className="tp-fixture-team">{crest(m.away_team_name, 20)}{m.away_team_name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {s.played > 0 && (
            <section className="tp-card" aria-labelledby="tp-stats">
              <h3 id="tp-stats">Key stats</h3>
              <div className="tp-played">
                <div className="tp-ring">
                  <svg viewBox="0 0 100 100" aria-hidden="true">
                    <circle className="tp-ring-track" cx="50" cy="50" r="44" pathLength={100} />
                    {arc.map((len, i) => len > 0 && (
                      <circle key={i} className={`tp-ring-${'WDL'[i]}`} cx="50" cy="50" r="44" pathLength={100}
                        strokeDasharray={`${len} ${100 - len}`} strokeDashoffset={-arc.slice(0, i).reduce((x, y) => x + y, 0)} />
                    ))}
                  </svg>
                  <span><b>{s.played}</b>Played</span>
                </div>
                <dl className="tp-wdl">
                  <div className="is-W"><dt>Won</dt><dd>{s.won}</dd></div>
                  <div className="is-D"><dt>Drawn</dt><dd>{s.drawn}</dd></div>
                  <div className="is-L"><dt>Lost</dt><dd>{s.lost}</dd></div>
                </dl>
              </div>
              <dl className="tp-nums">
                <div><dd>{s.goalsFor}</dd><dt>Goals scored<span>{avg(s.goalsFor)} a game</span></dt></div>
                <div><dd>{s.goalsAgainst}</dd><dt>Goals conceded<span>{avg(s.goalsAgainst)} a game</span></dt></div>
                <div><dd>{cleanSheets}</dd><dt>Clean sheets</dt></div>
                <div><dd>{s.yellow}</dd><dt>Yellow cards</dt></div>
                <div><dd>{s.red}</dd><dt>Red cards</dt></div>
              </dl>
            </section>
          )}

          {participants.length > 1 && (
            <section className="tp-card" aria-labelledby="tp-compare">
              <h3 id="tp-compare">Compare clubs</h3>
              <div className="tp-vs">
                <span className="tp-vs-team">{crest(team.name, 48)}<span>{team.name}</span></span>
                <span className="tp-vs-v">vs</span>
                <label className="tp-vs-team">
                  {rival ? crest(rival.name, 48) : <img className="tt-crest" src={DEFAULT_CREST} alt="" width={48} height={48} />}
                  <span className="sr-only">Team to compare with</span>
                  <select className="tp-vs-pick" value={rival?.id || ''} onChange={e => setRivalId(e.target.value)}>
                    <option value="">Pick a team</option>
                    {participants.filter(p => p.id !== team.id).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </label>
              </div>
              {rival && rs && (
                <>
                  <dl className="tp-compare">
                    {([['Played', s.played, rs.played], ['Won', s.won, rs.won], ['Drawn', s.drawn, rs.drawn], ['Lost', s.lost, rs.lost],
                      ['Goals scored', s.goalsFor, rs.goalsFor], ['Goals conceded', s.goalsAgainst, rs.goalsAgainst],
                      ['Clean sheets', cleanSheets, cleanSheetsOf(rival.name, rs.games)]] as const).map(([label, a, b]) => (
                      <div key={label}><dd>{a}</dd><dt>{label}</dt><dd>{b}</dd></div>
                    ))}
                  </dl>
                  <p className="tp-h2h">
                    {meetings.length
                      ? <>Against each other: {meetings.map(m => `${m.home_team_name} ${m.home_score}-${m.away_score} ${m.away_team_name}`).join('; ')}</>
                      : 'They haven\u2019t played each other yet.'}
                  </p>
                </>
              )}
            </section>
          )}

          {s.scorers.length > 0 && (
            <section className="tp-card" aria-labelledby="tp-goals">
              <h3 id="tp-goals">Top scorers</h3>
              <ul className="ht-scorers">
                {s.scorers.map(p => <li key={p.name}><span>{showName(p.name)}</span><strong>{p.goals}</strong></li>)}
              </ul>
            </section>
          )}

          <section className="tp-card" aria-labelledby="tp-squad">
            <h3 id="tp-squad">Squad</h3>
            {players.length ? (
              <>
                <ul className="tp-squad-peek">
                  {players.slice(0, 8).map(p => <li key={p.id}><span className="ht-shirt">{p.shirt_number ?? ''}</span><span>{p.name}</span></li>)}
                </ul>
                <button type="button" className="btn btn-secondary btn-sm tp-more" onClick={() => setView('squad')}>See full squad</button>
              </>
            ) : <p className="ht-hint">The squad hasn&apos;t been sent yet.</p>}
          </section>
        </div>
      )}

      {view === 'matches' && (
        <div className="tp-body tp-card">
          {days.length ? days.map(({ day, games }) => (
            <div key={day} className="ht-day">
              {days.length > 1 || day !== 'TBD' ? <h4 className="ht-day-title">{day === 'TBD' ? 'Date to be set' : day}</h4> : null}
              <ul className="ht-games">{games.map(gameRow)}</ul>
            </div>
          )) : <p className="ht-hint">The draw isn&apos;t out yet.</p>}
        </div>
      )}

      {view === 'squad' && (
        <div className="tp-body tp-card">
          {groups.length ? groups.map(g => (
            <div key={g.label} className="ht-squad-group">
              <h4 className="ht-day-title">{g.label}</h4>
              <ul className="ht-squad">
                {g.list.map(p => <li key={p.id}><span className="ht-shirt">{p.shirt_number ?? ''}</span><span>{p.name}</span></li>)}
              </ul>
            </div>
          )) : <p className="ht-hint">The squad hasn&apos;t been sent yet.</p>}
        </div>
      )}
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
