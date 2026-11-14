// The full-time match report, written as a short news article from what the club logged (score, goals,
// assists, subs, cards, Player of the Match) and what the app already knows (season record, the last
// meeting, the next fixture). No AI writing and nothing guessed: a sentence only appears when its data does.
// Junior names arrive already shortened (publicMember), and a team that hides its scores gets no report.
// Links are written as [text](href) inside the sentences; plainText() strips them.

type Side = 'home' | 'away';

export interface ArticleGoal { minute: number; /** Stoppage minutes: 12 + 2 */ added?: number; side: Side; player: string; assist?: string; penalty?: boolean; ownGoal?: boolean }

export interface ArticleInput {
  /** The match id: decides which of the five openings a game gets, the same one on every visit */
  id: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  /** The club's own side. Left out when neither side is "us" (a tournament or in-house game) */
  ourSide?: Side;
  /** "Sydney Premier League"; left out for a friendly */
  competition?: string;
  /** A tournament game's place in the cup: "Semi-Final", "Round 5" */
  stage?: string;
  venue?: string;
  /** "Saturday" */
  day?: string;
  partOfDay?: 'morning' | 'afternoon' | 'evening';
  /** Minutes in one half */
  halfMinutes: number;
  goals: ArticleGoal[];
  subs: { side: Side; on: string; off?: string; minute: number }[];
  yellows: { side: Side; player: string }[];
  reds: { side: Side; player: string; minute: number; added?: number }[];
  playerOfTheMatch?: string;
  /** Season goals by player name, this match included: only passed once the match's stats are saved */
  seasonGoals?: Record<string, number>;
  /** The club's outright top scorer this season, by name */
  topScorer?: string;
  /** "8:00 am" */
  kickoff?: string;
  /** Players a side, when it isn't 11 */
  aSide?: number;
  /** Our starting side */
  lineup?: { starters: string[]; captain?: string; keeper?: string };
  /** This game's place among the team's games that day: [2, 3] is the second of three */
  gameOfDay?: [number, number];
  /** The team's other finished games on the same day, in kick-off order */
  sameDay?: { opponent: string; ourScore: number; theirScore: number; href?: string; later: boolean }[];
  /** The team's season so far, this match included */
  record?: { played: number; won: number; drawn: number; lost: number; goalsFor?: number; goalsAgainst?: number };
  /** The team's earlier games against this opponent */
  meetings?: { played: number; won: number; drawn: number; lost: number };
  lastMeeting?: { home: string; away: string; homeScore: number; awayScore: number; /** "14 June" */ date: string; href?: string };
  /** The team's next game that hasn't been played yet */
  next?: { opponent: string; competition?: string; /** "at 1:00 pm on Saturday 22 November", or "on Saturday 22 November" with no kick-off time */ when: string; venue?: string; href?: string };
  /** The shootout score of a level cup game */
  shootout?: { home: number; away: number };
  links?: { competition?: string; venue?: string };
}

export type ArticleStyle = 'result' | 'player' | 'turning' | 'season' | 'next';
export interface MatchArticle { style: ArticleStyle; headline: string; lead: string; paragraphs: string[] }

const link = (text: string, href?: string) => (href ? `[${text}](${href})` : text);
/** A sentence without its [text](href) links, for headlines, descriptions and structured data */
export const plainText = (s: string) => s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const ORDINAL_WORDS = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth'];
const num = (n: number) => WORDS[n] ?? String(n);
const ord = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
const ordWord = (n: number) => ORDINAL_WORDS[n] || ord(n);
const list = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);
const plural = (n: number, one: string, many = `${one}s`) => `${num(n)} ${n === 1 ? one : many}`;
/** "two wins, one draw and three defeats" */
const outcomes = (w: number, d: number, l: number) => list([w && plural(w, 'win'), d && plural(d, 'draw'), l && plural(l, 'defeat')].filter((x): x is string => !!x));
const times = (n: number) => (n === 2 ? 'twice' : n === 3 ? 'a hat-trick' : num(n));

