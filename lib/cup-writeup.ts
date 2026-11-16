// The write-up for a completed cup (a club event with linked games), like the match report but for the
// whole day: how far the team got, then each game in order, then the totals. Every sentence comes from
// what the club logged, plus three things only the club can say (how the team finished, who won the cup
// and a few words of its own), asked for when the event is marked Completed.
import type { Club, ClubEvent, ClubTeam, CupFinish, Match, MatchEvent } from './supabase/types';
import { clubTimeZone, DATE_LOCALE } from './dates';
import { clubResult, hasKickoffTime, kickoff } from './fixtures';
import { halfMinutes } from './match-length';
import { competitionName, publicEvents, type ReportCard } from './match-article';
import { plainText } from './match-report';
import { matchPath } from './slugs';
import { clubTeamsOf, GOAL_EVENT_TYPES, isJuniorFixture, publicScoreHidden, teamLabel, teamOfMatch } from './teams';

export interface CupGoal { player: string; half: 1 | 2; ownGoal?: boolean }
export interface CupGame {
  opponent: string;
  href?: string;
  us: number;
  them: number;
  /** A level game decided on penalties */
  pens?: { us: number; them: number };
  /** Our goals as logged: can be fewer than the score */
  goals: CupGoal[];
  /** Every goal was logged with its minute, and none came before half-time */
  goallessAtBreak?: boolean;
  kickoff?: string;
}
export interface CupWriteupInput {
  club: string;
  /** The team's name, when the club has more than one */
  team?: string;
  cup: string;
  /** "Sunday", when every game was on the same day */
  day?: string;
  games: CupGame[];
  finish?: CupFinish;
  winner?: string;
}
export type CupStyle = 'far' | 'run' | 'player' | 'defence' | 'day';
export interface CupWriteup { style: CupStyle; headline: string; lead: string; paragraphs: string[] }

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const ORDINALS = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
const num = (n: number) => WORDS[n] ?? String(n);
const ordWord = (n: number) => ORDINALS[n] ?? `${n}th`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const list = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);
const plural = (n: number, one: string, many = `${one}s`) => `${num(n)} ${n === 1 ? one : many}`;
const outcomes = (w: number, d: number, l: number) =>
  list([w && plural(w, 'win'), d && plural(d, 'draw'), l && plural(l, 'loss', 'losses')].filter((x): x is string => !!x));
const times = (n: number) => (n === 2 ? 'twice' : n === 3 ? 'a hat-trick' : `${num(n)} goals`);
const link = (text: string, href?: string) => (href ? `[${text}](${href})` : text);
const norm = (s?: string | null) => (s || '').trim().toLowerCase();

const won = (g: CupGame) => g.us > g.them || (g.us === g.them && !!g.pens && g.pens.us > g.pens.them);
const lost = (g: CupGame) => g.us < g.them || (g.us === g.them && !!g.pens && g.pens.us < g.pens.them);
/** Winner's score first, as people say it */
const score = (g: CupGame) => `${Math.max(g.us, g.them)}-${Math.min(g.us, g.them)}`;
const STAGE_END: Partial<Record<CupFinish['stage'], string>> = { group: 'the group stage', quarter: 'the quarter-finals', semi: 'the semi-finals' };

/** Our scorers in one game, in the order they first scored: "Sam Lee (2)" */
function tally(goals: CupGoal[]): [string, number][] {
  const by = new Map<string, number>();
  for (const g of goals) {
    const who = g.ownGoal ? 'an own goal' : g.player.trim();
    if (who) by.set(who, (by.get(who) || 0) + 1);
  }
  return [...by];
}
const named = (t: [string, number][]) => list(t.map(([p, n]) => (n > 1 ? `${p} (${n})` : p)));

