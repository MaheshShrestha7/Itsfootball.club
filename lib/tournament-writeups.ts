// Tournament news: four write-ups the public tournament page writes by itself as the day goes on.
//   group-stage  once every group game is played (group + knockout tournaments)
//   semi-finals  once both semi-finals are played
//   final        once the final is played
//   round-up     with the final (or the last league game): the whole tournament, ending with the thank-yous
// Built only from what the app holds: games, scores, goal and card events, the standings, the
// tournament's own sponsors and its teams. Same house rules as the match article (lib/match-report.ts):
// hyphen scores, plain verbs, no opinion words, no closing line, a sentence only when the data proves it.
// Referees aren't stored, so they're thanked without names.
import { fairPlay } from './hosted-tournaments';
import { formatClock } from './dates';
import { matchPath } from './slugs';
import { juniorPublicName } from './teams';
import { topScorers, tournamentStats, winnerSide, namedScorer } from './tournament-stats';
import type { Match, MatchEvent, Tournament, TournamentParticipant, TournamentStanding } from './supabase/types';

export type WriteupKind = 'group-stage' | 'semi-finals' | 'final' | 'round-up';
export const WRITEUP_LABELS: Record<WriteupKind, string> = {
  'group-stage': 'Group stage', 'semi-finals': 'Semi-finals', final: 'Final', 'round-up': 'Tournament round-up',
};
export const isWriteupKind = (k: string): k is WriteupKind => k in WRITEUP_LABELS;

export interface Writeup { kind: WriteupKind; headline: string; lead: string; paragraphs: string[]; facts: { label: string; value: string }[] }

export interface WriteupSource {
  tournament: Pick<Tournament, 'name' | 'format' | 'venue' | 'teams_advancing_per_group' | 'player_of_tournament_name'>;
  /** This tournament's games */
  matches: Match[];
  events: MatchEvent[];
  participants: TournamentParticipant[];
  /** The live table: one group's, or the whole league's */
  standings: (group?: string) => TournamentStanding[];
  /** The tournament's active sponsors, in their display order */
  sponsors: { name: string; placement: string }[];
  matchHref: (m: Match) => string;
  teamHref: (teamName: string) => string;
  /** Player names as the public may see them (junior names shortened) */
  showName?: (name: string) => string;
}

type Stage = NonNullable<Match['tournament_stage']>;
const KO_ORDER: Stage[] = ['round_of_32', 'round_of_16', 'quarter_final', 'semi_final', 'final'];
const ROUND_NAME: Record<string, string> = { round_of_32: 'round of 32', round_of_16: 'round of 16', quarter_final: 'quarter-final', semi_final: 'semi-final', final: 'final', third_place: 'third-place game' };
const stageOf = (m: Pick<Match, 'tournament_stage'>) => m.tournament_stage || 'group';
const isDone = (m: Pick<Match, 'status'>) => m.status === 'completed';

/** The write-ups this tournament has earned so far, oldest first */
export function writeupKinds(matches: Pick<Match, 'status' | 'tournament_stage'>[]): WriteupKind[] {
  const live = matches.filter(m => m.status !== 'cancelled');
  const of = (s: string) => live.filter(m => stageOf(m) === s);
  const all = (ms: typeof live) => ms.length > 0 && ms.every(isDone);
  const knockout = live.some(m => stageOf(m) !== 'group');
  const kinds: WriteupKind[] = [];
  if (knockout && all(of('group'))) kinds.push('group-stage');
  if (all(of('semi_final'))) kinds.push('semi-finals');
  if (all(of('final'))) kinds.push('final', 'round-up');
  // A league: the round-up once every game is played
  else if (!knockout && all(live)) kinds.push('round-up');
  return kinds;
}