/** What makes a report worth a search result: more than a bare score */
export function reportReady(m: { goalsLogged: number; hasLineup: boolean; hasPlayerOfTheMatch: boolean }): boolean {
  return m.goalsLogged > 0 || m.hasLineup || m.hasPlayerOfTheMatch;
}

/** The article; null when there is no result to report */
export function matchArticle(r: ArticleInput): MatchArticle | null {
  const [hs, as] = [r.homeScore, r.awayScore];
  if (!(hs >= 0) || !(as >= 0)) return null;
  const name = (s: Side) => (s === 'home' ? r.home : r.away);
  const other = (s: Side): Side => (s === 'home' ? 'away' : 'home');
  const our = r.ourSide;
  const us = our ? name(our) : '';
  const them = our ? name(other(our)) : '';
  const [hi, lo] = [Math.max(hs, as), Math.min(hs, as)];
  const draw = hs === as;
  const weWon = !!our && !draw && (our === 'home') === (hs > as);

  // A goal with no scorer picked is saved as "<Team> Player": the team scored, nobody is named
  const known = (player: string | undefined, side: Side) => !!player?.trim() && player.trim() !== `${name(side)} Player`;
  // Full name the first time, surname after that. A junior's "Sam T." and a shared surname stay whole.
  const everyone = [...(r.lineup?.starters || []), ...r.goals.flatMap(g => [g.player, g.assist]), ...r.subs.flatMap(s => [s.on, s.off]), ...r.yellows.map(c => c.player), ...r.reds.map(c => c.player), r.playerOfTheMatch]
    .filter((n): n is string => !!n?.trim()).map(n => n.trim());
  const surname = (n: string) => n.trim().split(/\s+/).at(-1)!;
  const short = (n: string) => {
    const parts = n.trim().split(/\s+/);
    if (parts.length < 2 || parts.at(-1)!.endsWith('.')) return n.trim();
    return new Set(everyone.filter(e => surname(e) === surname(n))).size > 1 ? n.trim() : surname(n);
  };
  const said = new Set<string>();
  const nm = (n: string) => {
    const full = n.trim();
    if (said.has(full)) return short(full);
    said.add(full);
    return full;
  };

  const scoredFor = (g: ArticleGoal): Side => (g.ownGoal ? other(g.side) : g.side);
  const goals = [...r.goals].sort((a, b) => a.minute - b.minute || (a.added || 0) - (b.added || 0));
  const logged = (s: Side) => goals.filter(g => scoredFor(g) === s).length;
  const complete = logged('home') === hs && logged('away') === as;
  const half = r.halfMinutes;
  const period = (minute: number) => (minute <= half ? 1 : minute <= half * 2 ? 2 : 3);
  // A minute past full time (a 46th-minute goal in a 2 x 12 game) means the clock wasn't the match clock:
  // the order still stands, the minutes and the half-time score don't
  const inTime = (minute: number) => minute >= 0 && minute <= half * 2;
  const timed = goals.every(g => inTime(g.minute));
  const halfTime = { home: goals.filter(g => period(g.minute) === 1 && scoredFor(g) === 'home').length, away: goals.filter(g => period(g.minute) === 1 && scoredFor(g) === 'away').length };

  const stage = r.stage?.toLowerCase();
  const inComp = (linked: boolean) => {
    if (!r.competition) return '';
    const comp = linked ? link(r.competition, r.links?.competition) : r.competition;
    return stage?.startsWith('round') ? ` in ${stage} of the ${comp}` : ` in the ${comp}${stage ? ` ${stage}` : ''}`;
  };
  const where = `${inComp(true)}${r.venue ? ` at ${link(r.venue, r.links?.venue)}` : ''}`;
  const when = r.day ? ` on ${r.day}${r.partOfDay ? ` ${r.partOfDay}` : ''}` : '';

  // "ANCC beat Marrickville 3-1", from our side when there is one
  const result = our
    ? draw ? `${us} and ${them} drew ${hs}-${as}` : weWon ? `${us} beat ${them} ${hi}-${lo}` : `${us} lost ${hi}-${lo} to ${them}`
    : draw ? `${r.home} and ${r.away} drew ${hs}-${as}` : `${name(hs > as ? 'home' : 'away')} beat ${name(hs > as ? 'away' : 'home')} ${hi}-${lo}`;
  const resultHeadline = our
    ? draw ? `${us} and ${them} draw ${hs}-${as}` : weWon ? `${us} beat ${them} ${hi}-${lo}` : `${us} lose ${hi}-${lo} to ${them}`
    : result;
  const after = draw ? `drawing ${hs}-${as} with ${them}` : weWon ? `beating ${them} ${hi}-${lo}` : `losing ${hi}-${lo} to ${them}`;
  const so = r.shootout;
  const penalties = so && draw && so.home !== so.away
    ? ` ${name(so.home > so.away ? 'home' : 'away')} won ${Math.max(so.home, so.away)}-${Math.min(so.home, so.away)} on penalties.` : '';

  // Our player with the most goals in this game (two or more makes the story about them)
  const tally = new Map<string, number>();
  for (const g of goals) if (!g.ownGoal && known(g.player, g.side) && (!our || g.side === our)) tally.set(g.player.trim(), (tally.get(g.player.trim()) || 0) + 1);
  const [star, starGoals] = [...tally].sort((a, b) => b[1] - a[1])[0] || ['', 0];
  const starAssists = star ? goals.filter(g => g.assist?.trim() === star).length : 0;

  // The goal that put the winners ahead for good
  let lead = 0; // home minus away
  let decider: ArticleGoal | undefined;
  if (complete) for (const g of goals) {
    const before = lead;
    lead += scoredFor(g) === 'home' ? 1 : -1;
    if (before === 0) decider = g;
  }
  const turning = timed && !!our && weWon && complete && halfTime.home === halfTime.away && !!decider && period(decider.minute) === 2 && scoredFor(decider) === our;

  const pool: ArticleStyle[] = ['result'];
  if (our && weWon && r.record && r.record.won >= 2 && r.record.played >= 3) pool.push('season');
  // Not when the team played again later that day: the story of the day comes first
  if (our && r.next && !r.sameDay?.some(g => g.later)) pool.push('next');
  const seed = [...r.id].reduce((n, c) => n + c.charCodeAt(0), 0);
  const style: ArticleStyle = !our ? 'result' : starGoals >= 2 ? 'player' : turning ? 'turning' : pool[seed % pool.length];

  let headline: string;
  let leadText: string;
  let only = false;
  if (style === 'player') {
    const scores = starGoals === 3 ? 'scores a hat-trick' : `scores ${times(starGoals)}`;
    headline = `${short(star)} ${scores} ${draw ? `in ${us}'s ${hs}-${as} draw with ${them}` : weWon ? `as ${us} beat ${them} ${hi}-${lo}` : `but ${us} lose ${hi}-${lo} to ${them}`}`;
    const setUp = starAssists === 1 ? ' and set up another' : starAssists > 1 ? ` and set up ${num(starAssists)} more` : '';
    leadText = `${nm(star)} scored ${times(starGoals)}${setUp}${draw ? ` as ${result}` : weWon ? ` as ${result}` : `, but ${result}`}${inComp(true)}${r.day ? ` on ${r.day}` : ''}.`;
  } else if (style === 'turning' && decider) {
    const scorer = known(decider.player, decider.side) && !decider.ownGoal ? decider.player.trim() : '';
    headline = `${decider.penalty ? 'Second-half penalty' : scorer ? `${short(scorer)} goal` : 'Second-half goal'} puts ${us} past ${them}`;
    const into = decider.minute - half;
    const through = scorer ? ` through ${decider.penalty ? `a ${nm(scorer)} penalty` : nm(scorer)}` : '';
    leadText = `${us} and ${them} were level at ${halfTime.home}-${halfTime.away} at half-time${r.competition ? ` in their ${link(r.competition, r.links?.competition)}${stage && !stage.startsWith('round') ? ` ${stage}` : ' game'}` : ''}. `
      + `${us} went ahead ${into > 0 ? `${num(into)} minute${into === 1 ? '' : 's'} into the second half` : 'in the second half'}${through}, and went on to win ${hi}-${lo}.`;
  } else if (style === 'season' && r.record) {
    headline = `${us} make it ${num(r.record.won)} wins from ${num(r.record.played)} with ${hi}-${lo} win over ${them}`;
    leadText = `${us} won for the ${ordWord(r.record.won)} time in ${num(r.record.played)} games this season${r.day ? ` on ${r.day}` : ''}, beating ${them} ${hi}-${lo}${where}.`;
  } else if (style === 'next' && r.next) {
    headline = `${resultHeadline}, ${r.next.opponent} next`;
    leadText = `${us} will play ${link(r.next.opponent, r.next.href)}${r.next.competition ? ` in the ${r.next.competition}` : ''} ${r.next.when} after ${after}${inComp(true)}.`;
  } else {
    headline = `${resultHeadline}${plainText(inComp(false))}`;
    only = hi + lo === 1 && goals.length === 1 && known(goals[0].player, goals[0].side) && !goals[0].ownGoal;
    leadText = `${result}${where}${when}.${starGoals >= 2 ? ` ${nm(star)} scored ${times(starGoals)}.` : only ? ` ${nm(goals[0].player)} scored the only goal.` : ''}`;
  }
  leadText += penalties;

  const paragraphs: string[] = [];
  // A line of colour that follows from the score alone (the owner allows this as long as nothing logged
  // contradicts it): one of two wordings per kind of result, fixed per match
  if (our) {
    const spell = r.partOfDay || 'day';
    const margin = hi - lo;
    const pick = (a: string, b: string) => (seed % 2 ? a : b);
    paragraphs.push(draw
      ? hi === 0 ? pick('Both defences were on top and neither side could find a goal.', `Chances were hard to come by at both ends, and ${us} and ${them} finished without a goal between them.`)
        : pick('Neither side could find a winner before the final whistle.', `${us} and ${them} could not be separated.`)
      : weWon
        ? margin >= 3 ? pick(`${us} were on top for most of the game and the scoreline showed it.`, `It was a comfortable ${spell} for ${us}, who kept ${them} at arm's length.`)
          : margin === 2 ? pick(`${us} had the better of the chances and made them count.`, `${them} kept working, but ${us} had a little more in front of goal.`)
          : pick(`It stayed tight to the final whistle, and ${us} did enough to see it out.`, 'There was little between the sides, and one goal was the difference.')
        : margin >= 3 ? (lo === 0 ? pick(`It was a hard ${spell} for ${us}, who could not find a way through.`, `${them} took their chances and ${us} had no answer on the day.`)
            : pick(`It was a hard ${spell} for ${us} against a side that took its chances.`, `${them} took their chances and ${us} were left chasing the game.`))
          : margin === 2 ? pick(`${us} had spells in the game, but ${them} were sharper in front of goal.`, `${us} kept going to the end, but the gap was too much to close.`)
          : pick(`It was close throughout, and ${us} were left a goal short at the final whistle.`, `${us} pushed for an equaliser late on, but it did not come.`));
    // No scorers logged: the score itself is the only account of the goals
    if (!goals.length && hi > 0 && !draw) {
      const [winners, wonBy] = weWon ? [us, 'kept a clean sheet'] : [them, 'did not concede'];
      paragraphs[0] += ` ${winners} scored ${hi === 1 ? 'once' : hi === 2 ? 'twice' : `${num(hi)} times`} and ${lo === 0 ? wonBy : `conceded ${lo === 1 ? 'once' : lo === 2 ? 'twice' : `${num(lo)} times`}`}.`;
    }
  }
  const full = half * 2;
  const minutePhrase = (g: { minute: number; added?: number }, i: number, last: boolean) => {
    if (!timed) return '';
    const p = period(g.minute);
    if (g.added) return p === 1 ? 'in first-half stoppage time' : 'in stoppage time';
    if (last && p === 2 && full - g.minute <= 5) return full - g.minute < 1 ? 'in the final minute' : `${num(full - g.minute)} minute${full - g.minute === 1 ? '' : 's'} from the end`;
    if (i === 0) return g.minute <= 1 ? 'in the first minute' : `after ${g.minute} minutes`;
    return `in the ${ord(g.minute)}${i % 2 ? ' minute' : ''}`;
  };

  // The goals in the order they went in, while the log is complete and short enough to tell
  const total = hs + as;
  if (complete && total > 0 && total <= 6) {
    const score = { home: 0, away: 0 };
    const led = { home: false, away: false };
    const halves: string[][] = [[], []];
    const told: string[] = [];
    goals.forEach((g, i) => {
      const side = scoredFor(g);
      const [mine, theirs] = [score[side], score[other(side)]];
      const team = name(side);
      const who = known(g.player, g.side) ? (g.ownGoal ? `An own goal by ${nm(g.player)}` : nm(g.player)) : '';
      const ours = !!our && side === our && !!who && !g.ownGoal;
      const did = mine === 0 && theirs === 0 ? (ours ? 'got the first' : who ? `put ${team} ahead` : 'went ahead')
        : mine === theirs - 1 ? (g.ownGoal ? `brought ${team} level` : who ? `equalised for ${team}` : 'equalised')
        : mine === theirs ? (who ? `put ${team} ${led[side] ? 'back in front' : 'ahead'}` : `went ${led[side] ? 'back in front' : 'ahead'}`)
        : mine > theirs ? `made it ${mine + 1}-${theirs}`
        : who ? `pulled one back for ${team}` : 'pulled one back';
      score[side]++;
      if (score[side] > score[other(side)]) led[side] = true;
      const assist = g.assist?.trim() && !g.ownGoal ? (i % 2 ? `, with ${nm(g.assist)} assisting` : `, set up by ${nm(g.assist)}`) : '';
      const at = minutePhrase(g, i, i === goals.length - 1);
      // The lead has already named the scorer of the only goal
      const sentence = only ? (at || assist ? `The goal${g.penalty ? ', a penalty,' : ''} came${at ? ` ${at}` : ''}${assist}` : '')
        : `${who || team} ${did}${g.penalty ? ' with a penalty' : ''}${at ? ` ${at}` : ''}${assist}`;
      if (sentence) (timed ? halves[period(g.minute) === 1 ? 0 : 1] : told).push(sentence);
    });
    if (told.length) paragraphs.push(`${told.join('. ')}.`);
    if (halves[0].length) {
      const last = halves[0].pop()!;
      const [most, least] = [Math.max(halfTime.home, halfTime.away), Math.min(halfTime.home, halfTime.away)];
      paragraphs.push([...halves[0], `${last}${last.includes(',') ? ', and' : ' and'} it was ${most}-${least} at the break`].join('. ') + '.');
    }
    if (halves[1].length) paragraphs.push(`${paragraphs.length ? '' : 'There were no goals in the first half. '}${halves[1].join('. ')}.`);
  } else if (goals.length) {
    // Too many goals to walk through, or some weren't logged: name who scored, claim no more than that
    for (const side of (our ? [our] : ['home', 'away']) as Side[]) {
      const by = new Map<string, number>();
      for (const g of goals) if (scoredFor(g) === side && !g.ownGoal && known(g.player, g.side)) by.set(g.player.trim(), (by.get(g.player.trim()) || 0) + 1);
      if (!by.size) continue;
      const names = list([...by].map(([n, c]) => `${nm(n)}${c > 1 ? ` (${c})` : ''}`));
      const all = [...by.values()].reduce((a, b) => a + b, 0) === (side === 'home' ? hs : as);
      paragraphs.push(all ? `${name(side)}'s goals came from ${names}.` : `${names} ${by.size > 1 ? 'were' : 'was'} among the scorers for ${name(side)}.`);
    }
  }

  // When and how the game was played, and where it fell in the team's day
  const setting: string[] = [];
  const at = r.venue && style !== 'result' && style !== 'season' ? ` at ${link(r.venue, r.links?.venue)}` : '';
  const length = half !== 45 || r.aSide ? `${r.aSide ? `${num(r.aSide)}-a-side` : ''}` : null;
  if (r.kickoff && length !== null) {
    setting.push(seed % 2
      ? `The game kicked off at ${r.kickoff}${at} and was played over two ${half}-minute halves${length ? `, ${length}` : ''}.`
      : `Kick-off was at ${r.kickoff}${at}. The game was ${length ? `${length}, with` : 'played over'} two ${half}-minute halves.`);
  } else if (r.kickoff) setting.push(`${seed % 2 ? 'The game kicked off' : 'Kick-off was'} at ${r.kickoff}${at}.`);
  else if (length !== null) setting.push(`The game was played${at} over two ${half}-minute halves${length ? `, ${length}` : ''}.`);
  else if (at) setting.push(`The game was played${at}.`);
  if (our && r.gameOfDay && r.gameOfDay[1] > 1) setting.push(`It was the ${ordWord(r.gameOfDay[0])} of ${us}'s ${num(r.gameOfDay[1])} games on the day.`);
  if (setting.length) paragraphs.push(setting.join(' '));

  // Who started
  if (our && r.lineup?.starters.length) {
    const { captain, keeper } = r.lineup;
    const replaced = !!keeper && r.subs.some(s => s.side === our && s.off?.trim() === keeper.trim());
    const clean = (our === 'home' ? as : hs) === 0 && !!keeper && !replaced;
    const rest = r.lineup.starters.filter(n => n.trim() && n !== captain && n !== keeper);
    const side: string[] = [];
    if (captain && captain === keeper) side.push(`${nm(captain)} captained ${us} from goal${clean ? ' and kept a clean sheet' : ''}.`);
    else if (captain && keeper) side.push(clean ? `${nm(captain)} captained ${us} and ${nm(keeper)} kept a clean sheet in goal.` : `${nm(captain)} captained ${us}, with ${nm(keeper)} in goal.`);
    else if (captain) side.push(`${nm(captain)} captained ${us}.`);
    else if (keeper) side.push(`${nm(keeper)} ${clean ? `kept a clean sheet in goal for ${us}` : `was in goal for ${us}`}.`);
    if (rest.length) side.push(side.length ? `${list(rest.map(nm))} ${rest.length > 1 ? 'also started' : 'started too'}.` : `${us} started with ${list(rest.map(nm))}.`);
    paragraphs.push(side.join(' '));
  }

  // The bench and the bookings, for our own side
  const bench: string[] = [];
  if (our) {
    const subs = r.subs.filter(s => s.side === our && s.on.trim()).sort((a, b) => a.minute - b.minute);
    if (subs.length === 1) bench.push(`${nm(subs[0].on)} came on${subs[0].off?.trim() ? ` for ${nm(subs[0].off)}` : ''}${inTime(subs[0].minute) ? ` in the ${ord(subs[0].minute)} minute` : ''}.`);
    else if (subs.length > 4) bench.push(`${us} made ${num(subs.length)} substitutions.`);
    else if (subs.length) bench.push(`${list(subs.map(s => nm(s.on)))} ${subs.length === 2 ? 'both ' : ''}came off the bench${subs.every(s => period(s.minute) === 2) ? ' in the second half' : ''}.`);
    const booked = r.yellows.filter(c => c.side === our && c.player.trim());
    if (booked.length === 1) bench.push(`${us}'s only booking went to ${nm(booked[0].player)}.`);
    else if (booked.length > 3) bench.push(`${us} had ${num(booked.length)} players booked.`);
    else if (booked.length) bench.push(`${list(booked.map(c => nm(c.player)))} were booked.`);
  }
  for (const c of r.reds) if (c.player.trim()) bench.push(`${nm(c.player)} was sent off${our && c.side === our ? '' : ` for ${name(c.side)}`}${inTime(c.minute) ? ` in the ${ord(c.minute)} minute` : ''}.`);
  if (bench.length) paragraphs.push(bench.join(' '));

  // Player of the Match and the season's goal tallies (only once the stats are saved)
  const players: string[] = [];
  const potm = r.playerOfTheMatch?.trim();
  const seasonTally = (n: string) => (r.seasonGoals?.[n] ?? 0);
  const tallied = new Set<string>();
  if (potm) {
    const n = tally.has(potm) ? seasonTally(potm) : 0;
    if (n >= 2) tallied.add(potm);
    players.push(`${nm(potm)} was Player of the Match${n >= 2 ? ` and now has ${num(n)} goals for the season${r.topScorer === potm ? ', the most at the club' : ''}` : ''}.`);
  }
  for (const scorer of [...tally.keys()].filter(n => n !== potm && seasonTally(n) >= 2).slice(0, 2)) {
    players.push(tallied.size ? `${nm(scorer)} has ${num(seasonTally(scorer))}.` : `${nm(scorer)} now has ${num(seasonTally(scorer))} goals for the season${r.topScorer === scorer ? ', the most at the club' : ''}.`);
    tallied.add(scorer);
  }
  if (players.length) paragraphs.push(players.join(' '));

  // The team's other games that day
  const day = our ? r.sameDay || [] : [];
  if (day.length) {
    const told = (g: (typeof day)[number]) => link(g.ourScore > g.theirScore ? `beat ${g.opponent} ${g.ourScore}-${g.theirScore}`
      : g.ourScore === g.theirScore ? `drew ${g.ourScore}-${g.theirScore} with ${g.opponent}` : `lost ${g.theirScore}-${g.ourScore} to ${g.opponent}`, g.href);
    const [before, later] = [day.filter(g => !g.later), day.filter(g => g.later)];
    const lines: string[] = [];
    if (before.length) lines.push(`Earlier in the day ${us} ${list(before.map(told))}.`);
    if (later.length) lines.push(`Later in the day ${before.length ? 'they' : us} ${list(later.map(told))}.`);
    if (day.length >= 2 && r.gameOfDay?.[1] === day.length + 1) {
      const all = [...day, { ourScore: our === 'home' ? hs : as, theirScore: our === 'home' ? as : hs }];
      const count = (f: (g: { ourScore: number; theirScore: number }) => boolean) => all.filter(f).length;
      lines.push(`They finished the day with ${outcomes(count(g => g.ourScore > g.theirScore), count(g => g.ourScore === g.theirScore), count(g => g.ourScore < g.theirScore))}.`);
    }
    paragraphs.push(lines.join(' '));
  }

  // The season so far and the last time these two met
  const context: string[] = [];
  const rec = r.record;
  if (our && rec && rec.played >= 2) {
    const scored = rec.goalsFor != null && rec.goalsAgainst != null ? `${num(rec.goalsFor)} goal${rec.goalsFor === 1 ? '' : 's'} scored and ${num(rec.goalsAgainst)} conceded` : '';
    if (style === 'season') { if (scored) context.push(`${us} have ${scored} this season.`); }
    else context.push(`${us}'s record this season is ${outcomes(rec.won, rec.drawn, rec.lost)} from ${num(rec.played)} games${scored ? `, with ${scored}` : ''}.`);
  }
  const h = r.meetings;
  if (our && h && h.played >= 2) {
    const parts = [h.won && `won ${num(h.won)}`, h.drawn && `drawn ${num(h.drawn)}`, h.lost && `lost ${num(h.lost)}`].filter((x): x is string => !!x);
    context.push(`${context.length ? 'They' : us} have ${parts.length === 1 ? `${parts[0].split(' ')[0]} ${h.played === 2 ? 'both' : `all ${num(h.played)}`}` : `${list(parts)}`} of their ${parts.length === 1 ? '' : `${num(h.played)} `}earlier games against ${them}.`);
  }
  const m = r.lastMeeting;
  if (m) {
    const [a, b] = [Math.max(m.homeScore, m.awayScore), Math.min(m.homeScore, m.awayScore)];
    context.push(a === b
      ? `The two sides ${link(`drew ${a}-${b}`, m.href)} when they last met, on ${m.date}.`
      : `${link(`${m.homeScore > m.awayScore ? m.home : m.away} won ${a}-${b}`, m.href)} when the two sides last met, on ${m.date}.`);
  }
  if (context.length) paragraphs.push(context.join(' '));

  if (our && r.next && style !== 'next') {
    paragraphs.push(`${seed % 2 ? `Next for ${us} is` : `${us} are back in action against`} ${link(r.next.opponent, r.next.href)}${r.next.competition ? ` in the ${r.next.competition}` : ''}, ${r.next.when}${r.next.venue ? ` at ${r.next.venue}` : ''}.`);
  }

  return { style, headline, lead: leadText, paragraphs };
}
