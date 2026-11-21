// Score by chat: what Itsfootball.club Bot does with one message (server only, service role).
// The channel (Telegram today) only passes the text in and sends the replies out.
//
// Rules: only a chat linked to a member who may edit Match Centre, at a club that turned score by chat
// on, and only club and tournament games that aren't finished. Goals and cards save at once with an Undo;
// full time waits for a yes. The AI reads only what the short format can't, never for a junior team,
// and only within Mission Control's switches and daily limits.
import type { SupabaseClient } from '@supabase/supabase-js';
import { findPlayers, firstNames, parseShort, POTM_NOTE, scoringSide, SHORT_FORMAT_HELP, tidy, type ChatCommand, type SquadPlayer } from './chat-score';
import { aiConfigured, readWithAi, type AiReader } from './chat-ai';
import { sendMatchAlert } from './match-push-server';
import { getLiveMinute } from './live-minute';
import { fullMinutes, halfMinutes, periodStartMinute, splitMinute } from './match-length';
import { clubTimeZone, SITE_TIME_ZONE } from './dates';
import { boardText, matchTag, refreshBoards } from './chat-board';
import { telegramConfigured } from './telegram';
import { durableRateLimit } from './rate-limit';
import { subDetail } from './match-subs';
import { isJuniorFixture, juniorPublicName, teamLabel, teamOfMatch } from './teams';
import { knockoutLockReason, resolveTournament, STAGE_TITLES } from './tournament-engine';
import type { Club, ClubMember, ClubTeam, Match, MatchEvent, Tournament, TournamentParticipant } from './supabase/types';

/** board: this reply is the live scoreboard; the channel pins it and remembers it for later edits */
export interface BotReply { text: string; buttons?: string[]; board?: { matchId: string; linkId: string } }
type Pending =
  | { type: 'game'; ids: string[]; text: string; page?: number }
  | { type: 'player'; command: ChatCommand; options: string[] }
  // pens: the shoot-out of a level knockout game (home, away), waiting for the yes
  | { type: 'fulltime'; pens?: [number, number] }
  | { type: 'pens' }
  | { type: 'their_scorer'; eventId: string }
  // A tournament goal or card whose team the message didn't settle
  | { type: 'team'; command: ChatCommand }
  // Optional assist after our goal; who went off after "in ram". options: the names asked about when two match.
  // side: the team's side in a tournament game.
  | { type: 'assist'; eventId: string; scorer: string; options?: string[]; side?: Side }
  | { type: 'sub_off'; on: string; minute: number; added: number; options?: string[]; side?: Side }
  | { type: 'potm'; options?: string[] }
  | { type: 'pott'; options?: string[] };
type Side = 'home' | 'away';
/** A player the bot can name: one of our squad, or in a tournament anyone in either team */
interface Player extends SquadPlayer { side?: Side; team?: string; memberId?: string; junior?: boolean }
interface Link { id: string; club_id: string; member_id: string; chat_id: string; active_match_id: string | null; pending: Pending | null }
interface Settings { ai_enabled: boolean; daily_limit: number; club_daily_limit: number; per_minute: number }
const DEFAULT_SETTINGS: Settings = { ai_enabled: true, daily_limit: 400, club_daily_limit: 50, per_minute: 30 };

// Words that mean the message is about the game, not a name for their scorer
const NOT_A_NAME = new Set(['they', 'them', 'we', 'us', 'our', 'scored', 'score', 'goal', 'again', 'yellow', 'red', 'card', 'half', 'time', 'full', 'kick', 'off', 'penalty', 'pen', 'own', 'no', 'yes', 'undo', 'help']);
const POTM = /\b(man|player|woman) of the match\b|\b[pm]otm\b/i;
const POTT = /\b(man|player|woman) of the tournament\b|\bpott\b/i;
const NOT_LINKED = "This chat isn't set up to update scores. Ask your club admin for a Link chat link.";
const OPEN = ['upcoming', 'live', 'halftime'];
// Messages that bring the game list back
const SWITCH = new Set(['games', 'game', 'matches', 'match', 'switch', 'change game', 'switch game']);

/** The name in "potm mahesh", "man of the match: mahesh" or "mahesh is man of the match" ('' when there isn't one) */
export function potmName(text: string, award = POTM): string {
  const m = award.exec(text);
  if (!m) return '';
  const after = text.slice(m.index + m[0].length).replace(/^[\s:,-]*(?:(?:is|was|goes to|to)\b)?[\s:,-]*/i, '').trim();
  if (after) return after.replace(/[.!]+$/, '');
  return text.slice(0, m.index).replace(/\b(?:is|was)\s*(?:the\s*)?$/i, '').replace(/[\s:,-]+$/, '').trim();
}