/** When a write-up's games ended: the last kick-off among them (for the date and News order) */
export function writeupTime(kind: WriteupKind, matches: Match[]): string {
  const ms = kind === 'group-stage' ? matches.filter(m => stageOf(m) === 'group')
    : kind === 'semi-finals' ? matches.filter(m => stageOf(m) === 'semi_final')
    : kind === 'final' ? matches.filter(m => stageOf(m) === 'final') : matches;
  const at = (m: Match) => (m.match_time && /^\d{4}-\d{2}-\d{2}$/.test(m.match_date || '') ? `${m.match_date}T${m.match_time}` : m.match_date || '');
  return ms.map(at).sort().at(-1) || '';
}

// ---- wording helpers ---------------------------------------------------------------------------
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const ORD = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'];
const num = (n: number) => WORDS[n] ?? String(n);
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);
const plural = (n: number, one: string, many = `${one}s`) => `${num(n)} ${n === 1 ? one : many}`;
const link = (t: string, h?: string) => (h ? `[${t}](${h})` : t);
const poss = (t: string) => (t.endsWith('s') ? `${t}'` : `${t}'s`);
const record = (r: { won: number; drawn: number; lost: number }) =>
  list([r.won && plural(r.won, 'win'), r.drawn && plural(r.drawn, 'draw'), r.lost && plural(r.lost, 'defeat')].filter(Boolean) as string[]);
const W = (m: Match) => (winnerSide(m) === 'away' ? m.away_team_name : m.home_team_name);
const L = (m: Match) => (winnerSide(m) === 'away' ? m.home_team_name : m.away_team_name);
/** "2-1" from the winner's side */
const scoreline = (m: Match) => (winnerSide(m) === 'away' ? `${m.away_score}-${m.home_score}` : `${m.home_score}-${m.away_score}`);
const pens = (m: Match) => (winnerSide(m) === 'away' ? `${m.away_penalty_score ?? 0}-${m.home_penalty_score ?? 0}` : `${m.home_penalty_score ?? 0}-${m.away_penalty_score ?? 0}`);
/** "beat Pokhara City 3-2", or "beat Pokhara City on penalties after a 1-1 draw" */
const beat = (m: Match, href?: string) => (m.home_score === m.away_score
  ? `beat ${L(m)} on penalties after a ${link(scoreline(m), href)} draw`
  : `beat ${L(m)} ${link(scoreline(m), href)}`);
const kickoff = (m: Match) => [m.match_time && `at ${formatClock(m.match_time)}`, m.pitch_label && `on ${m.pitch_label}`].filter(Boolean).join(' ');
const dayOf = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

function whoScored(m: Match, s: WriteupSource) {
  const show = s.showName || (n => n);
  const t = (n: number) => (n === 2 ? ' twice' : n === 3 ? ' a hat-trick' : n > 3 ? ` ${num(n)} times` : '');
  const parts = topScorers([m], s.events).map((r, i) => `${show(r.name)}${i === 0 ? ' scored' : ''}${r.goals === 3 && i > 0 ? ' with a hat-trick' : t(r.goals)} for ${r.team}`);
  return parts.length ? `${list(parts)}.` : '';
}

/** A game told goal by goal: who opened it, who levelled, who scored the winner. Nameless goals are told by team. */
function goalStory(m: Match, s: WriteupSource) {
  const show = s.showName || (n => n);
  const goals = s.events.filter(e => e.match_id === m.id && ['goal', 'penalty', 'own_goal'].includes(e.event_type))
    .sort((a, b) => a.minute - b.minute || (a.added_minute ?? 0) - (b.added_minute ?? 0));
  // Only when the log matches the score: a half-logged game would tell the wrong story
  if (goals.length !== m.home_score + m.away_score || !goals.length) return '';
  let h = 0, a = 0;
  return goals.map((e, i) => {
    const side = e.event_type === 'own_goal' ? (e.team_side === 'home' ? 'away' : 'home') : e.team_side;
    const team = side === 'home' ? m.home_team_name : m.away_team_name;
    const before = side === 'home' ? h - a : a - h;
    if (side === 'home') h++; else a++;
    const who = e.event_type === 'own_goal' ? `An own goal by ${show(e.player_name?.trim() || 'a defender')}` : namedScorer(e, team) ? show(e.player_name.trim()) : team;
    const pen = e.event_type === 'penalty' ? ' from the spot' : '';
    const last = i === goals.length - 1 && before === 0 && team === W(m);
    if (i === 0) return `${who} opened the scoring${who === team ? '' : ` for ${team}`}${pen} after ${e.minute} minutes.`;
    if (last) return `${who} scored the winner${pen} on ${e.minute} minutes.`;
    if (before === -1) return `${who} levelled${who === team ? '' : ` for ${team}`}${pen} on ${e.minute} minutes.`;
    if (before === 0) return `${who} put ${team} back in front${pen} on ${e.minute} minutes.`;
    return `${who} made it ${Math.max(h, a)}-${Math.min(h, a)}${pen} on ${e.minute} minutes.`;
  }).join(' ');
}