export function cupWriteup(r: CupWriteupInput): CupWriteup | null {
  const games = r.games;
  const n = games.length;
  if (!n) return null;
  const C = r.club;
  const they = r.team ? `The ${r.team}` : 'They';
  const cupShort = r.cup.replace(/\b(19|20)\d{2}\b/g, '').replace(/\s{2,}/g, ' ').trim() || r.cup;
  const the = (c: string) => (/^the\s/i.test(c) ? c : `the ${c}`);
  const at = `at ${the(r.cup)}${r.day ? ` on ${r.day}` : ''}`;
  const w = games.filter(won).length;
  const l = games.filter(lost).length;
  const d = n - w - l;
  const stage = r.finish?.stage;

  // The longest run of wins
  let run = { start: 0, len: 0 };
  for (let i = 0, cur = 0; i < n; i++) {
    cur = won(games[i]) ? cur + 1 : 0;
    if (cur > run.len) run = { start: i - cur + 1, len: cur };
  }
  // Our scorers across the cup (own goals left out)
  const scorers = new Map<string, number>();
  for (const g of games) for (const goal of g.goals) if (!goal.ownGoal && goal.player.trim()) scorers.set(goal.player.trim(), (scorers.get(goal.player.trim()) || 0) + 1);
  const best = Math.max(0, ...scorers.values());
  const top = [...scorers].filter(([, c]) => c === best);
  const topScorer = best >= 2 && top.length === 1 ? top[0][0] : undefined;
  const sheets = games.filter(g => g.them === 0);

  const style: CupStyle = stage === 'won' || stage === 'final' || stage === 'semi' ? 'far'
    : run.len >= 2 ? 'run'
      : topScorer ? 'player'
        : sheets.length >= 2 ? 'defence' : 'day';

  // How the team finished, when the club said so and the opening hasn't said it already
  const finishLine = (() => {
    const f = r.finish;
    if (!f || style === 'far') return '';
    if (f.stage === 'group' && f.place) {
      const points = 3 * w + d;
      const through = f.through && f.place > f.through ? `, and only the top ${num(f.through)} went through` : '';
      return `${they} finished ${ordWord(f.place)} in their group with ${plural(points, 'point')}${through}.`;
    }
    return STAGE_END[f.stage] ? `${they} went out in ${STAGE_END[f.stage]}.` : '';
  })();
  const endsIn = stage && STAGE_END[stage] && stage !== 'semi' ? ` as ${cupShort} run ends in ${STAGE_END[stage]}` : ` at ${the(cupShort)}`;

  let headline: string;
  let opening: string;
  if (style === 'far') {
    headline = stage === 'won' ? `${C} win ${the(r.cup)}` : stage === 'final' ? `${C} reach ${the(cupShort)} final` : `${C} reach ${the(cupShort)} semi-finals`;
    opening = stage === 'won'
      ? `${C} won ${the(r.cup)}${r.day ? ` on ${r.day}` : ''}, with ${outcomes(w, d, l)} from ${plural(n, 'game')}.`
      : stage === 'final'
        ? `${C} reached the final of ${the(r.cup)}${r.day ? ` on ${r.day}` : ''} and finished runners-up${r.winner ? ` to ${r.winner}` : ''}.`
        : `${C} reached the semi-finals of ${the(r.cup)}${r.day ? ` on ${r.day}` : ''}.`;
  } else if (style === 'run') {
    const opps = games.slice(run.start, run.start + run.len).map(g => g.opponent);
    if (w === n) {
      headline = `${C} win all ${num(n)} games${endsIn}`;
      opening = `${C} won all ${num(n)} of their games ${at}.`;
    } else {
      headline = `${C} win ${num(run.len)} in a row${endsIn}`;
      const before = run.start === 1 ? games[0] : undefined;
      opening = before && run.len === 2
        ? `${C} ${lost(before) ? 'lost' : 'drew'} their first game ${at}, then beat ${list(opps)} back to back.`
        : run.len === 2
          ? `${C} beat ${list(opps)} back to back ${at}.`
          : `${C} won ${num(run.len)} in a row ${at}, beating ${list(opps)}.`;
    }
  } else if (style === 'player') {
    headline = `${topScorer} scores ${num(best)} goals for ${C}${endsIn}`;
    opening = `${topScorer} scored ${num(best)} goals for ${C} ${at}, where they had ${outcomes(w, d, l)} from ${plural(n, 'game')}.`;
  } else if (style === 'defence') {
    headline = `${cap(num(sheets.length))} clean sheets for ${C}${endsIn}`;
    const games_ = list(sheets.map(g => `${g.opponent} ${g.us}-0`));
    opening = `${C} kept ${num(sheets.length)} clean sheets ${at}, ${sheets.every(won) ? 'beating' : 'against'} ${games_}.`;
  } else {
    const place = r.finish?.stage === 'group' && r.finish.place ? r.finish.place : 0;
    headline = place ? `${C} finish ${ordWord(place)} in their group at ${the(cupShort)}`
      : w ? `${C} win ${num(w)} of ${num(n)}${endsIn}` : `${C} go without a win${endsIn}`;
    opening = n === 1 ? `${C} played one game ${at}.` : `${C} had ${outcomes(w, d, l)} from ${plural(n, 'game')} ${at}.`;
  }

  const firstSheet = sheets.length >= 2 ? sheets[0] : undefined;
  const paragraphs = games.map((g, i) => {
    const opp = link(g.opponent, g.href);
    const kick = i === 0 && g.kickoff ? ` at ${g.kickoff}` : '';
    const ours = tally(g.goals);
    const fullCredit = g.goals.length === g.us;
    const which = n > 1 && i === 0 ? 'the opening game'
      : n > 1 && i === n - 1 ? (stage === 'won' || stage === 'final' ? 'the final' : stage === 'group' ? 'the last group game' : 'the last game') : '';
    const cupWinner = !!r.winner && norm(r.winner) === norm(g.opponent);
    let s: string;
    if (won(g) && g.us === g.them) {
      s = `${C} drew ${score(g)} with ${opp}${kick} and won the shootout ${g.pens!.us}-${g.pens!.them}.`;
    } else if (won(g)) {
      const [p, c] = ours[0] || [];
      if (ours.length === 1 && fullCredit && p !== 'an own goal') {
        s = g.goallessAtBreak && c === 1
          ? `The game against ${opp}${kick} was goalless at the break. ${p} scored the only goal in the second half.`
          : c === 1 && g.us === 1
            ? `${p} scored the only goal as ${C} beat ${opp} 1-0${kick}.`
            : c === 2 && g.goals.some(x => x.half === 1) && g.goals.some(x => x.half === 2)
              ? `${p} scored once in each half against ${opp}${kick}, and ${C} won ${score(g)}.`
              : `${p} scored ${times(c!)} against ${opp}${kick}, and ${C} won ${score(g)}.`;
      } else {
        s = `${C} beat ${opp} ${score(g)}${kick}${ours.length ? `, with ${fullCredit ? 'goals from' : 'goals including'} ${named(ours)}` : ''}.`;
      }
      if (g === firstSheet) s += ` It was the first of ${num(sheets.length)} clean sheets at the cup.`;
    } else if (lost(g) && g.us === g.them) {
      s = `${C} drew ${score(g)} with ${opp}${kick}, and ${g.opponent} won the shootout ${g.pens!.them}-${g.pens!.us}.`;
    } else if (lost(g)) {
      s = which ? `${opp} won ${which} ${score(g)}${kick}` : `${opp} beat ${C} ${score(g)}${kick}`;
      s += cupWinner ? ', and they went on to win the cup.' : '.';
      if (ours.length) s += ` ${cap(named(ours))} scored for ${C}.`;
      return s;
    } else {
      s = `${C} and ${opp} drew ${score(g)}${kick}.`;
      if (ours.length) s += ` ${cap(named(ours))} scored for ${C}.`;
    }
    return cupWinner ? `${s} ${g.opponent} went on to win the cup.` : s;
  });

  if (n > 1) {
    const gf = games.reduce((t, g) => t + g.us, 0);
    const ga = games.reduce((t, g) => t + g.them, 0);
    let totals = `${C} finished with ${outcomes(w, d, l)}, ${plural(gf, 'goal')} scored and ${num(ga)} conceded.`;
    if (topScorer && style !== 'player') totals += ` ${topScorer} was the team's top scorer at the cup with ${num(best)}.`;
    paragraphs.push(totals);
  }

  return { style, headline, lead: [opening, finishLine].filter(Boolean).join(' '), paragraphs };
}

