// The public tournament page's Stats tab: worked out from the tournament's games and the goals and
// cards logged in Match Centre. Nothing is stored. A goal logged with the one-tap "<Team> Player"
// stand-in counts for the team but has no scorer.
import type { Match, MatchEvent, TournamentParticipant } from './supabase/types';

export interface ScorerRow { name: string; team: string; goals: number; pens: number }
export interface AssistRow { name: string; team: string; assists: number }
export interface TeamRecord { teams: string[]; value: number }

export interface TournamentStats {
  played: number;
  total: number;
  goals: number;
  shootouts: number;
  /** Goals with no scorer's name (own goals not counted here) */
  unnamed: number;
  scorers: ScorerRow[];
  assists: AssistRow[];
  mostScored: TeamRecord | null;
  fewestConceded: TeamRecord | null;
  /** Left out when nobody has one, or more than 3 teams share it: no record then */
  cleanSheets: TeamRecord | null;
  /** Teams with games played and no defeats */
  unbeaten: string[];
  biggestWin: Match | null;
  /** Left out when it's the same game as the biggest win */
  mostGoals: Match | null;
  fastest: { player: string; team: string; minute: number; match: Match; opponent: string } | null;
}

/** Who won: the score, else the side the shoot-out (or the host) decided; null for a draw */
export function winnerSide(m: Match): 'home' | 'away' | null {
  if (m.home_score !== m.away_score) return m.home_score > m.away_score ? 'home' : 'away';
  if (m.winner_side) return m.winner_side;
  const [h, a] = [m.home_penalty_score ?? 0, m.away_penalty_score ?? 0];
  return h === a ? null : h > a ? 'home' : 'away';
}

const isGoal = (e: MatchEvent) => e.event_type === 'goal' || e.event_type === 'penalty' || e.event_type === 'own_goal';
/** A goal with a real name: not the one-tap goal's "<Team> Player" */
export const namedScorer = (e: MatchEvent, team: string) => {
  const n = e.player_name?.trim();
  return !!n && n !== `${team} Player`;
};

/** Scorers of these games, most goals first (own goals and nameless goals left out) */
export function topScorers(matches: Match[], events: MatchEvent[]): ScorerRow[] {
  const byId = new Map(matches.filter(m => m.status !== 'upcoming' && m.status !== 'cancelled').map(m => [m.id, m]));
  const rows = new Map<string, ScorerRow>();
  for (const e of events) {
    const m = byId.get(e.match_id);
    if (!m || (e.event_type !== 'goal' && e.event_type !== 'penalty')) continue;
    const team = e.team_side === 'away' ? m.away_team_name : m.home_team_name;
    if (!namedScorer(e, team)) continue;
    const name = e.player_name.trim();
    const k = `${name}|${team}`;
    const r = rows.get(k) || { name, team, goals: 0, pens: 0 };
    r.goals++;
    if (e.event_type === 'penalty') r.pens++;
    rows.set(k, r);
  }
  return [...rows.values()].sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name));
}

export function tournamentStats(matches: Match[], events: MatchEvent[], participants: TournamentParticipant[]): TournamentStats {
  const done = matches.filter(m => m.status === 'completed');
  const ids = new Set(done.map(m => m.id));
  const byId = new Map(done.map(m => [m.id, m]));
  const ev = events.filter(e => ids.has(e.match_id));
  const goals = done.reduce((s, m) => s + (m.home_score || 0) + (m.away_score || 0), 0);
  const shootouts = done.filter(m => m.home_score === m.away_score && (m.home_penalty_score || m.away_penalty_score)).length;
  const scorers = topScorers(done, ev);

  const assists = new Map<string, AssistRow>();
  let fastest: TournamentStats['fastest'] = null;
  for (const e of ev) {
    const m = byId.get(e.match_id)!;
    const team = e.team_side === 'away' ? m.away_team_name : m.home_team_name;
    if (isGoal(e) && e.event_type !== 'own_goal' && namedScorer(e, team) && (!fastest || e.minute < fastest.minute)) {
      fastest = { player: e.player_name.trim(), team, minute: e.minute, match: m, opponent: e.team_side === 'away' ? m.home_team_name : m.away_team_name };
    }
    const a = e.assist_player_name?.trim();
    if (a && (e.event_type === 'goal' || e.event_type === 'penalty')) {
      const k = `${a}|${team}`;
      assists.set(k, { name: a, team, assists: (assists.get(k)?.assists || 0) + 1 });
    }
  }

  const teams = new Map(participants.map(p => [p.name, { gf: 0, ga: 0, cs: 0, lost: 0, played: 0 }]));
  for (const m of done) for (const side of ['home', 'away'] as const) {
    const r = teams.get(side === 'home' ? m.home_team_name : m.away_team_name);
    if (!r) continue;
    const f = side === 'home' ? m.home_score : m.away_score;
    const a = side === 'home' ? m.away_score : m.home_score;
    r.played++; r.gf += f; r.ga += a;
    if (a === 0) r.cs++;
    // A shoot-out loss is a defeat in the cup
    const w = winnerSide(m);
    if (w && w !== side) r.lost++;
  }
  const rows = [...teams].filter(([, r]) => r.played > 0);
  const best = (v: (r: { gf: number; ga: number; cs: number }) => number, low = false): TeamRecord | null => {
    if (!rows.length) return null;
    const value = (low ? Math.min : Math.max)(...rows.map(([, r]) => v(r)));
    return { value, teams: rows.filter(([, r]) => v(r) === value).map(([n]) => n) };
  };
  const cs = best(r => r.cs);
  const total = (m: Match) => m.home_score + m.away_score;
  const margin = (m: Match) => Math.abs(m.home_score - m.away_score);
  const biggestWin = [...done].filter(m => margin(m) > 0).sort((a, b) => margin(b) - margin(a) || total(b) - total(a))[0] ?? null;
  const mostGoals = [...done].filter(m => total(m) > 0).sort((a, b) => total(b) - total(a) || margin(a) - margin(b))[0] ?? null;
  const named = scorers.reduce((s, r) => s + r.goals, 0);
  const ownGoals = ev.filter(e => e.event_type === 'own_goal').length;

  return {
    played: done.length, total: matches.length, goals, shootouts,
    // Goals with no event at all (score typed in) count as unnamed too
    unnamed: Math.max(0, goals - named - ownGoals),
    scorers, assists: [...assists.values()].sort((a, b) => b.assists - a.assists || a.name.localeCompare(b.name)),
    mostScored: best(r => r.gf), fewestConceded: best(r => r.ga, true),
    cleanSheets: cs && cs.value > 0 && cs.teams.length <= 3 ? cs : null,
    unbeaten: rows.filter(([, r]) => r.lost === 0).map(([n]) => n),
    biggestWin, mostGoals: mostGoals && mostGoals.id !== biggestWin?.id ? mostGoals : null,
    fastest,
  };
}