const groupLetters = (ps: TournamentParticipant[]) => [...new Set(ps.map(p => p.group).filter((g): g is string => !!g))].sort();
const realTeams = (m: Match, s: WriteupSource) => s.participants.some(p => p.name === m.home_team_name) && s.participants.some(p => p.name === m.away_team_name);
/** The first knockout round after the groups, once its teams are known */
function nextRound(s: WriteupSource, after: Stage | 'group') {
  const from = after === 'group' ? 0 : KO_ORDER.indexOf(after) + 1;
  for (const st of KO_ORDER.slice(from)) {
    const ms = s.matches.filter(m => stageOf(m) === st && m.status !== 'cancelled');
    if (ms.length) return ms.every(m => realTeams(m, s)) ? { stage: st, matches: ms } : null;
  }
  return null;
}
const nextLine = (s: WriteupSource, after: Stage | 'group') => {
  const n = nextRound(s, after);
  if (!n) return '';
  const games = n.matches.map(m => `${m.home_team_name} play ${m.away_team_name}${kickoff(m) ? ` ${kickoff(m)}` : ''}`);
  return n.stage === 'final' ? `The final is ${n.matches[0].home_team_name} v ${n.matches[0].away_team_name}${kickoff(n.matches[0]) ? ` ${kickoff(n.matches[0])}` : ''}.`
    : `In the ${ROUND_NAME[n.stage]}s, ${list(games)}.`;
};

function groupStage(s: WriteupSource): Writeup {
  const name = s.tournament.name;
  const gm = s.matches.filter(m => stageOf(m) === 'group' && isDone(m));
  const goals = gm.reduce((t, m) => t + m.home_score + m.away_score, 0);
  const through = Math.max(1, s.tournament.teams_advancing_per_group ?? 2);
  const tables = groupLetters(s.participants).map(g => ({ g, t: s.standings(g) })).filter(x => x.t.length);
  const tops = tables.map(x => x.t[0].name);
  const paras = tables.map(({ g, t }) => {
    const [a, ...rest] = t;
    const qual = rest.slice(0, through - 1);
    const out = rest.slice(through - 1).map(r => r.name);
    const big = gm.filter(m => m.tournament_group === `Group ${g}`).sort((x, y) => Math.abs(y.home_score - y.away_score) - Math.abs(x.home_score - x.away_score))[0];
    return [
      `${link(a.name, s.teamHref(a.name))} won Group ${g} with ${plural(a.points, 'point')}${a.played ? ` from ${record(a)}` : ''}.`,
      qual.length ? `${list(qual.map((r, i) => `${r.name} finished ${ORD[i + 2] || `${i + 2}th`} on ${plural(r.points, 'point')}`))}, and ${qual.length === 1 ? 'goes' : 'go'} through too.` : '',
      out.length ? `${list(out)} ${out.length === 1 ? 'is' : 'are'} out.` : '',
      big && Math.abs(big.home_score - big.away_score) >= 3 ? `The biggest win in the group was ${poss(W(big))} ${link(scoreline(big), s.matchHref(big))} against ${L(big)}.` : '',
    ].filter(Boolean).join(' ');
  });
  const top = topScorers(gm, s.events);
  const show = s.showName || (n => n);
  const level = tables.filter(x => x.t[1] && x.t[1].points === x.t[0].points).map(x => x.g);
  return {
    kind: 'group-stage',
    headline: `${list(tops)} top the ${tables.length === 1 ? 'group' : 'groups'} at the ${name}`,
    lead: `The group stage of the ${name} is over: ${plural(gm.length, 'game')} and ${plural(goals, 'goal')}${s.tournament.venue ? ` at ${s.tournament.venue}` : ''}. ${list(tables.map(x => `${x.t[0].name} won Group ${x.g}${level.includes(x.g) ? `, level on points with ${x.t[1].name}` : ''}`))}.`,
    paragraphs: [
      ...paras,
      top[0] ? `${show(top[0].name)} of ${top[0].team} leads the scoring with ${plural(top[0].goals, 'goal')}${top[1] && top[1].goals < top[0].goals ? `, ahead of ${show(top[1].name)} of ${top[1].team} on ${num(top[1].goals)}` : ''}.` : '',
      nextLine(s, 'group'),
    ].filter(Boolean),
    facts: [{ label: 'Games', value: String(gm.length) }, { label: 'Goals', value: String(goals) },
      ...tables.map(x => ({ label: `Group ${x.g}`, value: x.t.slice(0, through).map(r => r.name).join(', ') }))],
  };
}