/** A shoot-out score typed as "4-3" (home first), or null */
export function parsePens(text: string): [number, number] | null {
  const m = /^(\d{1,2})\s*[-–:]\s*(\d{1,2})$/.exec(text.trim());
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/** A knockout-slot placeholder ("TBD", "1st Group A", "Winner M#3"): a game nobody can score yet */
const placeholder = (name: string) => !name || name === 'TBD' || /^\d+(st|nd|rd|th) Group [A-H]$/.test(name) || /^(Winner|Loser) M#/.test(name);
/** "Semi-Final", "Grand Final": one game's stage */
const stageName = (stage?: string | null) => (stage && STAGE_TITLES[stage] ? STAGE_TITLES[stage].replace(/-Finals$/, '-Final') : '');
const isKnockout = (m: Pick<Match, 'tournament_id' | 'tournament_stage'>) => !!m.tournament_id && !!m.tournament_stage && m.tournament_stage !== 'group';

/** The side a typed team name means ("lions" for Camden Lions), or null when it's neither or both */
export function sideByName(typed: string, home: { name: string; short?: string | null }, away: { name: string; short?: string | null }): Side | null {
  const q = tidy(typed);
  if (!q) return null;
  const fits = (t: { name: string; short?: string | null }) => {
    const n = tidy(t.name);
    return n === q || tidy(t.short || '') === q || n.split(' ').includes(q) || n.startsWith(`${q} `);
  };
  const h = fits(home), a = fits(away);
  return h === a ? null : h ? 'home' : 'away';
}

/** The day (YYYY-MM-DD) in a time zone */
export const dayIn = (zone: string, now: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

/**
 * The club's day a match is on. match_date is a timestamp: a date-only fixture is saved as midnight UTC
 * (read as that date, as matchStart in admin-calendar does); anything else is a real moment, read in the zone.
 */
export function matchDay(matchDate: string, zone: string): string {
  const d = new Date(matchDate);
  if (isNaN(d.getTime())) return matchDate.slice(0, 10);
  return d.getUTCHours() === 0 && d.getUTCMinutes() === 0 ? d.toISOString().slice(0, 10) : dayIn(zone, d);
}

/** When today began in a time zone, as an ISO instant (AI limits reset at midnight Sydney time) */
export function dayStartIso(zone: string, now: Date): string {
  const day = dayIn(zone, now);
  const guess = Date.parse(`${day}T00:00:00Z`);
  // The zone's offset at that moment: its wall clock read back as if it were UTC
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(new Date(guess)).map(p => [p.type, p.value]));
  const wall = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return new Date(guess - (wall - guess)).toISOString();
}

/** The AI readers allowed right now, in order: Flash-Lite under the daily limit, then Gemma 4, then none */
export function allowedReaders(s: Settings, used: { flash: number; gemma: number; club: number }): AiReader[] {
  if (!s.ai_enabled || used.club >= s.club_daily_limit) return [];
  if (used.flash < s.daily_limit) return ['flash-lite', 'gemma'];
  if (used.gemma < s.daily_limit) return ['gemma'];
  return [];
}

/** "LIVE", "today 3pm" or "Sat 28 Nov 3:30pm", for the game list */
export function gameWhen({ match: m, day, today }: { match: Pick<Match, 'status' | 'match_time'>; day: string; today: string }): string {
  if (m.status === 'live' || m.status === 'halftime') return 'LIVE';
  if (m.status === 'completed') return 'finished';
  const date = day === today ? 'today' : new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${day}T12:00:00Z`)).replace(/,/g, '');
  const [h, min] = (m.match_time || '').split(':').map(Number);
  const time = !m.match_time || isNaN(h) ? '' : ` ${h % 12 || 12}${min ? `:${String(min).padStart(2, '0')}` : ''}${h < 12 ? 'am' : 'pm'}`;
  return date + time;
}

const titleCase = (s: string) => s.replace(/\b\p{L}/gu, c => c.toUpperCase());
const minuteLabel = (m: number, added?: number) => (added ? `${m}+${added}'` : `${m}'`);

export async function handleChatMessage(db: SupabaseClient, chatId: string, rawText: string, now = new Date()): Promise<BotReply[]> {
  const text = rawText.trim().slice(0, 300);
  if (!text) return [];

  // Linking: /start <code> from the member's one-time link
  const start = /^\/start(?:\s+([A-Za-z0-9_-]{8,64}))?$/.exec(text);
  if (start) return start[1] ? [await linkChat(db, chatId, start[1], now)] : [{ text: NOT_LINKED }];

  const { data: all, error } = await db.from('chat_links').select('id, club_id, member_id, chat_id, active_match_id, pending, linked_at').eq('channel', 'telegram').eq('chat_id', chatId);
  if (error) return [{ text: "Score by chat isn't ready yet. Please try again later." }];
  if (!all?.length) return [{ text: NOT_LINKED }];
  // One club per chat: the club linked last. Linking another club switches the chat over to it.
  const latest = [...all].sort((a, b) => String(b.linked_at || '').localeCompare(String(a.linked_at || '')))[0].club_id;
  const links = all.filter(l => l.club_id === latest);

  const { data: settingsRow } = await db.from('platform_chat_settings').select('ai_enabled, daily_limit, club_daily_limit, per_minute').eq('id', 1).maybeSingle();
  const settings: Settings = { ...DEFAULT_SETTINGS, ...(settingsRow || {}) };
  if (!(await durableRateLimit(`chat-msg:${chatId}`, settings.per_minute, 60_000))) return [{ text: 'Slow down a little: too many messages this minute. Try again in a moment.' }];

  // Only links whose club has score by chat on and whose member may still score
  const usable: Link[] = [];
  for (const l of links as Link[]) {
    const [{ data: club }, { data: may }] = await Promise.all([
      db.from('club_chat_settings').select('scoring_enabled').eq('club_id', l.club_id).maybeSingle(),
      db.rpc('chat_member_can_score', { p_member_id: l.member_id }),
    ]);
    if (club?.scoring_enabled && may === true) usable.push(l);
  }
  if (!usable.length) return [{ text: 'Score by chat is turned off for you right now. Ask your club admin.' }];

  const bot = new Bot(db, chatId, usable, settings, now);
  const replies = await bot.handle(text);
  return replies;
}

async function linkChat(db: SupabaseClient, chatId: string, code: string, now: Date): Promise<BotReply> {
  const { data: row } = await db.from('chat_link_codes').select('code, club_id, member_id, expires_at, used_at').eq('code', code).maybeSingle();
  if (!row || row.used_at || Date.parse(row.expires_at) < now.getTime()) return { text: 'That link has expired or was already used. Ask your club admin for a new one.' };
  const { data: may } = await db.rpc('chat_member_can_score', { p_member_id: row.member_id });
  if (may !== true) return { text: "Your role at the club doesn't allow scoring. Ask your club admin." };
  const [{ data: member }, { data: club }] = await Promise.all([
    db.from('club_members').select('full_name, first_name').eq('id', row.member_id).maybeSingle(),
    db.from('clubs').select('name').eq('id', row.club_id).maybeSingle(),
  ]);
  // Used first, so the same link can't link two chats
  const { data: claimed } = await db.from('chat_link_codes').update({ used_at: now.toISOString() }).eq('code', code).is('used_at', null).select('code');
  if (!claimed?.length) return { text: 'That link was already used. Ask your club admin for a new one.' };
  const { error } = await db.from('chat_links').upsert(
    { club_id: row.club_id, member_id: row.member_id, channel: 'telegram', chat_id: chatId, linked_at: now.toISOString(), active_match_id: null, pending: null },
    { onConflict: 'channel,chat_id,member_id' },
  );
  if (error) return { text: "Couldn't link this chat. Please try the link again." };
  // Linking another club switches the chat over: drop the old club's links so its games don't mix in
  const { data: old } = await db.from('chat_links').select('club_id').eq('channel', 'telegram').eq('chat_id', chatId).neq('club_id', row.club_id);
  let was = '';
  if (old?.length) {
    await db.from('chat_links').delete().eq('channel', 'telegram').eq('chat_id', chatId).neq('club_id', row.club_id);
    const { data: names } = await db.from('clubs').select('name').in('id', [...new Set(old.map(o => o.club_id))]);
    was = ` It's no longer linked to ${(names || []).map(n => n.name).join(' or ') || 'your other club'}.`;
  }
  const first = member?.first_name || (member?.full_name || '').split(' ')[0] || 'there';
  return { text: `Hi ${first}! This chat is linked to ${club?.name || 'your club'}.${was} When a game is on, send things like "g sam 23" or "they scored".\n${SHORT_FORMAT_HELP}` };
}

interface Game { link: Link; match: Match; day: string; today: string }
/** "M#3 Austral Reds vs Camden Lions" for a tournament game, "Austral vs Rovers" otherwise */
const gameName = (m: Match) => `${m.tournament_match_number ? `M#${m.tournament_match_number} ` : ''}${m.home_team_name} vs ${m.away_team_name}`;

class Bot {
  private link!: Link;
  private match!: Match;
  private club!: Pick<Club, 'id' | 'name' | 'slug' | 'config'>;
  private teams: ClubTeam[] = [];
  private member!: Pick<ClubMember, 'id' | 'full_name'>;
  private squadCache: SquadPlayer[] | null = null;
  // A tournament game's tournament, its teams and everyone the bot can name in it
  private tour: { t: Tournament; parts: TournamentParticipant[]; players: Player[] } | null = null;
  // Something on the scoreboard changed this message (the boards get rewritten after it)
  private changed = false;
  private log: { reader: AiReader | 'short' | 'none'; result: string; eventId?: string; aiError?: boolean } = { reader: 'short', result: '' };

  constructor(private db: SupabaseClient, private chatId: string, private links: Link[], private settings: Settings, private now: Date) {}