export interface CupWriteupSource {
  club: Pick<Club, 'id' | 'slug' | 'name' | 'short_name' | 'config'>;
  event: ClubEvent;
  matches: Match[];
  matchEvents: MatchEvent[];
  clubTeams: ClubTeam[];
}
export interface TeamWriteup { key: string; team?: string; writeup: CupWriteup }

/** The write-ups for a completed event: one per team with a scored game in it, none before it's completed */
export function cupWriteupsFor(s: CupWriteupSource): TeamWriteup[] {
  const { club, event } = s;
  if (!event.completed_at || event.category === 'training' || event.category === 'agm') return [];
  const zone = clubTimeZone(club);
  const games = s.matches
    .filter(m => m.club_id === club.id && m.event_id === event.id && m.status === 'completed'
      && m.home_score != null && m.away_score != null && !publicScoreHidden(m, s.clubTeams) && clubResult(m).outcome)
    .sort((a, b) => kickoff(a) - kickoff(b));
  if (!games.length) return [];
  const days = new Set(games.map(m => new Date(m.match_date).toLocaleDateString(DATE_LOCALE, { timeZone: zone, weekday: 'long' })));
  const day = days.size === 1 ? [...days][0] : undefined;
  const manyTeams = clubTeamsOf(s.clubTeams, club.id).length > 1;
  const groups = new Map<string, Match[]>();
  for (const m of games) {
    const key = teamOfMatch(m, s.clubTeams)?.id || 'club';
    groups.set(key, [...(groups.get(key) || []), m]);
  }
  const out: TeamWriteup[] = [];
  for (const [key, ms] of groups) {
    const team = s.clubTeams.find(t => t.id === key);
    const writeup = cupWriteup({
      club: club.short_name || club.name,
      team: manyTeams && team ? teamLabel(team) : undefined,
      cup: competitionName(event.title) || event.title,
      day,
      finish: event.cup_finish?.[key] || undefined,
      winner: event.cup_winner?.trim() || undefined,
      games: ms.map(m => {
        const home = m.is_club_home !== false;
        const our = home ? 'home' : 'away';
        const res = clubResult(m);
        const half = halfMinutes(m);
        const placeholder = new Set([`${m.home_team_name} Player`, `${m.away_team_name} Player`]);
        const all = publicEvents(s.matchEvents.filter(e => e.match_id === m.id && GOAL_EVENT_TYPES.includes(e.event_type)), isJuniorFixture(m, s.clubTeams));
        const forUs = all.filter(e => (e.team_side === our) !== (e.event_type === 'own_goal'));
        return {
          opponent: (home ? m.away_team_name : m.home_team_name) || 'the opposition',
          href: matchPath(club.slug, m),
          us: res.us,
          them: res.them,
          pens: res.onPens ? { us: (home ? m.home_penalty_score : m.away_penalty_score) ?? 0, them: (home ? m.away_penalty_score : m.home_penalty_score) ?? 0 } : undefined,
          goals: forUs
            .filter(e => e.event_type === 'own_goal' || (e.player_name?.trim() && !placeholder.has(e.player_name.trim())))
            .sort((a, b) => a.minute - b.minute)
            .map(e => ({ player: e.player_name?.trim() || '', half: e.minute <= half ? 1 : 2, ownGoal: e.event_type === 'own_goal' })),
          goallessAtBreak: res.us + res.them > 0 && all.length === res.us + res.them && all.every(e => e.minute > half),
          kickoff: hasKickoffTime(m) ? new Date(m.match_date).toLocaleTimeString(DATE_LOCALE, { timeZone: zone, hour: 'numeric', minute: '2-digit' }) : undefined,
        };
      }),
    });
    if (writeup) out.push({ key, team: manyTeams && team ? teamLabel(team) : undefined, writeup });
  }
  return out;
}

/** Completed events' write-ups as News cards (each opens the event page) */
export function cupWriteupCards(s: Omit<CupWriteupSource, 'event'> & { events: ClubEvent[] }): ReportCard[] {
  return s.events.filter(e => e.club_id === s.club.id && e.completed_at).flatMap(event =>
    cupWriteupsFor({ ...s, event }).map(({ key, writeup }) => ({
      id: `${event.id}:${key}`,
      href: `/${s.club.slug}/events/${event.id}`,
      title: writeup.headline,
      summary: plainText(writeup.lead),
      published_at: event.completed_at!,
      cover: event.flyer_url || undefined,
    })));
}