function semiFinals(s: WriteupSource): Writeup {
  const sf = s.matches.filter(m => stageOf(m) === 'semi_final' && isDone(m));
  const final = s.matches.find(m => stageOf(m) === 'final');
  return {
    kind: 'semi-finals',
    headline: `${list(sf.map(W))} reach the ${s.tournament.name} final`,
    lead: `In the semi-finals, ${list(sf.map(m => `${W(m)} ${beat(m)}`))}.`,
    paragraphs: [
      ...sf.map(m => [
        m.home_score === m.away_score
          ? `${m.home_team_name} and ${m.away_team_name} drew ${link(`${m.home_score}-${m.away_score}`, s.matchHref(m))}.`
          : `${W(m)} beat ${L(m)} ${link(scoreline(m), s.matchHref(m))}.`,
        whoScored(m, s),
        m.home_score === m.away_score ? `${W(m)} won the shoot-out ${pens(m)}.` : '',
      ].filter(Boolean).join(' ')),
      nextLine(s, 'semi_final'),
    ].filter(Boolean),
    facts: [...sf.map(m => ({ label: 'Semi-final', value: `${W(m)} ${scoreline(m)}${m.home_score === m.away_score ? ` (${pens(m)} pens)` : ''} ${L(m)}` })),
      ...(final && realTeams(final, s) && final.match_time ? [{ label: 'Final', value: [formatClock(final.match_time), final.pitch_label].filter(Boolean).join(', ') }] : [])],
  };
}

/** How a team got to the final: its group record, then each knockout win */
function pathTo(team: string, s: WriteupSource) {
  const p = s.participants.find(x => x.name === team);
  const row = p?.group ? s.standings(p.group).find(r => r.name === team) : undefined;
  const wins = s.matches.filter(m => isDone(m) && stageOf(m) !== 'group' && stageOf(m) !== 'final' && stageOf(m) !== 'third_place' && W(m) === team)
    .sort((a, b) => KO_ORDER.indexOf(stageOf(a) as Stage) - KO_ORDER.indexOf(stageOf(b) as Stage));
  const ko = list(wins.map(m => `${beat(m)} in the ${ROUND_NAME[stageOf(m)]}`));
  if (row?.played) return `${team} took ${plural(row.points, 'point')} from ${record(row)} in Group ${p!.group}${ko ? `, then ${ko}` : ''}.`;
  return ko ? `On the way, ${team} ${ko}.` : '';
}

