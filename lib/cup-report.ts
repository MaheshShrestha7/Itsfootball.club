// The tournament report: one page made from the coach's match reviews, the cup summary and what
// Match Centre logged (results, goal minutes, saved player stats). The sentences are filled in from
// those numbers and the notes are the coach's own words, so nothing in it is guessed.
// The report is plain data (no dates or functions), so the squad version can be saved as it is and
// shown again from a share link.
import { soonestFirst, type ClubOutcome } from './fixtures';
import { compareEventMinute, eventMinuteLabel, fullMinutes, halfMinutes } from './match-length';
import { gameResult, hasReview, minutesAcross, opponentName, ourSide, reviewPoints, type MatchReview } from './match-review';
import type { MatchStatLine } from './match-stats';
import type { Match, MatchEvent } from './supabase/types';
import { goalScoringSide } from './teams';

export interface ReportPoint { from: string; text: string }

export interface ReportGame {
  id: string;
  outcome: ClubOutcome | null;
  /** Our score first when one side is ours ("2-0"), else home then away */
  score: string;
  opponent: string;
  /** "ANCC Seniors 2-0 Bayside FC", home side first */
  title: string;
  when: string;
  /** What was logged, as sentences: scorers, cards, Player of the Match */
  fact: string;
  wentWell: string;
  workOn: string;
}

export interface ReportGoals {
  /** The game in four equal parts: goals for and against in each */
  blocks: { label: string; us: number; them: number }[];
  /** [first half, second half] */
  us: [number, number];
  them: [number, number];
  line: string;
}

export interface CupReport {
  v: 1;
  club: string;
  cup: string;
  team?: string;
  dates: string;
  venue?: string;
  opening: string;
  games: ReportGame[];
  summary: string;
  by?: string;
  wentWell: ReportPoint[];
  workOn: ReportPoint[];
  goals: ReportGoals | null;
  players: { label: string; value: string }[];
  /** How many games have a review */
  reviews: number;
  /** Coaches and committee only: left out of the squad version */
  minutes?: { rows: { name: string; games: number; minutes: number; underHalf: boolean }[]; total: number; line: string };
  next?: ReportPoint[];
}

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const num = (n: number) => WORDS[n] ?? String(n);
const list = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);
const plural = (n: number, one: string, many = `${one}s`) => `${num(n)} ${n === 1 ? one : many}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;

export interface CupReportInput {
  club: string;
  cup: string;
  team?: string;
  /** The team's name in a tournament, to tell which side is ours */
  ourName?: string;
  /** The cup's games for this team */
  games: Match[];
  events: MatchEvent[];
  linesByMatch: Record<string, MatchStatLine[] | undefined>;
  reviews: Record<string, MatchReview | undefined>;
  summary: string;
  by?: string;
  /** A member's name as this audience should see it */
  nameOf: (memberId: string) => string;
  /** A name typed into a match event, as this audience should see it */
  eventName: (name: string) => string;
  /** "Sat, 22 Nov · 9:00 am · Semi-Final" */
  when: (m: Match) => string;
  day: (m: Match) => string;
  /** Players who said they could play in at least one game, when the club asked */
  available?: number;
  /** Minutes and the notes for next time: coaches and committee only */
  coach: boolean;
}

/** What one game's log says, in sentences. Our goals name the scorer; theirs give the minute. */
function gameFact(m: Match, side: 'home' | 'away' | null, events: MatchEvent[], lines: MatchStatLine[], input: CupReportInput): string {
  const logged = events.filter(e => e.match_id === m.id).sort(compareEventMinute);
  const ours = new Map<string, string[]>();
  const theirs: string[] = [];
  for (const e of logged) {
    const to = goalScoringSide(e);
    if (!to) continue;
    if (side && to !== side) { theirs.push(`${eventMinuteLabel(e)}'`); continue; }
    const name = `${input.eventName(e.player_name)}${e.event_type === 'own_goal' ? ' (own goal)' : ''}`;
    ours.set(name, [...(ours.get(name) || []), `${eventMinuteLabel(e)}'${e.event_type === 'penalty' ? ' pen' : ''}`]);
  }
  const out: string[] = [];
  if (ours.size) out.push(`${list([...ours].map(([name, at]) => `${name} (${at.join(', ')})`))} scored.`);
  if (theirs.length) out.push(`${opponentName(m, input.ourName)} scored in the ${list(theirs.map(t => `${ordinal(parseInt(t, 10))}${t.includes('+') ? ' (added time)' : ''}`))} minute${theirs.length === 1 ? '' : 's'}.`);
  const cards = (type: string) => logged.filter(e => e.event_type === type && (!side || e.team_side === side)).map(e => input.eventName(e.player_name));
  const yellow = [...new Set(cards('yellow_card'))];
  const red = [...new Set(cards('red_card'))];
  if (yellow.length) out.push(`${list(yellow)} ${yellow.length === 1 ? 'was' : 'were'} booked.`);
  if (red.length) out.push(`${list(red)} ${red.length === 1 ? 'was' : 'were'} sent off.`);
  const potm = lines.filter(l => l.motm).map(l => input.nameOf(l.member_id));
  if (potm.length) out.push(`${list(potm)} ${potm.length === 1 ? 'was' : 'were'} Player of the Match.`);
  return out.join(' ');
}