  async handle(text: string): Promise<BotReply[]> {
    const pick = await this.pickGame(text);
    if ('reply' in pick) return [pick.reply];
    if (this.match.tournament_id) await this.loadTournament();
    // After a tap on the game list: say which game, then carry on with the message that brought the list up
    const replies = pick.picked ? [pick.picked, ...(pick.rerun ? await this.run(pick.rerun) : [])] : await this.run(text);
    // Picking a game that's already on brings its scoreboard (kick-off brings one too)
    if (pick.picked && ['live', 'halftime'].includes(this.match.status) && !replies.some(r => r.board)) replies.push(await this.boardReply());
    if (this.changed && telegramConfigured()) {
      try { await refreshBoards(this.db, this.match.id, this.now); } catch (e) { console.error('[chat-bot] board refresh failed:', e); }
    }
    await this.db.from('chat_messages').insert({
      club_id: this.link.club_id, member_id: this.link.member_id, match_id: this.match.id, chat_id: this.chatId,
      body: text.slice(0, 500), reader: this.log.reader, result: (this.log.result || replies.map(r => r.text).join(' | ')).slice(0, 500),
      event_id: this.log.eventId || null, ai_error: !!this.log.aiError,
    });
    await this.db.from('chat_links').update({ last_used_at: this.now.toISOString() }).eq('id', this.link.id);
    return replies;
  }

  // ---------------------------------------------------------------------------
  // Which game
  // ---------------------------------------------------------------------------

  private async pickGame(text: string): Promise<{ reply: BotReply } | { rerun?: string; picked?: BotReply }> {
    const clubIds = [...new Set(this.links.map(l => l.club_id))];
    const [{ data: clubs }, { data: teams }, { data: members }] = await Promise.all([
      this.db.from('clubs').select('id, name, slug, config').in('id', clubIds),
      this.db.from('club_teams').select('*').in('club_id', clubIds),
      this.db.from('club_members').select('id, full_name').in('id', this.links.map(l => l.member_id)),
    ]);
    const awardMsg = POTM.test(text) || POTT.test(text) || this.links.some(l => l.pending?.type === 'potm' || l.pending?.type === 'pott');
    // Every game the scorer can pick: live ones (whatever their date), today's and later upcoming ones,
    // and for the awards, today's finished ones. Live first, then by date and kick-off time.
    const games: Game[] = [];
    const skipped: string[] = [];
    for (const l of this.links) {
      const club = (clubs || []).find(c => c.id === l.club_id);
      if (!club) continue;
      const zone = clubTimeZone(club);
      const today = dayIn(zone, this.now);
      const yesterday = dayIn('UTC', new Date(Date.parse(`${today}T12:00:00Z`) - 86_400_000));
      const [{ data: near }, { data: live }] = await Promise.all([
        this.db.from('matches').select('*').eq('club_id', l.club_id).gte('match_date', yesterday).order('match_date', { ascending: true }).limit(200),
        this.db.from('matches').select('*').eq('club_id', l.club_id).in('status', ['live', 'halftime']),
      ]);
      const rows = [...((near || []) as Match[]), ...((live || []) as Match[]).filter(m => !(near || []).some(n => n.id === m.id))];
      for (const m of rows) {
        const day = matchDay(m.match_date, zone);
        const live = m.status === 'live' || m.status === 'halftime';
        if (!live && day < today) continue;
        if (!live && day > today && m.status !== 'upcoming') continue;
        // A knockout game whose teams aren't known yet
        if (m.tournament_id && m.status === 'upcoming' && (placeholder(m.home_team_name) || placeholder(m.away_team_name))) continue;
        // Why a game the scorer can see isn't offered, so "No game" is never a mystery.
        // A finished game stays open for the awards only.
        const why = !OPEN.includes(m.status) && !(awardMsg && m.status === 'completed' && day === today) ? `it is ${m.status}`
          : !m.tournament_id && m.match_type === 'internal' ? "it's an in-house game (not covered yet)" : '';
        if (why) { if (day === today) skipped.push(`${m.home_team_name} vs ${m.away_team_name}: ${why}`); continue; }
        games.push({ link: l, match: m, day, today });
      }
    }
    const isLive = (g: Game) => (g.match.status === 'live' || g.match.status === 'halftime' ? 0 : 1);
    games.sort((a, b) => isLive(a) - isLive(b) || a.day.localeCompare(b.day) || (a.match.match_time || '').localeCompare(b.match.match_time || '')
      || (a.match.tournament_match_number ?? 0) - (b.match.tournament_match_number ?? 0));

    const choose = (g: { link: Link; match: Match }) => {
      this.link = g.link;
      this.match = g.match;
      this.club = (clubs || []).find(c => c.id === g.link.club_id)!;
      this.teams = ((teams || []) as ClubTeam[]).filter(t => t.club_id === g.link.club_id);
      this.member = (members || []).find(m => m.id === g.link.member_id) || { id: g.link.member_id, full_name: 'a scorer' };
    };
    const pick = async (g: Game, waiting: string) => {
      await this.db.from('chat_links').update({ active_match_id: null, pending: null }).in('id', this.links.map(l => l.id));
      await this.db.from('chat_links').update({ active_match_id: g.match.id, pending: null }).eq('id', g.link.id);
      this.links.forEach(l => { l.active_match_id = null; l.pending = null; });
      g.link.active_match_id = g.match.id;
      choose(g);
      const m = g.match;
      const where = [m.tournament_group, m.pitch_label].filter(Boolean).join(', ');
      const tag = matchTag(m, this.teams);
      const picked = { text: `Scoring ${tag ? `${tag}: ` : ''}${gameName(m)}, ${gameWhen(g)}${where ? ` (${where})` : ''}. ${m.status === 'upcoming' ? 'Send ko at kick-off, or games to switch.' : 'Send games to switch.'}` };
      // Carry on with the message that brought up the list, if it was something to do (not just "hi")
      const again = waiting && (parseShort(waiting) || POTM.test(waiting) || POTT.test(waiting)) && !SWITCH.has(tidy(waiting)) ? waiting : undefined;
      return { picked, rerun: again };
    };

    if (!games.length) {
      const seen = skipped.length ? `\nToday's games I can't score:\n${skipped.slice(0, 4).join('\n')}` : "\nThere's no upcoming or live game at your club.";
      return { reply: { text: `No game for you to score. Games show here until full time.${seen}\n${SHORT_FORMAT_HELP}` } };
    }

    // "m12": a tournament game by its match number
    const byNumber = /^m\s*#?\s*(\d{1,3})$/i.exec(text.trim());
    if (byNumber) {
      const hits = games.filter(g => g.match.tournament_match_number === Number(byNumber[1]));
      if (hits.length === 1) return pick(hits[0], '');
      if (!hits.length) return { reply: { text: `No match ${byNumber[1]} to score. Send games for the list.` } };
    }

    // A tap on the game list ("2. Austral vs ...", or just "2"), or More games
    const asked = this.links.find(l => l.pending?.type === 'game');
    const pending = asked?.pending?.type === 'game' ? asked.pending : null;
    const tapped = /^([1-9])(?:[.)\s]|$)/.exec(text.trim());
    if (pending && tapped) {
      const g = games.find(x => x.match.id === pending.ids[Number(tapped[1]) - 1]);
      if (g) return pick(g, pending.text);
    }
    const more = pending && tidy(text) === 'more games';