function final(s: WriteupSource): Writeup {
  const f = s.matches.find(m => stageOf(m) === 'final' && isDone(m))!;
  const pot = s.tournament.player_of_tournament_name?.trim();
  return {
    kind: 'final',
    headline: `${W(f)} win the ${s.tournament.name}`,
    lead: `${link(W(f), s.teamHref(W(f)))} ${beat(f, s.matchHref(f))} in the final${s.tournament.venue ? ` at ${s.tournament.venue}` : ''}.`,
    paragraphs: [
      goalStory(f, s) || whoScored(f, s),
      f.home_score === f.away_score ? `${W(f)} won the shoot-out ${pens(f)}.` : '',
      pathTo(W(f), s),
      pot ? `${(s.showName || (n => n))(pot)} was named Player of the Tournament.` : '',
    ].filter(Boolean),
    facts: [{ label: 'Champions', value: W(f) }, { label: 'Runners-up', value: L(f) },
      { label: 'Score', value: `${scoreline(f)}${f.home_score === f.away_score ? ` (${pens(f)} pens)` : ''}` },
      ...(f.match_time ? [{ label: 'Kick-off', value: [formatClock(f.match_time), f.pitch_label].filter(Boolean).join(', ') }] : [])],
  };
}

function roundUp(s: WriteupSource): Writeup {
  const name = s.tournament.name;
  const show = s.showName || (n => n);
  const done = s.matches.filter(isDone);
  const st = tournamentStats(s.matches, s.events, s.participants);
  const f = done.find(m => stageOf(m) === 'final');
  const table = f ? [] : s.standings();
  const champ = f ? W(f) : table[0]?.name || '';
  const dates = [...new Set(done.map(m => (m.match_date || '').slice(0, 10)).filter(Boolean))].sort();
  const when = dates.length === 1 ? ` on ${dayOf(dates[0])}` : dates.length > 1 ? ` from ${dayOf(dates[0])} to ${dayOf(dates.at(-1)!)}` : '';
  const sfLosers = done.filter(m => stageOf(m) === 'semi_final').map(L);
  const third = done.find(m => stageOf(m) === 'third_place');
  const top = st.scorers.filter(r => r.goals === st.scorers[0]?.goals);
  const { table: fair } = fairPlay(done, s.events, s.participants);
  const fairest = fair.filter(r => r.points === fair[0]?.points).map(r => r.team);
  const title = s.sponsors.find(x => x.placement === 'title');
  const others = s.sponsors.filter(x => x !== title).map(x => x.name);
  const pot = s.tournament.player_of_tournament_name?.trim();
  const thanks = [
    title || others.length ? `Thank you to ${title ? `${title.name}, who presented the ${name}${others.length ? ', and to ' : ''}` : ''}${others.length ? `${list(others)} for their support` : ''}.` : '',
    `Thank you to the referees and match officials who ran all ${plural(done.length, 'game')}, and to the ${num(s.participants.length)} teams who came to play: ${list(s.participants.map(p => p.name))}.`,
  ].filter(Boolean).join(' ');
  return {
    kind: 'round-up',
    headline: `The ${name} in review`,
    lead: `${cap(plural(s.participants.length, 'team'))} played ${plural(done.length, 'game')}${s.tournament.venue ? ` at ${s.tournament.venue}` : ''}${when}, and ${link(champ, s.teamHref(champ))} ${f ? 'won the cup' : 'finished top'}.`,
    paragraphs: [
      f ? [`${W(f)} ${beat(f)} in the final.`, third ? `${W(third)} ${beat(third)} to finish third.` : '', sfLosers.length ? `${list(sfLosers)} went out in the semi-finals.` : ''].filter(Boolean).join(' ')
        : table[1] ? `${champ} finished on ${plural(table[0].points, 'point')}, ${table[0].points === table[1].points ? `level with ${table[1].name}` : `ahead of ${table[1].name} on ${num(table[1].points)}`}.` : '',
      [`The tournament had ${plural(st.goals, 'goal')}${done.length ? `, ${(st.goals / done.length).toFixed(1)} a game` : ''}.`,
        top.length === 1 ? `${show(top[0].name)} of ${top[0].team} finished top scorer with ${plural(top[0].goals, 'goal')}.`
          : top.length > 1 && top.length <= 3 ? `${list(top.map(r => `${show(r.name)} (${r.team})`))} shared the top scorer spot on ${plural(top[0].goals, 'goal')}.` : '',
        st.fewestConceded && st.fewestConceded.teams.length <= 2 ? `${list(st.fewestConceded.teams)} let in the fewest, ${num(st.fewestConceded.value)}.` : ''].filter(Boolean).join(' '),
      fair.length && fair[0].points === 0 ? (fairest.length > 3 ? `${cap(num(fairest.length))} teams finished without a card.` : `${list(fairest)} finished without a card.`)
        : fairest.length && fairest.length <= 2 ? `${list(fairest)} ${fairest.length === 1 ? 'was the fairest team' : 'were the fairest teams'}, with ${plural(fair[0].points, 'card point')}.` : '',
      pot ? `${show(pot)} was named Player of the Tournament.` : '',
      thanks,
    ].filter(Boolean),
    facts: [
      { label: f ? 'Champions' : 'Winners', value: champ },
      ...(f ? [{ label: 'Runners-up', value: L(f) }] : table[1] ? [{ label: 'Second', value: table[1].name }] : []),
      ...(top.length ? [{ label: 'Top scorer', value: top.map(r => `${show(r.name)} (${r.goals})`).join(', ') }] : []),
      { label: 'Games', value: String(done.length) }, { label: 'Goals', value: String(st.goals) },
      ...(s.tournament.venue ? [{ label: 'Venue', value: s.tournament.venue }] : []),
    ],
  };
}

