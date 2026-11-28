'use client';

// The public tournament page's Overview tab: one snapshot that follows the tournament. Before the first
// kick-off it says when, how it works and who's playing; while games run, what's on, where we are and
// the latest results; once the final is played, who won and how. Only what the host already stores.
import React from 'react';
import Link from 'next/link';
import LocalTime from '@/components/LocalTime';
import EventCountdown from '@/components/EventCountdown';
import PlayerOfTournament from '@/components/tournament/PlayerOfTournament';
import { ChampionBanner, OnNowStrip, tournamentOver } from '@/components/tournament/HostedPublic';
import { DEFAULT_CREST } from '@/lib/crest';
import { kickoffIso, latestFirst, soonestFirst } from '@/lib/fixtures';
import { matchPath } from '@/lib/slugs';
import { plainText } from '@/lib/match-report';
import { tournamentStats } from '@/lib/tournament-stats';
import { GROUP_LETTERS } from '@/lib/tournament-engine';
import { WRITEUP_LABELS, type tournamentWriteups } from '@/lib/tournament-writeups';
import type { ClubMember, Match, MatchEvent, Tournament, TournamentParticipant, TournamentStanding } from '@/lib/supabase/types';
import '@/components/tournament/hosted.css';

export type TournamentPhase = 'before' | 'during' | 'after';

const isOn = (m: Match) => m.status === 'live' || m.status === 'halftime';

/** From the games, not only the status the host sets: hosts often forget to mark a cup completed */
export function tournamentPhase(tournament: Tournament, matches: Match[]): TournamentPhase {
  if (tournamentOver(tournament, matches)) return 'after';
  return matches.some(m => m.status === 'completed' || isOn(m)) ? 'during' : 'before';
}

const STAGES: [NonNullable<Match['tournament_stage']>, string][] = [
  ['group', 'Group stage'], ['round_of_32', 'Round of 32'], ['round_of_16', 'Round of 16'],
  ['quarter_final', 'Quarter-finals'], ['semi_final', 'Semi-finals'], ['final', 'Final'],
];
const koRound = (teams: number) => (teams <= 2 ? 'the final' : teams <= 4 ? 'the semi-finals' : teams <= 8 ? 'the quarter-finals' : 'the knockout rounds');
const mins = (half?: number | null) => (half ? `2 × ${half} minutes` : null);

/** "8 teams in 2 groups of 4. The top 2 in each group go into the semi-finals." from the stored settings */
function formatLines(t: Tournament, teams: number): string[] {
  const lines: string[] = [];
  if (t.format === 'league') lines.push(`${teams} teams, everyone plays everyone once. Most points wins.`);
  else if (t.format === 'knockout') lines.push(`${teams} teams, straight knockout. Win and you're through.`);
  else {
    const groups = t.group_count ?? 1;
    const adv = t.teams_advancing_per_group ?? 2;
    const per = Math.round(teams / groups);
    lines.push(groups > 1 ? `${teams} teams in ${groups} groups of ${per}.` : `${teams} teams in one group.`);
    lines.push(`The top ${adv} ${groups > 1 ? 'in each group go' : 'go'} into ${koRound(groups * adv)}${t.has_third_place_match ? ', with a game for third place' : ''}.`);
  }
  const group = mins(t.half_minutes);
  const ko = t.format === 'group_knockout' ? mins(t.ko_half_minutes) : null;
  const final = t.format !== 'league' ? mins(t.final_half_minutes) : null;
  const len = [group && (ko || final ? `Group games ${group}` : `Games ${group}`), ko && `knockout games ${ko}`, final && `the final ${final}`].filter(Boolean);
  if (len.length) lines.push(`${len.join(', ')}.`);
  if (t.pitches && t.pitches > 1) lines.push(`Played on ${t.pitches} pitches at once.`);
  return lines;
}

type Writeups = ReturnType<typeof tournamentWriteups>;

