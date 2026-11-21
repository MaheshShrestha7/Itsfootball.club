// Score by chat: reading a scorer's message. Pure code, shared by the bot route and its checks.
//   parseShort("g sam 23")  -> the short format, read by plain code (free, instant, never wrong)
//   aiPrompt / parseAiReply -> what the AI is asked for anything else, and checking what it says
//   findPlayers("sam", squad) -> who a typed name can mean in this game's squad

export type Side = 'us' | 'them';
export type ChatCommand =
  | { kind: 'goal'; side: Side; player?: string; minute?: number; added?: number; type: 'goal' | 'penalty' | 'own_goal' }
  | { kind: 'card'; side: Side; player?: string; minute?: number; added?: number; color: 'yellow' | 'red' }
  | { kind: 'sub'; side: 'us'; player: string; minute?: number; added?: number }
  | { kind: 'kickoff' | 'halftime' | 'second_half' | 'fulltime' | 'undo' | 'score' | 'help' | 'yes' | 'no' }
  | { kind: 'pick'; n: number };

export const SHORT_FORMAT_HELP = 'Short format: g sam 23 · g them · y jack · r jack · og them · in ram · ko · ht · 2h · ft · undo · score · potm sam · pott sam · m12 · games';

const WORDS: Record<string, ChatCommand> = {
  ko: { kind: 'kickoff' }, 'kick off': { kind: 'kickoff' }, kickoff: { kind: 'kickoff' }, 'kick-off': { kind: 'kickoff' },
  ht: { kind: 'halftime' }, 'half time': { kind: 'halftime' }, halftime: { kind: 'halftime' }, 'half-time': { kind: 'halftime' },
  '2h': { kind: 'second_half' }, '2nd half': { kind: 'second_half' }, 'second half': { kind: 'second_half' },
  ft: { kind: 'fulltime' }, 'full time': { kind: 'fulltime' }, fulltime: { kind: 'fulltime' }, 'full-time': { kind: 'fulltime' },
  undo: { kind: 'undo' }, score: { kind: 'score' }, help: { kind: 'help' }, '/help': { kind: 'help' }, '?': { kind: 'help' },
  yes: { kind: 'yes' }, yep: { kind: 'yes' }, yeah: { kind: 'yes' }, 'yes, end it': { kind: 'yes' },
  no: { kind: 'no' }, nope: { kind: 'no' }, 'not yet': { kind: 'no' }, cancel: { kind: 'no' }, 'no assist': { kind: 'no' },
};
const GOAL_WORDS: Record<string, 'goal' | 'penalty' | 'own_goal' | undefined> = { g: 'goal', goal: 'goal', pen: 'penalty', p: 'penalty', og: 'own_goal' };
const CARD_WORDS: Record<string, 'yellow' | 'red' | undefined> = { y: 'yellow', yc: 'yellow', yellow: 'yellow', r: 'red', rc: 'red', red: 'red' };
const SUB_WORDS = new Set(['in', 'on', 'sub']);
const THEM = new Set(['them', 'they', 'opp', 'opposition', 'away', 'other']);

/** Message text tidied for matching: lower case, one space, no trailing full stop or "!" */
export const tidy = (s: string) => s.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').replace(/[.!]+$/, '').trim();

/** "23", "23'", "45+2" at the end of the words -> the minute (1-150) and any stoppage minutes */
function takeMinute(words: string[]): { minute?: number; added?: number } {
  const last = words[words.length - 1];
  const m = last && /^(\d{1,3})['’]?(?:\+(\d{1,2}))?['’]?$/.exec(last);
  if (!m) return {};
  const minute = Number(m[1]);
  if (minute < 1 || minute > 150) return {};
  words.pop();
  return { minute, added: m[2] ? Number(m[2]) : undefined };
}