/** One write-up, or null when the tournament hasn't got that far */
export function tournamentWriteup(kind: WriteupKind, s: WriteupSource): Writeup | null {
  if (!writeupKinds(s.matches).includes(kind)) return null;
  return kind === 'group-stage' ? groupStage(s) : kind === 'semi-finals' ? semiFinals(s) : kind === 'final' ? final(s) : roundUp(s);
}

// ---- wiring for the pages ----------------------------------------------------------------------
export const writeupPath = (clubSlug: string, tournamentId: string, kind: WriteupKind) => `/${clubSlug}/tournaments/${tournamentId}/news/${kind}`;

/** The write-up source for one tournament, from the club's data */
export function writeupSourceFor(s: {
  clubSlug: string;
  tournament: Tournament;
  matches: Match[];
  matchEvents: MatchEvent[];
  participants: TournamentParticipant[];
  getTournamentStandings: (tournamentId: string, group?: string) => TournamentStanding[];
  sponsors?: { name: string; placement: string; is_active?: boolean }[];
}): WriteupSource {
  const t = s.tournament;
  const matches = s.matches.filter(m => m.tournament_id === t.id);
  const ids = new Set(matches.map(m => m.id));
  const participants = s.participants.filter(p => p.tournament_id === t.id);
  return {
    tournament: t, matches, participants,
    events: s.matchEvents.filter(e => ids.has(e.match_id)),
    standings: g => s.getTournamentStandings(t.id, g),
    sponsors: (s.sponsors || []).filter(x => x.is_active !== false),
    matchHref: m => matchPath(s.clubSlug, m),
    teamHref: name => {
      const p = participants.find(x => x.name === name);
      return p ? `/${s.clubSlug}/tournaments/${t.id}?team=${p.id}` : `/${s.clubSlug}/tournaments/${t.id}`;
    },
    showName: t.is_junior ? juniorPublicName : undefined,
  };
}

/** Every write-up a tournament has so far, newest first, with its link and date */
export function tournamentWriteups(clubSlug: string, tournamentId: string, src: WriteupSource) {
  return writeupKinds(src.matches).reverse().map(kind => ({
    kind, href: writeupPath(clubSlug, tournamentId, kind), at: writeupTime(kind, src.matches), writeup: tournamentWriteup(kind, src)!,
  })).filter(x => x.writeup);
}