    // The game picked earlier, until it's finished (or "games" to pick again)
    const active = !more && !SWITCH.has(tidy(text)) && games.find(g => g.link.active_match_id === g.match.id);
    if (active) { choose(active); return {}; }

    // Five a page, with More games after them
    const PAGE = 5;
    const page = more ? ((pending!.page || 0) + 1) * PAGE < games.length ? (pending!.page || 0) + 1 : 0 : 0;
    const list = games.slice(page * PAGE, page * PAGE + PAGE);
    const next: Pending = { type: 'game', ids: list.map(g => g.match.id), text: more ? pending!.text : text, page };
    await this.db.from('chat_links').update({ pending: next }).eq('id', list[0].link.id);
    list[0].link.pending = next;
    const hasMore = games.length > PAGE;
    // "Seniors: " before a club game once the club has several teams (a tournament game has its M#)
    const teamOf = (m: Match) => {
      const own = ((teams || []) as ClubTeam[]).filter(t => t.club_id === m.club_id);
      const t = own.length > 1 ? teamOfMatch(m, own) : undefined;
      return t ? `${teamLabel(t)}: ` : '';
    };
    return {
      reply: {
        text: `Which game are you scoring? Tap one.${hasMore ? ` (${page * PAGE + 1}-${page * PAGE + list.length} of ${games.length}. For a tournament game you can also send its number, like m12.)` : ''}`,
        buttons: [...list.map((g, i) => `${i + 1}. ${teamOf(g.match)}${gameName(g.match)}${g.match.pitch_label ? `, ${g.match.pitch_label}` : ''}, ${gameWhen(g)}`), ...(hasMore ? ['More games'] : [])],
      },
    };
  }

  // ---------------------------------------------------------------------------
  // The message
  // ---------------------------------------------------------------------------

  /** Our side in a club game. A tournament game has no "us": every side is a team, and scores read home first. */
  private get ourSide(): Side { return this.match.tournament_id ? 'home' : this.match.is_club_home === false ? 'away' : 'home'; }
  private get junior() { return !!this.tour?.t.is_junior || isJuniorFixture(this.match, this.teams); }
  private teamName(side: Side) { return side === 'home' ? this.match.home_team_name : this.match.away_team_name; }
  private score(home = this.match.home_score, away = this.match.away_score) {
    const [us, them] = this.ourSide === 'home' ? [home, away] : [away, home];
    return `${us}-${them}`;
  }
  private fullScore() { return `${this.match.home_team_name} ${this.match.home_score}-${this.match.away_score} ${this.match.away_team_name}`; }
  /** "Sam Lee (Austral Reds)" in a tournament, where the same name can play for either team */
  private label(p: Player) { return p.team ? `${p.name} (${p.team})` : p.name; }

  private async setPending(p: Pending | null) {
    this.link.pending = p;
    await this.db.from('chat_links').update({ pending: p }).eq('id', this.link.id);
  }

  private async run(text: string): Promise<BotReply[]> {
    const pending = this.link.pending;
    let command = parseShort(text);
    const tour = !!this.match.tournament_id;

    // "Yes, end it" is only ever the full-time button: it ends the game even if a message came in between
    if (tidy(text) === 'yes, end it') {
      await this.setPending(null);
      return this.fullTime(pending?.type === 'fulltime' ? pending.pens : undefined);
    }
    if (pending?.type === 'fulltime') {
      if (command?.kind === 'yes') { await this.setPending(null); return this.fullTime(pending.pens); }
      if (command?.kind === 'no') { await this.setPending(null); return [{ text: 'OK, still playing.' }]; }
      // Chatter keeps the question open; another command (a late goal) moves on
      if (command) await this.setPending(null);
    }
    if (pending?.type === 'pens') {
      const pens = parsePens(text);
      if (pens) {
        if (pens[0] === pens[1]) return [{ text: "A shoot-out can't end level. Send the final penalty score, like 4-3." }];
        const winner = this.teamName(pens[0] > pens[1] ? 'home' : 'away');
        await this.setPending({ type: 'fulltime', pens });
        return [{ text: `End ${this.gameLabel()} at ${this.score()}, ${winner} win ${Math.max(...pens)}-${Math.min(...pens)} on penalties?`, buttons: ['Yes, end it', 'Not yet'] }];
      }
      if (command?.kind === 'no') { await this.setPending(null); return [{ text: 'OK, still playing.' }]; }
      if (command) await this.setPending(null);
    }
    if (POTT.test(text)) {
      if (!this.tour) return [{ text: 'Player of the Tournament is for tournament games. For this game, send potm and a name.' }];
      const name = potmName(text, POTT);
      if (!name) {
        await this.setPending({ type: 'pott' });
        return [{ text: `Who's Player of the Tournament for ${this.tour.t.name}? Send the name.`, buttons: ['Cancel'] }];
      }
      return (await this.answerName({ type: 'pott' }, name, null)) || [{ text: `"${name}" doesn't look like a name. Try: pott sam` }];
    }
    if (POTM.test(text)) {
      if (this.match.status === 'upcoming') return [{ text: 'Player of the Match comes once the game is under way.' }];
      const name = potmName(text);
      if (!name) {
        await this.setPending({ type: 'potm' });
        return [{ text: "Who's Player of the Match? Send the name.", buttons: ['Cancel'] }];
      }
      const answer = await this.answerName({ type: 'potm' }, name, null);
      return answer || [{ text: `"${name}" doesn't look like a name. Try: potm sam` }];
    }
    if (this.match.status === 'completed') {
      // Only the awards reach a finished game
      const answer = pending?.type === 'potm' || pending?.type === 'pott' ? (await this.setPending(null), await this.answerName(pending, text, command)) : null;
      return answer || [{ text: `This game has finished. Send potm and a name for Player of the Match${tour ? ', pott for Player of the Tournament,' : ''} or fix anything else in ${tour ? 'the tournament screen' : 'Match Centre'}.` }];
    }
    if (pending?.type === 'player') {
      await this.setPending(null);
      const chosen = command?.kind === 'pick' ? pending.options[command.n - 1] : pending.options.find(o => tidy(o) === tidy(text));
      if (chosen && (pending.command.kind === 'goal' || pending.command.kind === 'card' || pending.command.kind === 'sub')) return this.logEvent({ ...pending.command, player: chosen }, true);
    }
    if (pending?.type === 'team') {
      await this.setPending(null);
      const c = pending.command;
      const side = command?.kind === 'pick' ? (['home', 'away'] as const)[command.n - 1] : sideByName(text, { name: this.match.home_team_name }, { name: this.match.away_team_name });
      if (side && (c.kind === 'goal' || c.kind === 'card' || c.kind === 'sub')) return this.logEvent(c, false, { side, player: c.player ? titleCase(c.player) : this.teamName(side), named: !!c.player });
      if (command?.kind === 'no') return [{ text: 'OK, nothing saved.' }];
    }
    if (pending?.type === 'their_scorer') {
      await this.setPending(null);
      const words = tidy(text).split(' ');
      if (!command && /^[\p{L}'’ -]{2,40}$/u.test(text.trim()) && words.length <= 3 && !words.some(w => NOT_A_NAME.has(w))) {
        const name = titleCase(text.trim());
        const { data } = await this.db.from('match_events').update({ player_name: name }).eq('id', pending.eventId).eq('match_id', this.match.id).select('id');
        this.changed = true;
        this.log.result = `Scorer: ${name}`;
        return [{ text: data?.length ? `Added ${this.match.tournament_id ? 'the' : 'their'} scorer: ${name}.` : "That goal isn't there any more." }];
      }
    }

    if (pending?.type === 'assist' || pending?.type === 'sub_off' || pending?.type === 'potm' || pending?.type === 'pott') {
      await this.setPending(null);
      const answer = await this.answerName(pending, text, command);
      if (answer) return answer;
    }

    // In a tournament "g 23" (no name) is a goal for a team we ask about
    const bare = tour && !command ? /^(?:g|goal)(?:\s+(\d{1,3}))?$/i.exec(text.trim()) : null;
    if (bare) command = { kind: 'goal', side: 'them', type: 'goal', ...(bare[1] ? { minute: Number(bare[1]) } : {}) };

    if (!command) {
      command = await this.readWithAi(text);
      if (!command) {
        return [{ text: `${this.log.aiError ? 'The AI is busy, so I' : 'I'} didn't catch that. Try: g sam 23\n${SHORT_FORMAT_HELP}` }];
      }
    }
    return this.execute(command);
  }

  private async readWithAi(text: string): Promise<ChatCommand | null> {
    this.log.reader = 'none';
    if (this.junior || !aiConfigured()) return null;
    const { data: club } = await this.db.from('club_chat_settings').select('ai_allowed').eq('club_id', this.club.id).maybeSingle();
    if (!club?.ai_allowed) return null;
    const since = dayStartIso(SITE_TIME_ZONE, this.now);
    const count = async (filter: (q: any) => any) => (await filter(this.db.from('chat_messages').select('id', { count: 'exact', head: true }).gte('created_at', since))).count || 0;
    const [flash, gemma, clubUsed] = await Promise.all([
      count(q => q.eq('reader', 'flash-lite')),
      count(q => q.eq('reader', 'gemma')),
      count(q => q.eq('club_id', this.club.id).in('reader', ['flash-lite', 'gemma'])),
    ]);
    const readers = allowedReaders(this.settings, { flash, gemma, club: clubUsed });
    if (!readers.length) {
      this.log.result = 'AI limit reached';
      return null;
    }
    const r = await readWithAi(text, firstNames(await this.pool()), readers);
    this.log.aiError = r.error;
    if (r.reader) this.log.reader = r.reader;
    return r.command;
  }

  private async squad(): Promise<SquadPlayer[]> {
    if (this.squadCache) return this.squadCache;
    const team = teamOfMatch(this.match, this.teams);
    let ids: string[] | null = null;
    if (team) {
      const { data } = await this.db.from('club_team_members').select('member_id, team_role, is_active').eq('team_id', team.id);
      ids = (data || []).filter(r => r.is_active !== false && r.team_role === 'player').map(r => r.member_id);
    }
    let q = this.db.from('club_members').select('id, full_name, membership_status').eq('club_id', this.club.id);
    if (ids) q = q.in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
    const { data } = await q;
    this.squadCache = (data || []).filter(m => m.full_name && m.membership_status !== 'rejected' && m.membership_status !== 'pending').map(m => ({ id: m.id, name: m.full_name }));
    return this.squadCache;
  }

  /**
   * The tournament, its teams and their players: an internal team's roster (the whole club squad when it has none,
   * as Match Centre does) or the squad a guest club entered.
   */
  private async loadTournament() {
    const tid = this.match.tournament_id!;
    const [{ data: t }, { data: parts }, { data: squads }] = await Promise.all([
      this.db.from('tournaments').select('*').eq('id', tid).maybeSingle(),
      this.db.from('tournament_participants').select('*').eq('tournament_id', tid),
      this.db.from('tournament_squads').select('id, participant_id, name, is_junior').eq('tournament_id', tid),
    ]);
    if (!t) return;
    const internal = ((parts || []) as TournamentParticipant[]).filter(p => p.team_type === 'internal' && p.internal_team_id);
    const { data: rosters } = internal.length
      ? await this.db.from('internal_teams').select('id, player_ids').in('id', internal.map(p => p.internal_team_id!))
      : { data: [] as { id: string; player_ids: string[] }[] };
    const { data: members } = internal.length
      ? await this.db.from('club_members').select('id, full_name, membership_status').eq('club_id', this.club.id)
      : { data: [] as { id: string; full_name: string; membership_status?: string }[] };
    const approved = (members || []).filter(m => m.full_name && m.membership_status !== 'rejected' && m.membership_status !== 'pending');
    const players: Player[] = [];
    for (const p of (parts || []) as TournamentParticipant[]) {
      if (p.team_type === 'internal') {
        const roster = new Set((rosters || []).find(r => r.id === p.internal_team_id)?.player_ids || []);
        approved.filter(m => !roster.size || roster.has(m.id)).forEach(m => players.push({ id: `${p.id}:${m.id}`, name: m.full_name, team: p.name, memberId: m.id }));
      } else {
        (squads || []).filter(r => r.participant_id === p.id).forEach(r => players.push({ id: r.id, name: r.name, team: p.name, junior: !!r.is_junior }));
      }
    }
    this.tour = { t: t as Tournament, parts: (parts || []) as TournamentParticipant[], players };
  }

  /** Who the bot can name: our squad in a club game; in a tournament, a team's players (or both teams', or the whole tournament's) */
  private async pool(side?: Side | 'tournament'): Promise<Player[]> {
    if (!this.match.tournament_id) return (await this.squad()).map(p => ({ ...p, side: this.ourSide }));
    const all = this.tour?.players || [];
    if (side === 'tournament') return all;
    const sides = (side ? [side] : ['home', 'away'] as Side[]);
    return sides.flatMap(sd => all.filter(p => p.team === this.teamName(sd)).map(p => ({ ...p, side: sd })));
  }

  /** "M#14 Semi-final" in a tournament, "the match" otherwise */
  private gameLabel() {
    const m = this.match;
    if (!m.tournament_id) return 'the match';
    const stage = m.tournament_stage && m.tournament_stage !== 'group' && stageName(m.tournament_stage) ? ` ${stageName(m.tournament_stage)}` : '';
    return m.tournament_match_number ? `M#${m.tournament_match_number}${stage}` : stage.trim() || 'the match';
  }

  private async execute(c: ChatCommand): Promise<BotReply[]> {
    const m = this.match;
    switch (c.kind) {
      case 'help': return [{ text: SHORT_FORMAT_HELP }];
      case 'score': return [{ text: `${this.fullScore()}${m.status === 'live' ? `, ${getLiveMinute(m, this.now.getTime())}'` : m.status === 'halftime' ? ', half time' : ', not started'}.` }];
      case 'yes': case 'no': case 'pick': return [{ text: `Nothing to answer right now.\n${SHORT_FORMAT_HELP}` }];
      case 'kickoff':
        if (m.status !== 'upcoming') return [{ text: 'This game is already under way.' }];
        if (m.tournament_id && this.tour && isKnockout(m)) {
          const { data: own } = await this.db.from('matches').select('*').eq('tournament_id', this.tour.t.id);
          // Before migration 20261185 the row has no knockout_started_at, so only finished games are needed
          const lock = knockoutLockReason(m, this.tour.t, (own || []) as Match[], 'knockout_started_at' in this.tour.t);
          if (lock) return [{ text: lock }];
        }
        await this.updateMatch({ status: 'live', period: 'first_half', current_minute: periodStartMinute(m, 'first_half') });
        await this.alert('kickoff');
        return [{ text: `Kick-off logged for ${m.home_team_name} vs ${m.away_team_name}. Clock running. The scoreboard below is pinned and updates itself.` }, await this.boardReply()];
      case 'halftime':
        if (m.status !== 'live' || m.period !== 'first_half') return [{ text: m.status === 'upcoming' ? 'Kick-off first: send ko.' : 'Half time is only after the first half.' }];
        await this.updateMatch({ status: 'halftime', period: 'halftime', current_minute: halfMinutes(m) });
        return [{ text: `Half time, ${this.score()}.` }];
      case 'second_half':
        if (m.status !== 'halftime') return [{ text: 'The second half starts after half time (send ht first).' }];
        await this.updateMatch({ status: 'live', period: 'second_half', current_minute: periodStartMinute(m, 'second_half') });
        return [{ text: 'Second half under way. Clock running.' }];
      case 'fulltime': {
        if (m.status === 'upcoming') return [{ text: "This game hasn't kicked off yet." }];
        if (isKnockout(m) && m.home_score === m.away_score) return this.askPens();
        await this.setPending({ type: 'fulltime' });
        if (!m.tournament_id) return [{ text: `End the match at ${this.score()}? Followers get the full-time alert.`, buttons: ['Yes, end it', 'Not yet'] }];
        const result = m.home_score === m.away_score ? 'a draw' : `${this.teamName(m.home_score > m.away_score ? 'home' : 'away')} win`;
        const after = m.tournament_stage === 'final' ? `The winner takes the ${this.tour?.t.name || 'cup'}.` : m.tournament_stage === 'third_place' ? 'The winner finishes third.'
          : isKnockout(m) ? 'The winner goes through.' : `The ${m.tournament_group || 'league'} table updates.`;
        return [{ text: `End ${this.gameLabel()} at ${this.score()}, ${result}? ${after}`, buttons: ['Yes, end it', 'Not yet'] }];
      }
      case 'undo': return this.undo();
      case 'goal': case 'card': case 'sub': return this.logEvent(c);
    }
  }

  private async askPens(): Promise<BotReply[]> {
    await this.setPending({ type: 'pens' });
    return [{ text: `It's ${this.score()} and a knockout game needs a winner. Penalty score? Send it like 4-3, ${this.match.home_team_name} first.`, buttons: ['Not yet'] }];
  }

  private async updateMatch(patch: Partial<Match>) {
    const next = { ...patch, period_started_at: this.now.toISOString() };
    await this.db.from('matches').update(next).eq('id', this.match.id);
    Object.assign(this.match, next);
    this.changed = true;
  }

  /** The live scoreboard for this game, as it stands */
  private async boardReply(): Promise<BotReply> {
    const { data: events } = await this.db.from('match_events').select('minute, added_minute, event_type, player_name, assist_player_name, team_side').eq('match_id', this.match.id);
    return { text: boardText(this.match, events || [], clubTimeZone(this.club), this.now, matchTag(this.match, this.teams)), board: { matchId: this.match.id, linkId: this.link.id } };
  }

  private async alert(kind: 'kickoff' | 'goal' | 'fulltime', minute?: number, scorer?: string) {
    try {
      await sendMatchAlert(this.db, this.club.slug, this.match, this.teams, kind, this.match.home_score, this.match.away_score, minute, this.junior ? undefined : scorer);
    } catch (e) {
      console.error('[chat-bot] alert failed:', e);
    }
  }

  private async fullTime(pens?: [number, number]): Promise<BotReply[]> {
    const m = this.match;
    if (!['live', 'halftime'].includes(m.status)) return [{ text: 'This game is not live.' }];
    // A level knockout game can't end without its shoot-out
    if (isKnockout(m) && m.home_score === m.away_score && !pens) return this.askPens();
    const shootout = isKnockout(m) && m.home_score === m.away_score && pens ? pens : undefined;
    const final = m.period === 'extra_time' || m.period === 'penalties' ? undefined : fullMinutes(m);
    await this.updateMatch({
      status: 'completed', period: shootout ? 'penalties' : 'full_time', ...(final ? { current_minute: final } : {}),
      ...(shootout ? { home_penalty_score: shootout[0], away_penalty_score: shootout[1] } : {}),
    });
    await this.alert('fulltime');
    const result = `${this.fullScore()}${shootout ? ` (${shootout[0]}-${shootout[1]} pens)` : ''}`;
    this.log.result = `Full time ${this.score()}${shootout ? ` (${shootout[0]}-${shootout[1]} pens)` : ''}`;
    if (!this.tour) return [{ text: `Full time: ${result}. Thanks for scoring! Send potm and a name for Player of the Match.` }];
    const next = await this.advanceTournament();
    return [{ text: `Full time: ${result}. ${next} Send potm and a name for Player of the Match${this.tour.t.status === 'completed' ? ', or pott for Player of the Tournament' : ', or games for your next game'}.` }];
  }

  /**
   * After a tournament result: the same resolveTournament the tournament screen runs, here on the server, so the table
   * fills the knockout slots and winners move on without anyone opening the admin. Saves only what changed.
   */
  private async advanceTournament(): Promise<string> {
    const { t, parts } = this.tour!;
    const m = this.match;
    const { data: rows } = await this.db.from('matches').select('*').eq('tournament_id', t.id);
    const own = ((rows || []) as Match[]).map(x => (x.id === m.id ? { ...x, ...m } : x));
    const { data: cards } = await this.db.from('match_events').select('*').in('match_id', own.map(x => x.id)).in('event_type', ['yellow_card', 'red_card']);
    const resolved = resolveTournament(own, t, parts, (cards || []) as MatchEvent[]);
    const KEYS = ['home_team_name', 'home_team_logo', 'away_team_name', 'away_team_logo', 'winner_side'] as const;
    for (const after of resolved) {
      const before = own.find(x => x.id === after.id)!;
      const patch = Object.fromEntries(KEYS.filter(k => (before[k] ?? null) !== (after[k] ?? null)).map(k => [k, after[k] ?? null]));
      if (Object.keys(patch).length) await this.db.from('matches').update(patch).eq('id', after.id).eq('tournament_id', t.id);
    }
    const status = resolved.every(x => x.status === 'completed') ? 'completed' : 'ongoing';
    if (t.status !== status) {
      await this.db.from('tournaments').update({ status }).eq('id', t.id);
      t.status = status;
    }

    const done = resolved.find(x => x.id === m.id)!;
    const winner = done.winner_side ? this.teamName(done.winner_side as Side) : '';
    if (m.tournament_stage === 'final' && winner) return `${winner} win the ${t.name}!${status === 'completed' ? ' The tournament is finished.' : ''}`;
    if (isKnockout(m)) {
      const next = done.next_match_id ? resolved.find(x => x.id === done.next_match_id) : undefined;
      if (!winner || !next) return '';
      const stage = stageName(next.tournament_stage) ? ` ${stageName(next.tournament_stage)}` : '';
      const when = [next.match_time ? gameWhen({ match: next, day: next.match_date.slice(0, 10), today: next.match_date.slice(0, 10) }).replace(/^today /, '') : '', next.pitch_label].filter(Boolean).join(', ');
      return `${winner} go through to M#${next.tournament_match_number}${stage}${when ? `, ${when}` : ''}.`;
    }
    return `${m.tournament_group || 'League'} table updated.`;
  }

  /**
   * The reply to "Assist?", "Who's going off?", "Who's Player of the Match / Tournament?": a name (or a tap when two
   * match), or No. Null when the message is something else (say "g jack"), which is then handled as usual.
   */
  private async answerName(p: Extract<Pending, { type: 'assist' | 'sub_off' | 'potm' | 'pott' }>, text: string, command: ChatCommand | null): Promise<BotReply[] | null> {
    const assist = p.type === 'assist';
    const award = p.type === 'potm' ? 'Player of the Match' : p.type === 'pott' ? 'Player of the Tournament' : '';
    if (command?.kind === 'no') {
      this.log.result = assist ? 'No assist' : award ? `No ${award}` : 'Sub cancelled';
      return [{ text: assist ? 'OK, no assist.' : award ? `OK, no ${award} saved.` : 'OK, sub cancelled. Nothing saved.' }];
    }
    const words = tidy(text).split(' ');
    const picked = command?.kind === 'pick' ? p.options?.[command.n - 1] : p.options?.find(o => tidy(o) === tidy(text));
    const nameLike = !command && /^[\p{L}'’ -]{2,40}$/u.test(text.trim()) && words.length <= 3 && !words.some(w => NOT_A_NAME.has(w));
    if (!picked && !nameLike) return null;
    const other = p.type === 'assist' ? p.scorer : p.type === 'sub_off' ? p.on : undefined;
    const pool = await this.pool(p.type === 'pott' ? 'tournament' : p.type === 'assist' || p.type === 'sub_off' ? p.side : undefined);
    const hits = picked ? pool.filter(x => this.label(x) === picked) : findPlayers(text, pool).filter(x => x.name !== other);
    const again = assist ? 'No assist' : 'Cancel';
    // After a goal, a longer message that names no one ("what a strike") just skips the assist
    if (!hits.length && !picked && assist && words.length > 1) return null;
    if (!hits.length) {
      await this.setPending(p);
      const where = p.type === 'pott' ? 'this tournament'
        : !this.match.tournament_id ? "this game's squad" : (p.type === 'assist' || p.type === 'sub_off') && p.side ? this.teamName(p.side) : 'either team';
      return [{ text: `No one called "${text.trim()}" in ${where}. Send the name again, or tap ${again}.`, buttons: [again] }];
    }
    if (hits.length > 1) {
      const options = hits.slice(0, 4).map(x => this.label(x));
      await this.setPending({ ...p, options });
      return [{ text: `${hits.length === 2 ? 'Two' : 'More than one'} players called "${titleCase(text.trim())}"${p.type === 'pott' ? ' in this tournament' : ''}. Which one?`, buttons: options }];
    }
    const hit = hits[0];
    if (p.type === 'potm') return this.savePotm(hit);
    if (p.type === 'pott') return this.savePott(hit);
    if (assist) {
      const { data } = await this.db.from('match_events').update({ assist_player_name: hit.name }).eq('id', p.eventId).eq('match_id', this.match.id).select('id');
      this.changed = true;
      this.log.result = `Assist: ${hit.name}`;
      return [{ text: data?.length ? `Assist: ${hit.name}.` : "That goal isn't there any more." }];
    }
    return this.saveSub(p.on, hit.name, p.minute, p.added, p.side);
  }

  /** A junior's name as the public pages show it ("Ruby S.") */
  private publicName(p: Player) { return this.junior || p.junior ? juniorPublicName(p.name) : p.name; }

  /**
   * Player of the Match as a commentary line (it replaces an earlier pick). In a club game Match Centre picks it up
   * when the player stats are saved, which is what awards the points, so it's never counted twice.
   */
  private async savePotm(p: Player): Promise<BotReply[]> {
    const m = this.match;
    const name = this.publicName(p);
    const side = p.side || this.ourSide;
    const { data: notes } = await this.db.from('match_events').select('id, detail_text').eq('match_id', m.id).eq('event_type', 'commentary');
    const old = (notes || []).filter(n => (n.detail_text || '').startsWith(POTM_NOTE)).map(n => n.id);
    if (old.length) await this.db.from('match_events').delete().in('id', old);
    const at = m.status === 'completed'
      ? { minute: m.current_minute || fullMinutes(m), added: 0 }
      : splitMinute(m, m.period, getLiveMinute(m, this.now.getTime()));
    const id = crypto.randomUUID();
    const { error } = await this.db.from('match_events').insert({
      id, match_id: m.id, club_id: m.club_id, minute: at.minute, added_minute: at.added || 0, event_type: 'commentary', team_side: side,
      player_name: this.teamName(side), detail_text: `${POTM_NOTE}${name}`, logged_via: `chat:${this.member.full_name}`.slice(0, 80),
    });
    if (error) return [{ text: "Couldn't save that. Try again, or pick them in Match Centre." }];
    this.log.eventId = id;
    this.log.result = `Player of the Match: ${name}`;
    const live = m.status !== 'completed';
    const where = m.tournament_id ? `${name} (${p.team}). It's on the match page.` : `${name}. It goes on the match page when you save the player stats in Match Centre.`;
    return [{ text: `Player of the Match: ${where}${live ? '' : ' Send potm again to change it.'}`, ...(live ? { buttons: ['Undo'] } : {}) }];
  }

  /** Player of the Tournament, saved on the tournament as the tournament screen saves it */
  private async savePott(p: Player): Promise<BotReply[]> {
    const t = this.tour!.t;
    const name = p.memberId ? p.name : this.publicName(p);
    const { error } = await this.db.from('tournaments').update({ player_of_tournament_member_id: p.memberId || null, player_of_tournament_name: name }).eq('id', t.id);
    if (error) return [{ text: "Couldn't save that. Try again, or set it in the tournament screen." }];
    this.log.result = `Player of the Tournament: ${name}`;
    return [{ text: `Player of the Tournament: ${name} (${p.team}). It shows on the tournament page. Send pott again to change it.` }];
  }

  private async saveSub(on: string, off: string, minute: number, added: number, side: Side = this.ourSide): Promise<BotReply[]> {
    if (!['live', 'halftime'].includes(this.match.status)) return [{ text: 'This game is not live.' }];
    const { data, error } = await this.db.rpc('chat_log_event', {
      p_match_id: this.match.id, p_event_type: 'sub', p_team_side: side, p_player_name: on,
      p_minute: minute, p_added_minute: added, p_detail: subDetail(on, off), p_logged_via: `chat:${this.member.full_name}`.slice(0, 80),
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) return [{ text: "Couldn't save that. Check the game is still live and try again." }];
    this.log.eventId = row.event_id;
    const when = minuteLabel(minute, added);
    this.log.result = `Sub (${when}): ${on} on, ${off} off`;
    return [{ text: `Sub (${when}): ${on} on, ${off} off.`, buttons: ['Undo'] }];
  }

  /**
   * A goal, card or sub. In a club game "us"/"them" gives the side. In a tournament the name does: a player found in
   * one team, or a team's name ("g lions"); otherwise the bot asks which team. forced: the side (and name) settled already.
   */
  private async logEvent(c: Extract<ChatCommand, { kind: 'goal' | 'card' | 'sub' }>, answered = false, forced?: { side: Side; player: string; named: boolean }): Promise<BotReply[]> {
    const m = this.match;
    if (m.status === 'upcoming') return [{ text: 'Kick-off first: send ko.' }];
    if (!['live', 'halftime'].includes(m.status)) return [{ text: 'This game is not live.' }];

    let player: string;
    let side: Side;
    // Whether the event names a person (not just a team)
    let named: boolean;
    if (forced) {
      ({ player, side, named } = forced);
    } else if (m.tournament_id) {
      const pool = await this.pool();
      const team = c.player && !answered ? sideByName(c.player, this.teamInfo('home'), this.teamInfo('away')) : null;
      const hits = !c.player || team ? [] : answered ? pool.filter(p => this.label(p) === c.player) : findPlayers(c.player, pool);
      if (team) { side = team; player = this.teamName(team); named = false; }
      else if (hits.length === 1) { side = hits[0].side!; player = hits[0].name; named = true; }
      else if (hits.length > 1) {
        const options = hits.slice(0, 4).map(p => this.label(p));
        await this.setPending({ type: 'player', command: c, options });
        return [{ text: `${hits.length === 2 ? 'Two' : 'More than one'} players called "${titleCase(c.player!)}". Which one?`, buttons: options }];
      } else {
        await this.setPending({ type: 'team', command: c });
        const what = c.kind === 'card' ? 'got the card' : c.kind === 'sub' ? 'made the sub' : c.type === 'own_goal' ? 'put it in their own net' : 'scored';
        return [{ text: `${c.player ? `No one called "${c.player}" in either team. ` : ''}Which team ${what}?`, buttons: [m.home_team_name, m.away_team_name] }];
      }
    } else if (c.side === 'us' && c.player) {
      // Who: one of our squad, or their player's name as typed (or their team)
      const hits = answered ? (await this.squad()).filter(p => p.name === c.player) : findPlayers(c.player, await this.squad());
      if (!hits.length) return [{ text: `No one called "${c.player}" in this game's squad. Send the name as it is on the team list.` }];
      if (hits.length > 1) {
        const options = hits.slice(0, 4).map(p => p.name);
        await this.setPending({ type: 'player', command: c, options });
        return [{ text: `${hits.length > 4 ? 'More than four' : hits.length === 2 ? 'Two' : String(hits.length)} players called "${titleCase(c.player)}" in this squad. Which one?`, buttons: options }];
      }
      player = hits[0].name;
      side = this.ourSide;
      named = true;
    } else {
      side = c.side === 'us' ? this.ourSide : this.ourSide === 'home' ? 'away' : 'home';
      player = c.player ? titleCase(c.player) : this.teamName(side);
      named = !!c.player;
    }
    const tour = !!m.tournament_id;

    // When: the minute sent, else the live clock
    const at = c.minute ? { minute: c.minute, added: c.added || 0 } : (() => { const s = splitMinute(m, m.period, getLiveMinute(m, this.now.getTime())); return { minute: s.minute, added: s.added }; })();
    if (c.kind === 'sub') {
      await this.setPending({ type: 'sub_off', on: player, minute: at.minute, added: at.added, ...(tour ? { side } : {}) });
      return [{ text: `${player} coming on (${minuteLabel(at.minute, at.added)}). Who's going off?`, buttons: ['Cancel'] }];
    }
    const type = c.kind === 'goal' ? c.type : c.color === 'yellow' ? 'yellow_card' : 'red_card';
    const { data, error } = await this.db.rpc('chat_log_event', {
      p_match_id: m.id, p_event_type: type, p_team_side: side, p_player_name: player,
      p_minute: at.minute, p_added_minute: at.added, p_detail: '', p_logged_via: `chat:${this.member.full_name}`.slice(0, 80),
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) return [{ text: "Couldn't save that. Check the game is still live and try again." }];
    this.match.home_score = row.home_score;
    this.match.away_score = row.away_score;
    this.log.eventId = row.event_id;
    this.changed = true;

    const when = minuteLabel(at.minute, at.added);
    const forTeam = tour && named ? ` for ${this.teamName(side)}` : '';
    if (c.kind === 'card') {
      this.log.result = `${c.color === 'yellow' ? 'Yellow' : 'Red'} card ${player}${forTeam} (${when})`;
      return [{ text: `${c.color === 'yellow' ? 'Yellow' : 'Red'} card ${player}${forTeam} (${when}).`, buttons: ['Undo'] }];
    }
    const ours = tour ? named : c.side === 'us';
    await this.alert('goal', at.minute, ours && c.type !== 'own_goal' ? player : undefined);
    const label = c.type === 'own_goal' ? `Own goal${named || c.player ? ` ${player}` : ''}` : c.type === 'penalty' ? `Penalty goal ${player}` : `Goal ${player}`;
    this.log.result = `${label}${forTeam} (${when})`;
    // A goal with no scorer's name: offer to add it
    if ((tour ? !named : scoringSide(c) === 'them' && !c.player) && c.type !== 'own_goal') {
      await this.setPending({ type: 'their_scorer', eventId: row.event_id });
      return [{ text: `${label} (${when}). Now ${this.score()}. Know ${tour ? 'the' : 'their'} scorer? Just send the name.`, buttons: ['Undo'] }];
    }
    // A named player's goal from open play: ask for the assist (optional, any other message skips it)
    if (ours && c.type === 'goal') {
      await this.setPending({ type: 'assist', eventId: row.event_id, scorer: player, ...(tour ? { side } : {}) });
      return [{ text: `${label}${forTeam} (${when}). Now ${this.score()}. Assist? Send the name, or tap No assist.`, buttons: ['No assist', 'Undo'] }];
    }
    return [{ text: `${label}${forTeam} (${when}). Now ${this.score()}.`, buttons: ['Undo'] }];
  }

  private teamInfo(side: Side) {
    const name = this.teamName(side);
    return { name, short: this.tour?.parts.find(p => p.name === name)?.short_name };
  }

  private async undo(): Promise<BotReply[]> {
    const { data: last } = await this.db.from('chat_messages').select('id, event_id, result').eq('chat_id', this.chatId).eq('match_id', this.match.id)
      .not('event_id', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!last?.event_id) return [{ text: 'Nothing from this chat to undo. Fix anything else in Match Centre.' }];
    const { data, error } = await this.db.rpc('chat_undo_event', { p_event_id: last.event_id });
    await this.db.from('chat_messages').update({ event_id: null, result: `${last.result || ''} (undone)`.slice(0, 500) }).eq('id', last.id);
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) return [{ text: 'That was already removed in Match Centre.' }];
    this.changed = true;
    this.match.home_score = row.home_score;
    this.match.away_score = row.away_score;
    await this.setPending(null);
    this.log.result = `Undo: ${last.result || ''}`;
    return [{ text: `Removed: ${last.result || 'the last event'}. Now ${this.score()}.` }];
  }
}