/** "We played three games, won two and lost one. We beat ... We scored seven goals and let in four." */
function opening(played: { m: Match; r: ReturnType<typeof gameResult> }[], input: CupReportInput): string {
  const decided = played.filter(p => p.r.outcome);
  if (!decided.length) return played.length ? `${cap(plural(played.length, 'game'))} ${played.length === 1 ? 'has' : 'have'} been played.` : 'No games have been played yet.';
  const count = (o: ClubOutcome) => decided.filter(p => p.r.outcome === o).length;
  const [w, d, l] = [count('W'), count('D'), count('L')];
  const record = list([w && `won ${num(w)}`, d && `drew ${num(d)}`, l && `lost ${num(l)}`].filter((x): x is string => !!x));
  const out = [decided.length === 1 ? 'We played one game.' : `We played ${plural(decided.length, 'game')}, ${record}.`];
  if (decided.length <= 6) {
    const name = (p: (typeof decided)[number]) => opponentName(p.m, input.ourName);
    const pens = (p: (typeof decided)[number]) => (p.r.onPens ? ' on penalties' : '');
    const of = (o: ClubOutcome) => decided.filter(p => p.r.outcome === o);
    const parts = [
      of('W').length && `beat ${list(of('W').map(p => `${name(p)} ${p.r.us}-${p.r.them}${pens(p)}`))}`,
      of('D').length && `drew ${list(of('D').map(p => `${p.r.us}-${p.r.them} with ${name(p)}`))}`,
      // A defeat reads winner's score first: "lost 3-2 to Northside United"
      of('L').length && `lost ${list(of('L').map(p => `${p.r.them}-${p.r.us} to ${name(p)}${pens(p)}`))}`,
    ].filter((x): x is string => !!x);
    out.push(`We ${list(parts)}.`);
  }
  const [gf, ga] = [decided.reduce((n, p) => n + p.r.us, 0), decided.reduce((n, p) => n + p.r.them, 0)];
  out.push(`We scored ${plural(gf, 'goal')} and let in ${num(ga)}.`);
  return out.join(' ');
}

/** When the logged goals came: by quarter of the game and by half. Null with no side of our own or nothing logged. */
function goalTiming(played: { m: Match; side: 'home' | 'away' | null }[], events: MatchEvent[]): ReportGoals | null {
  const blocks = [0, 1, 2, 3].map(() => ({ us: 0, them: 0 }));
  const us: [number, number] = [0, 0];
  const them: [number, number] = [0, 0];
  let logged = 0;
  for (const { m, side } of played) {
    if (!side) continue;
    const quarter = fullMinutes(m) / 4;
    for (const e of events) {
      if (e.match_id !== m.id) continue;
      const to = goalScoringSide(e);
      if (!to) continue;
      logged += 1;
      const who = to === side ? 'us' : 'them';
      blocks[Math.min(3, Math.max(0, Math.ceil(e.minute / quarter) - 1))][who] += 1;
      (who === 'us' ? us : them)[e.minute <= halfMinutes(m) ? 0 : 1] += 1;
    }
  }
  if (!logged) return null;
  const lengths = [...new Set(played.filter(p => p.side).map(p => fullMinutes(p.m)))];
  const q = lengths.length === 1 && lengths[0] % 4 === 0 ? lengths[0] / 4 : null;
  const labels = q ? [0, 1, 2, 3].map(i => `${i * q + 1}' to ${(i + 1) * q}'`) : ['1st quarter', '2nd quarter', '3rd quarter', '4th quarter'];
  const half = (who: string, [first, second]: [number, number]) =>
    first + second === 0 ? null : `${who} scored ${num(first)} in the first half and ${num(second)} in the second.`;
  const late = blocks[3].them;
  return {
    blocks: blocks.map((b, i) => ({ label: labels[i], ...b })),
    us, them,
    line: [
      half('We', us), half('They', them),
      late > 0 && them[0] + them[1] > 1 ? `${cap(num(late))} of the ${num(them[0] + them[1])} against us came in the last ${q ? `${q} minutes` : 'quarter of the game'}.` : null,
    ].filter(Boolean).join(' '),
  };
}

