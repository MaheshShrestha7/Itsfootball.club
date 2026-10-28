// A short, factual match report built only from what the club logged (score, goals, cards, Player of
// the Match): no AI writing, nothing guessed. Search engines and AI answers quote plain sentences like these.
// Junior names arrive already shortened (publicMember), and a team that hides its scores gets no report.

import type { Match, MatchEvent } from './supabase/types';
import { textToHtml } from './article-text';
import { DATE_LOCALE } from './dates';
import { TIME_ZONE } from './email/format';

export interface ReportGoal { minute: number; side: 'home' | 'away'; player: string; penalty?: boolean; ownGoal?: boolean }

export interface ReportInput {
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  /** "Sydney Premier League"; left out for a friendly */
  competition?: string;
  venue?: string;
  /** "Saturday 17 October 2026" */
  dateLabel?: string;
  goals: ReportGoal[];
  redCards: { side: 'home' | 'away'; player: string; minute: number }[];
  playerOfTheMatch?: string;
}

const list = (items: string[]) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

/** "Chris Nguyen (23', 67')", grouped per scorer in the order they first scored */
function scorers(goals: ReportGoal[]) {
  const by = new Map<string, string[]>();
  for (const g of [...goals].sort((a, b) => a.minute - b.minute)) {
    const name = g.ownGoal ? `${g.player} (own goal)` : g.player;
    by.set(name, [...(by.get(name) || []), `${g.minute}'${g.penalty ? ' pen' : ''}`]);
  }
  return list([...by].map(([name, mins]) => `${name} (${mins.join(', ')})`));
}

/** The report as paragraphs; empty when there's nothing honest to say */
export function matchReport(r: ReportInput): string[] {
  const [hs, as] = [r.homeScore, r.awayScore];
  const result = hs === as
    ? `${r.home} and ${r.away} drew ${hs}–${as}`
    : hs > as ? `${r.home} beat ${r.away} ${hs}–${as}` : `${r.away} won ${as}–${hs} away at ${r.home}`;
  const where = [r.competition && `in the ${r.competition}`, r.venue && `at ${r.venue}`, r.dateLabel && `on ${r.dateLabel}`].filter(Boolean).join(' ');
  const out = [`${result}${where ? ` ${where}` : ''}.`];

  // An own goal counts for the other side, so it's listed with the team it was scored for
  const forSide = (side: 'home' | 'away') => r.goals.filter(g => (g.ownGoal ? (g.side === 'home' ? 'away' : 'home') : g.side) === side);
  const lines: string[] = [];
  for (const side of ['home', 'away'] as const) {
    const g = forSide(side);
    if (g.length) lines.push(`${side === 'home' ? r.home : r.away}: ${scorers(g)}`);
  }
  const logged = r.goals.length;
  if (lines.length) out.push(`Goals for ${lines.join('. Goals for ')}.`);
  if (hs + as > 0 && logged < hs + as) out.push(logged ? 'Not every goal was logged.' : 'Goal details weren’t logged for this match.');

  if (r.redCards.length) out.push(`Sent off: ${list(r.redCards.map(c => `${c.player} (${c.side === 'home' ? r.home : r.away}, ${c.minute}')`))}.`);
  if (r.playerOfTheMatch) out.push(`Player of the Match: ${r.playerOfTheMatch}.`);
  return out;
}

/**
 * The report's input from a finished match and its logged events. Pass the events and Player of
 * the Match name as the public should see them (juniors shortened, none when scores are hidden).
 */
export function reportInputFor(
  match: Pick<Match, 'home_team_name' | 'away_team_name' | 'home_score' | 'away_score' | 'competition' | 'venue' | 'match_date'>,
  events: Pick<MatchEvent, 'event_type' | 'minute' | 'team_side' | 'player_name'>[],
  playerOfTheMatch?: string
): ReportInput {
  return {
    home: match.home_team_name,
    away: match.away_team_name,
    homeScore: match.home_score ?? 0,
    awayScore: match.away_score ?? 0,
    // The old placeholder competition every fixture once had isn't worth a mention
    competition: match.competition && match.competition !== 'Premier Regional League' ? match.competition : undefined,
    venue: match.venue,
    // The club's time zone, so the server's HTML and the browser agree on the day
    dateLabel: match.match_date ? new Date(match.match_date).toLocaleDateString(DATE_LOCALE, { timeZone: TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : undefined,
    goals: events.filter(e => ['goal', 'penalty', 'own_goal'].includes(e.event_type)).map(e => ({ minute: e.minute, side: e.team_side, player: e.player_name, penalty: e.event_type === 'penalty', ownGoal: e.event_type === 'own_goal' })),
    redCards: events.filter(e => e.event_type === 'red_card').map(e => ({ minute: e.minute, side: e.team_side, player: e.player_name })),
    playerOfTheMatch,
  };
}

/** The report as a news post to tidy up and publish: "Riverside FC 3–1 Hills United". Null when there's nothing to say. */
export function matchReportArticle(r: ReportInput): { title: string; summary: string; content: string } | null {
  const paragraphs = matchReport(r);
  if (!paragraphs.length) return null;
  return {
    title: `${r.home} ${r.homeScore}–${r.awayScore} ${r.away}`,
    summary: paragraphs[0],
    content: textToHtml(paragraphs.join('\n\n')),
  };
}