export default function TournamentOverview({ tournament, matches, events, participants, members, clubSlug, writeups, standings, showName, onTeam, onTab }: {
  tournament: Tournament;
  matches: Match[];
  events: MatchEvent[];
  participants: TournamentParticipant[];
  members: ClubMember[];
  clubSlug: string;
  writeups: Writeups;
  standings: (group?: string) => TournamentStanding[];
  showName: (n: string) => string;
  onTeam: (teamId: string) => void;
  onTab: (tab: 'standings' | 'fixtures' | 'stats' | 'news' | 'teams') => void;
}) {
  const phase = tournamentPhase(tournament, matches);
  const ids = new Set(matches.map(m => m.id));
  const ev = events.filter(e => ids.has(e.match_id));

  if (phase === 'before') {
    const named = matches.filter(m => m.match_date && m.home_team_name !== 'TBD').sort(soonestFirst);
    const first = named[0];
    const firstAt = first ? kickoffIso(first) : null;
    const groups = tournament.format === 'group_knockout'
      ? GROUP_LETTERS.slice(0, tournament.group_count ?? 1).map(g => ({ g, list: participants.filter(p => p.group === g) })).filter(x => x.list.length)
      : [];
    const lines = formatLines(tournament, participants.length);
    return (
      <div className="tp-ov">
        {firstAt && <EventCountdown startTime={firstAt} />}
        <section className="glass-panel tp-card tp-ov-how" aria-labelledby="tp-ov-how">
          <h3 id="tp-ov-how">How it works</h3>
          {lines.map(l => <p key={l}>{l}</p>)}
          {tournament.description && <p className="tp-ov-desc">{tournament.description}</p>}
        </section>
        {participants.length > 0 && (
          <section className="glass-panel tp-card" aria-labelledby="tp-ov-teams">
            <div className="tp-ov-head">
              <h3 id="tp-ov-teams">Who&apos;s playing</h3>
              <button type="button" className="tp-ov-more" onClick={() => onTab('teams')}>All {participants.length} teams</button>
            </div>
            {groups.length > 1 ? (
              <div className="tp-ov-groups">
                {groups.map(({ g, list }) => (
                  <div key={g}>
                    <h4>Group {g}</h4>
                    <CrestList teams={list} onTeam={onTeam} />
                  </div>
                ))}
              </div>
            ) : <CrestList teams={participants} onTeam={onTeam} />}
          </section>
        )}
        {matches.length
          ? <OnNowStrip matches={matches} clubSlug={clubSlug} showName={showName} title="First games" />
          : <p className="ht-empty">The draw hasn&apos;t been made yet. The games show here once it is.</p>}
      </div>
    );
  }

  const s = tournamentStats(matches, ev, participants);
  const top = s.scorers[0];
  const topNames = top ? s.scorers.filter(r => r.goals === top.goals) : [];

  if (phase === 'during') {
    const latest = matches.filter(m => m.status === 'completed').sort(latestFirst).slice(0, 3);
    // The stage of the first game still to finish, in play order
    const left = matches.filter(m => m.status !== 'completed' && m.status !== 'cancelled');
    const order = STAGES.map(([k]) => k);
    const now = left.map(m => m.tournament_stage || 'group').sort((a, b) => order.indexOf(a) - order.indexOf(b))[0];
    const stages = STAGES.filter(([k]) => matches.some(m => (m.tournament_stage || 'group') === k));
    const inGroups = (now ?? 'group') === 'group' && tournament.format !== 'knockout';
    const adv = tournament.format === 'league' ? 3 : (tournament.teams_advancing_per_group ?? 2);
    const tables = tournament.format === 'group_knockout'
      ? GROUP_LETTERS.slice(0, tournament.group_count ?? 1).map(g => ({ title: (tournament.group_count ?? 1) > 1 ? `Group ${g}` : '', rows: standings(g).slice(0, adv) }))
      : [{ title: '', rows: standings().slice(0, adv) }];
    const latestWriteup = writeups[0];
    return (
      <div className="tp-ov">
        <OnNowStrip matches={matches} clubSlug={clubSlug} showName={showName} />
        <section className="glass-panel tp-card tp-ov-stage" aria-label="Where the tournament is">
          {stages.length > 1 && (
            <ol className="tp-ov-steps">
              {stages.map(([k, label]) => (
                <li key={k} aria-current={k === now ? 'step' : undefined} className={order.indexOf(k) < order.indexOf(now ?? 'final') ? 'is-done' : undefined}>{label}</li>
              ))}
            </ol>
          )}
          <p><b>{s.played}</b> of {s.total} games played, <b>{s.goals}</b> {s.goals === 1 ? 'goal' : 'goals'} so far
            {topNames.length > 0 && <>. {topNames.slice(0, 2).map(r => `${showName(r.name)} (${showName(r.team)})`).join(' and ')}{topNames.length > 2 ? ` and ${topNames.length - 2} more` : ''} {topNames.length > 1 ? 'lead' : 'leads'} the scorers with {top.goals}</>}.</p>
        </section>
        <div className="tp-grid">
          <section className="glass-panel tp-card" aria-labelledby="tp-ov-latest">
            <div className="tp-ov-head">
              <h3 id="tp-ov-latest">Latest results</h3>
              <button type="button" className="tp-ov-more" onClick={() => onTab('fixtures')}>All games</button>
            </div>
            <ul className="tp-ov-results">
              {latest.map(m => (
                <li key={m.id}>
                  <Link href={matchPath(clubSlug, m)}>
                    <span className="tp-ov-t">{showName(m.home_team_name)}</span>
                    <b>{m.home_score}–{m.away_score}</b>
                    <span className="tp-ov-t">{showName(m.away_team_name)}</span>
                    {m.home_score === m.away_score && m.home_penalty_score != null && <small>{m.home_penalty_score}–{m.away_penalty_score} on penalties</small>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          {inGroups && (
            <section className="glass-panel tp-card" aria-labelledby="tp-ov-leaders">
              <div className="tp-ov-head">
                <h3 id="tp-ov-leaders">{tournament.format === 'league' ? 'Top of the table' : 'Going through now'}</h3>
                <button type="button" className="tp-ov-more" onClick={() => onTab('standings')}>Full table</button>
              </div>
              {tables.map(t => (
                <div key={t.title || 'all'} className="tp-ov-table">
                  {t.title && <h4>{t.title}</h4>}
                  <ol>
                    {t.rows.map(r => (
                      <li key={r.team_id}>
                        <button type="button" onClick={() => onTeam(r.team_id)}>
                          <img src={r.logo_url || DEFAULT_CREST} alt="" width={22} height={22} loading="lazy" />
                          <span className="tp-ov-t">{r.name}</span>
                          <span className="tp-ov-pts">{r.points} pts</span>
                        </button>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </section>
          )}
        </div>
        {latestWriteup && <WriteupRow w={latestWriteup} />}
      </div>
    );
  }

  // After the end
  const third = matches.find(m => m.tournament_stage === 'third_place' && m.status === 'completed');
  const thirdWon = third && (third.home_score !== third.away_score ? third.home_score > third.away_score
    : third.winner_side ? third.winner_side === 'home' : (third.home_penalty_score ?? 0) > (third.away_penalty_score ?? 0));
  const roundUp = writeups.find(w => w.kind === 'round-up') ?? writeups[0];
  return (
    <div className="tp-ov">
      <ChampionBanner tournament={tournament} matches={matches} events={ev} showName={showName}
        standingsLeader={tournament.format === 'league' ? standings()[0]?.name : undefined} />
      {third && <p className="tp-ov-third">Third place went to {showName(thirdWon ? third.home_team_name : third.away_team_name)}, who beat {showName(thirdWon ? third.away_team_name : third.home_team_name)} {Math.max(third.home_score, third.away_score)}–{Math.min(third.home_score, third.away_score)}{third.home_score === third.away_score ? ' on penalties' : ''}.</p>}
      <PlayerOfTournament tournament={tournament} members={members} />
      {roundUp && <WriteupRow w={roundUp} lead />}
      <section className="tp-sofar glass-panel" aria-label="The tournament in numbers">
        <div><b>{s.played}</b><span>games played</span></div>
        <div><b>{s.goals}</b><span>{s.goals === 1 ? 'goal' : 'goals'}</span></div>
        <div><b>{s.played ? (s.goals / s.played).toFixed(1) : '0'}</b><span>goals a game</span></div>
        <div><b>{s.shootouts}</b><span>penalty shoot-out{s.shootouts === 1 ? '' : 's'}</span></div>
      </section>
      {(s.fewestConceded || s.biggestWin) && (
        <section className="glass-panel tp-card" aria-labelledby="tp-ov-best">
          <div className="tp-ov-head">
            <h3 id="tp-ov-best">Best of the tournament</h3>
            <button type="button" className="tp-ov-more" onClick={() => onTab('stats')}>All stats</button>
          </div>
          <dl className="tp-records">
            {s.fewestConceded && <div><dt>Best defence</dt><dd><span className="tp-teams">{s.fewestConceded.teams.slice(0, 2).map(n => <span key={n} className="tp-team">{showName(n)}</span>)}</span><b>{s.fewestConceded.value} let in</b></dd></div>}
            {s.mostScored && s.mostScored.value > 0 && <div><dt>Most goals scored</dt><dd><span className="tp-teams">{s.mostScored.teams.slice(0, 2).map(n => <span key={n} className="tp-team">{showName(n)}</span>)}</span><b>{s.mostScored.value}</b></dd></div>}
            {s.biggestWin && <div><dt>Biggest win</dt><dd><Link className="tp-game" href={matchPath(clubSlug, s.biggestWin)}>{showName(s.biggestWin.home_team_name)} {s.biggestWin.home_score}–{s.biggestWin.away_score} {showName(s.biggestWin.away_team_name)}</Link></dd></div>}
          </dl>
        </section>
      )}
    </div>
  );
}

function CrestList({ teams, onTeam }: { teams: TournamentParticipant[]; onTeam: (id: string) => void }) {
  return (
    <ul className="tp-ov-crests">
      {teams.map(t => (
        <li key={t.id}>
          <button type="button" onClick={() => onTeam(t.id)}>
            <img src={t.logo_url || DEFAULT_CREST} alt="" width={36} height={36} loading="lazy" />
            <span>{t.name}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function WriteupRow({ w, lead }: { w: Writeups[number]; lead?: boolean }) {
  return (
    <Link href={w.href} className={`glass-panel tn-row${lead ? ' tp-ov-read' : ''}`}>
      <span className="tn-tag">{WRITEUP_LABELS[w.kind]}{w.at && <>, <LocalTime value={w.at} /></>}</span>
      <span className="tn-head">{w.writeup.headline}</span>
      <span className="tn-lead">{plainText(w.writeup.lead)}</span>
    </Link>
  );
}