export function buildCupReport(input: CupReportInput): CupReport {
  const games = [...input.games];
  const played = games.filter(m => m.status === 'completed').map(m => {
    const r = gameResult(m, input.ourName);
    return { m, r, side: r.outcome ? ourSide(m, input.ourName) : null, lines: input.linesByMatch[m.id] || [], review: input.reviews[m.id] };
  });
  const from = (p: (typeof played)[number]) => `${p.r.outcome ? 'vs ' : ''}${opponentName(p.m, input.ourName)}`;
  const points = (field: 'went_well' | 'work_on' | 'next_week') =>
    played.flatMap(p => reviewPoints(p.review?.[field] || '').map(text => ({ from: from(p), text })));

  // Players: totals from the saved stats, most first
  const tally = (pick: (l: MatchStatLine) => number) => {
    const by = new Map<string, number>();
    for (const p of played) for (const l of p.lines) if (pick(l)) by.set(l.member_id, (by.get(l.member_id) || 0) + pick(l));
    return [...by].sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ name: input.nameOf(id), n }));
  };
  const counted = (rows: { name: string; n: number }[]) => rows.map(r => `${r.name} ${r.n}`).join(', ');
  const potm = [...new Set(played.flatMap(p => p.lines.filter(l => l.motm).map(l => input.nameOf(l.member_id))))];
  const yellow = tally(l => l.yellow_cards);
  const red = tally(l => l.red_cards);
  const players = [
    { label: 'Goals', value: counted(tally(l => l.goals)) },
    { label: 'Assists', value: counted(tally(l => l.assists)) },
    { label: 'Player of the Match', value: potm.join(', ') },
    { label: 'Cards', value: [...yellow.map(r => `${r.name} ${r.n} yellow`), ...red.map(r => `${r.name} ${r.n} red`)].join(', ') },
  ].filter(row => row.value);

  const sorted = [...games].sort(soonestFirst);
  const [first, last] = [sorted[0], sorted.at(-1)];
  const days = first && last ? [...new Set([input.day(first), input.day(last)])].join(' to ') : '';
  const venues = [...new Set(games.map(m => m.venue?.trim()).filter(Boolean))];

  const report: CupReport = {
    v: 1,
    club: input.club,
    cup: input.cup,
    team: input.team,
    dates: days,
    venue: venues.length === 1 ? venues[0] : undefined,
    opening: opening(played, input),
    games: played.map(p => ({
      id: p.m.id,
      outcome: p.r.outcome,
      score: p.r.outcome ? `${p.r.us}-${p.r.them}` : `${p.m.home_score ?? 0}-${p.m.away_score ?? 0}`,
      opponent: opponentName(p.m, input.ourName),
      title: `${p.m.home_team_name} ${p.m.home_score ?? 0}-${p.m.away_score ?? 0} ${p.m.away_team_name}`,
      when: input.when(p.m),
      fact: gameFact(p.m, p.side, input.events, p.lines, input),
      wentWell: p.review?.went_well.trim() || '',
      workOn: p.review?.work_on.trim() || '',
    })),
    summary: input.summary.trim(),
    by: input.by,
    wentWell: points('went_well'),
    workOn: points('work_on'),
    goals: goalTiming(played, input.events),
    players,
    reviews: played.filter(p => hasReview(p.review)).length,
  };
  if (!input.coach) return report;

  const mins = minutesAcross(played.map(p => p.m), input.linesByMatch);
  const under = mins.rows.filter(r => r.underHalf).map(r => input.nameOf(r.member_id));
  const got = new Set(played.flatMap(p => p.lines.filter(l => l.played).map(l => l.member_id))).size;
  return {
    ...report,
    minutes: mins.rows.length ? {
      rows: mins.rows.map(r => ({ name: input.nameOf(r.member_id), games: r.games, minutes: r.minutes, underHalf: r.underHalf })),
      total: mins.total,
      line: [
        input.available && got ? `${input.available} players said they could play and ${got} got on the pitch.` : null,
        mins.fair ? `A fair share was ${mins.fair} minutes each.` : null,
        under.length ? `${list(under)} had less than half the minutes on offer.` : null,
      ].filter(Boolean).join(' '),
    } : undefined,
    next: points('next_week'),
  };
}

/** The report as plain text, for a message */
export function cupReportText(r: CupReport): string {
  const block = (title: string, lines: string[]) => (lines.length ? ['', title, ...lines] : []);
  const pts = (items: ReportPoint[]) => items.map(p => `- ${p.text} (${p.from})`);
  return [
    `${r.cup}${r.team ? `, ${r.team}` : ''}`,
    [r.dates, r.venue].filter(Boolean).join(', '),
    '',
    r.opening,
    ...block('From the coach', r.summary ? [r.summary] : []),
    ...block('What we did well', pts(r.wentWell)),
    ...block('What we need to work on', pts(r.workOn)),
    ...block('When the goals came', r.goals ? [r.goals.line] : []),
    ...block('Game by game', r.games.map(g => `${g.title}. ${g.fact}`.trim())),
    ...block('Players', r.players.map(p => `${p.label}: ${p.value}`)),
    ...block('Who played, and for how long', r.minutes ? [r.minutes.line, ...r.minutes.rows.map(m => `${m.name}: ${m.minutes} minutes in ${m.games} ${m.games === 1 ? 'game' : 'games'}`)].filter(Boolean) : []),
    ...block('What we\'ll do next', pts(r.next || [])),
  ].filter((line, i, all) => !(line === '' && all[i - 1] === '')).join('\n').trim();
}

/** A report read back from a share link is someone else's data: only a well-formed one is shown */
export function isCupReport(x: unknown): x is CupReport {
  const r = x as CupReport | null;
  return !!r && typeof r === 'object' && r.v === 1 && typeof r.cup === 'string' && typeof r.opening === 'string'
    && Array.isArray(r.games) && Array.isArray(r.wentWell) && Array.isArray(r.workOn) && Array.isArray(r.players);
}