/** The short format, or null when the message isn't in it (the AI may then read it) */
export function parseShort(text: string): ChatCommand | null {
  const t = tidy(text);
  if (!t || t.length > 80) return null;
  if (Object.hasOwn(WORDS, t)) return WORDS[t];
  if (/^[1-9]$/.test(t)) return { kind: 'pick', n: Number(t) };
  const words = t.split(' ');
  const head = words.shift()!;
  const goal = Object.hasOwn(GOAL_WORDS, head) ? GOAL_WORDS[head] : undefined;
  const card = Object.hasOwn(CARD_WORDS, head) ? CARD_WORDS[head] : undefined;
  const sub = SUB_WORDS.has(head);
  if (!goal && !card && !sub) return null;
  const at = takeMinute(words);
  // Our sub coming on ("in ram 60"); who goes off is asked next. Their subs aren't logged by chat.
  if (sub) {
    if (!words.length || words.length > 4 || THEM.has(words[0]) || words.some(w => !/^[\p{L}'’-]+$/u.test(w))) return null;
    return { kind: 'sub', side: 'us', player: words.join(' '), ...at };
  }
  const side: Side = words.length && THEM.has(words[0]) ? 'them' : 'us';
  if (side === 'them') words.shift();
  if (words.some(w => !/^[\p{L}'’-]+$/u.test(w)) || words.length > 4) return null;
  const player = words.length ? words.join(' ') : undefined;
  // Our own player's goal needs a name; a card always does
  if (card && !player) return null;
  if (goal && goal !== 'own_goal' && side === 'us' && !player) return null;
  return goal
    ? { kind: 'goal', side, player, type: goal, ...at }
    : { kind: 'card', side, player, color: card!, ...at };
}

// ------------------------------------------------------------------------------
// Names
// ------------------------------------------------------------------------------

export interface SquadPlayer { id: string; name: string }
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Everyone in the squad a typed name can mean: the full name, else the first or last name, else names starting with it */
export function findPlayers<T extends SquadPlayer>(typed: string, squad: T[]): T[] {
  const q = fold(typed);
  if (!q) return [];
  const parts = (p: SquadPlayer) => fold(p.name).split(/\s+/);
  const tiers: ((p: T) => boolean)[] = [
    p => fold(p.name) === q,
    p => parts(p)[0] === q || parts(p)[parts(p).length - 1] === q,
    p => fold(p.name).startsWith(q) || parts(p).some(w => w.startsWith(q)),
  ];
  for (const ok of tiers) {
    const hits = squad.filter(ok);
    if (hits.length) return hits;
  }
  return [];
}

/** First names only, once each: all the AI is told about the squad */
export const firstNames = (squad: SquadPlayer[]) => [...new Set(squad.map(p => p.name.trim().split(/\s+/)[0]).filter(Boolean))];

// ------------------------------------------------------------------------------
// The AI
// ------------------------------------------------------------------------------

export const AI_SYSTEM = [
  'You read one message sent by the person scoring a football (soccer) match from the sideline for "us".',
  'Answer with one JSON object only, no other text:',
  '{"action": "goal"|"penalty"|"own_goal"|"yellow"|"red"|"kickoff"|"halftime"|"second_half"|"fulltime"|"undo"|"score"|"unknown",',
  ' "side": "us"|"them", "player": string|null, "minute": number|null}',
  'side is the team of the player who scored, put it in their own net, or got the card. "they scored" is a goal with side "them". An own goal by our player is action "own_goal", side "us"; by their player, side "them".',
  'player is the name as written in the message (a first name from our squad when it is our player), or null. "again" means the same player as before is unknown to you: use null unless a name is given.',
  'minute only when the message gives one. If the message is not about the match, or you are unsure, use "unknown".',
].join('\n');

export const aiPrompt = (text: string, names: string[]) =>
  `Our squad's first names: ${names.join(', ') || '(none)'}\nMessage: ${text.slice(0, 300)}`;

const AI_ACTIONS = new Set(['goal', 'penalty', 'own_goal', 'yellow', 'red', 'kickoff', 'halftime', 'second_half', 'fulltime', 'undo', 'score']);

/** The AI's answer as a command, or null if it is unsure or says something we can't use */
export function parseAiReply(raw: string): ChatCommand | null {
  const json = /\{[\s\S]*\}/.exec(raw || '')?.[0];
  if (!json) return null;
  let v: Record<string, unknown>;
  try { v = JSON.parse(json); } catch { return null; }
  const action = String(v.action || '');
  if (!AI_ACTIONS.has(action)) return null;
  const side: Side = v.side === 'them' ? 'them' : 'us';
  const player = typeof v.player === 'string' && /^[\p{L}'’ -]{1,40}$/u.test(v.player.trim()) ? v.player.trim() : undefined;
  const minute = Number.isInteger(v.minute) && (v.minute as number) >= 1 && (v.minute as number) <= 150 ? (v.minute as number) : undefined;
  if (action === 'goal' || action === 'penalty' || action === 'own_goal') {
    if (side === 'us' && action !== 'own_goal' && !player) return null;
    return { kind: 'goal', side, player, minute, type: action };
  }
  if (action === 'yellow' || action === 'red') return player ? { kind: 'card', side, player, minute, color: action } : null;
  return { kind: action as 'kickoff' };
}

/** Which side scores: our goal for us, their own goal for us too */
export function scoringSide(c: { side: Side; type: 'goal' | 'penalty' | 'own_goal' }): Side {
  return c.type === 'own_goal' ? (c.side === 'us' ? 'them' : 'us') : c.side;
}

// How chat saves Player of the Match: a commentary line Match Centre reads back when the player stats are saved
export const POTM_NOTE = 'Player of the Match: ';
