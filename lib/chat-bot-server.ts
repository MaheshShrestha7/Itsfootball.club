// Score by chat: what Itsfootball.club Bot does with one message (server only, service role).
// The channel (Telegram today) only passes the text in and sends the replies out.
//
// Rules: only a chat linked to a member who may edit Match Centre, at a club that turned score by chat
// on, and only today's club games that aren't finished. Goals and cards save at once with an Undo;
// full time waits for a yes. The AI reads only what the short format can't, never for a junior team,
// and only within Mission Control's switches and daily limits.
import type { SupabaseClient } from '@supabase/supabase-js';
import { findPlayers, firstNames, parseShort, scoringSide, SHORT_FORMAT_HELP, tidy, type ChatCommand, type SquadPlayer } from './chat-score';
import { aiConfigured, readWithAi, type AiReader } from './chat-ai';
import { sendMatchAlert } from './match-push-server';
import { getLiveMinute } from './live-minute';
import { fullMinutes, halfMinutes, periodStartMinute, splitMinute } from './match-length';
import { clubTimeZone, SITE_TIME_ZONE } from './dates';
import { durableRateLimit } from './rate-limit';
import { subDetail } from './match-subs';
import { isJuniorFixture, isTeamFixture, teamOfMatch } from './teams';
import type { Club, ClubMember, ClubTeam, Match } from './supabase/types';

export interface BotReply { text: string; buttons?: string[] }
type Pending =
  | { type: 'game'; ids: string[]; text: string }
  | { type: 'player'; command: ChatCommand; options: string[] }
  | { type: 'fulltime' }
  | { type: 'their_scorer'; eventId: string }
  // Optional assist after our goal; who went off after "in ram". options: the names asked about when two match.
  | { type: 'assist'; eventId: string; scorer: string; options?: string[] }
  | { type: 'sub_off'; on: string; minute: number; added: number; options?: string[] };
interface Link { id: string; club_id: string; member_id: string; chat_id: string; active_match_id: string | null; pending: Pending | null }
interface Settings { ai_enabled: boolean; daily_limit: number; club_daily_limit: number; per_minute: number }
const DEFAULT_SETTINGS: Settings = { ai_enabled: true, daily_limit: 400, club_daily_limit: 50, per_minute: 30 };

// Words that mean the message is about the game, not a name for their scorer
const NOT_A_NAME = new Set(['they', 'them', 'we', 'us', 'our', 'scored', 'score', 'goal', 'again', 'yellow', 'red', 'card', 'half', 'time', 'full', 'kick', 'off', 'penalty', 'pen', 'own', 'no', 'yes', 'undo', 'help']);
const NOT_LINKED = "This chat isn't set up to update scores. Ask your club admin for a Link chat link.";
const OPEN = ['upcoming', 'live', 'halftime'];

/** The day (YYYY-MM-DD) in a time zone */
export const dayIn = (zone: string, now: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

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

const titleCase = (s: string) => s.replace(/\b\p{L}/gu, c => c.toUpperCase());
const minuteLabel = (m: number, added?: number) => (added ? `${m}+${added}'` : `${m}'`);

export async function handleChatMessage(db: SupabaseClient, chatId: string, rawText: string, now = new Date()): Promise<BotReply[]> {
  const text = rawText.trim().slice(0, 300);
  if (!text) return [];

  // Linking: /start <code> from the member's one-time link
  const start = /^\/start(?:\s+([A-Za-z0-9_-]{8,64}))?$/.exec(text);
  if (start) return start[1] ? [await linkChat(db, chatId, start[1], now)] : [{ text: NOT_LINKED }];

  const { data: links, error } = await db.from('chat_links').select('id, club_id, member_id, chat_id, active_match_id, pending').eq('channel', 'telegram').eq('chat_id', chatId);
  if (error) return [{ text: "Score by chat isn't ready yet. Please try again later." }];
  if (!links?.length) return [{ text: NOT_LINKED }];

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
  const first = member?.first_name || (member?.full_name || '').split(' ')[0] || 'there';
  return { text: `Hi ${first}! This chat is linked to ${club?.name || 'your club'}. When a game is on, send things like "g sam 23" or "they scored".\n${SHORT_FORMAT_HELP}` };
}

class Bot {
  private link!: Link;
  private match!: Match;
  private club!: Pick<Club, 'id' | 'name' | 'slug' | 'config'>;
  private teams: ClubTeam[] = [];
  private member!: Pick<ClubMember, 'id' | 'full_name'>;
  private squadCache: SquadPlayer[] | null = null;
  private log: { reader: AiReader | 'short' | 'none'; result: string; eventId?: string; aiError?: boolean } = { reader: 'short', result: '' };

  constructor(private db: SupabaseClient, private chatId: string, private links: Link[], private settings: Settings, private now: Date) {}

  async handle(text: string): Promise<BotReply[]> {
    const pick = await this.pickGame(text);
    if ('reply' in pick) return [pick.reply];
    if (pick.rerun !== undefined) text = pick.rerun;
    const replies = await this.run(text);
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

  private async pickGame(text: string): Promise<{ reply: BotReply } | { rerun?: string }> {
    const clubIds = [...new Set(this.links.map(l => l.club_id))];
    const [{ data: clubs }, { data: teams }, { data: memberTeams }, { data: members }] = await Promise.all([
      this.db.from('clubs').select('id, name, slug, config').in('id', clubIds),
      this.db.from('club_teams').select('*').in('club_id', clubIds),
      this.db.from('club_team_members').select('team_id, member_id, is_active').in('member_id', this.links.map(l => l.member_id)),
      this.db.from('club_members').select('id, full_name').in('id', this.links.map(l => l.member_id)),
    ]);
    // Today's games at each club, in that club's own time zone
    const games: { link: Link; match: Match }[] = [];
    const skipped: string[] = [];
    for (const l of this.links) {
      const club = (clubs || []).find(c => c.id === l.club_id);
      if (!club) continue;
      // Today's games, plus any game that is live now whatever its date (an evening kick-off past midnight)
      const zone = clubTimeZone(club);
      const today = dayIn(zone, this.now);
      const [{ data: todays }, { data: live }] = await Promise.all([
        this.db.from('matches').select('*').eq('club_id', l.club_id).eq('match_date', today),
        this.db.from('matches').select('*').eq('club_id', l.club_id).in('status', ['live', 'halftime']),
      ]);
      const rows = [...(todays || []), ...(live || []).filter(m => m.match_date !== today)] as Match[];
      // Why a game the scorer can see isn't offered, so "No game" is never a mystery
      const why = (m: Match) => !OPEN.includes(m.status) ? `it is ${m.status}` : m.tournament_id ? "it's a tournament game (not covered yet)" : !isTeamFixture(m) ? "it's an in-house game (not covered yet)" : '';
      rows.forEach(m => { const w = why(m); if (w) skipped.push(`${m.home_team_name} vs ${m.away_team_name}: ${w}`); });
      let mine = rows.filter(m => !why(m));
      // A member who belongs to teams sees their own teams' games first
      const myTeams = new Set((memberTeams || []).filter(r => r.member_id === l.member_id && r.is_active !== false).map(r => r.team_id));
      const clubTeams = ((teams || []) as ClubTeam[]).filter(t => t.club_id === l.club_id);
      const ownGames = mine.filter(m => { const t = teamOfMatch(m, clubTeams); return t && myTeams.has(t.id); });
      if (ownGames.length) mine = ownGames;
      mine.forEach(match => games.push({ link: l, match }));
    }
    games.sort((a, b) => (a.match.match_time || '').localeCompare(b.match.match_time || ''));

    const choose = (g: { link: Link; match: Match }) => {
      this.link = g.link;
      this.match = g.match;
      this.club = (clubs || []).find(c => c.id === g.link.club_id)!;
      this.teams = ((teams || []) as ClubTeam[]).filter(t => t.club_id === g.link.club_id);
      this.member = (members || []).find(m => m.id === g.link.member_id) || { id: g.link.member_id, full_name: 'a scorer' };
    };

    if (!games.length) {
      const seen = skipped.length ? `\nToday's games I can't score:\n${skipped.slice(0, 4).join('\n')}` : "\nThere's no game dated today in your club's time zone.";
      return { reply: { text: `No game for you to score today. Games show here on match day until full time.${seen}\n${SHORT_FORMAT_HELP}` } };
    }

    // An answer to "Which game?"
    const asked = this.links.find(l => l.pending?.type === 'game');
    const answer = parseShort(text);
    if (asked && asked.pending?.type === 'game' && answer?.kind === 'pick') {
      const { ids, text: waiting } = asked.pending;
      const id = ids[answer.n - 1];
      const g = games.find(x => x.match.id === id);
      if (g) {
        await this.db.from('chat_links').update({ active_match_id: null, pending: null }).in('id', this.links.map(l => l.id));
        await this.db.from('chat_links').update({ active_match_id: id, pending: null }).eq('id', g.link.id);
        g.link.active_match_id = id;
        g.link.pending = null;
        choose(g);
        return { rerun: waiting };
      }
    }

    const active = games.find(g => g.link.active_match_id === g.match.id);
    if (active) { choose(active); return {}; }
    if (games.length === 1) {
      await this.db.from('chat_links').update({ active_match_id: games[0].match.id, pending: null }).eq('id', games[0].link.id);
      games[0].link.pending = null;
      choose(games[0]);
      return {};
    }
    const list = games.slice(0, 4);
    await this.db.from('chat_links').update({ pending: { type: 'game', ids: list.map(g => g.match.id), text } }).eq('id', list[0].link.id);
    return {
      reply: {
        text: `Which game?\n${list.map((g, i) => `${i + 1} ${g.match.home_team_name} vs ${g.match.away_team_name}${g.match.match_time ? `, ${g.match.match_time.slice(0, 5)}` : ''}`).join('\n')}`,
        buttons: list.map((_, i) => String(i + 1)),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // The message
  // ---------------------------------------------------------------------------

  private get ourSide(): 'home' | 'away' { return this.match.is_club_home === false ? 'away' : 'home'; }
  private get junior() { return isJuniorFixture(this.match, this.teams); }
  private score(home = this.match.home_score, away = this.match.away_score) {
    const [us, them] = this.ourSide === 'home' ? [home, away] : [away, home];
    return `${us}-${them}`;
  }
  private fullScore() { return `${this.match.home_team_name} ${this.match.home_score}-${this.match.away_score} ${this.match.away_team_name}`; }

  private async setPending(p: Pending | null) {
    this.link.pending = p;
    await this.db.from('chat_links').update({ pending: p }).eq('id', this.link.id);
  }

  private async run(text: string): Promise<BotReply[]> {
    const pending = this.link.pending;
    let command = parseShort(text);

    if (pending?.type === 'fulltime') {
      await this.setPending(null);
      if (command?.kind === 'yes') return this.fullTime();
      if (command?.kind === 'no') return [{ text: 'OK, still playing.' }];
    }
    if (pending?.type === 'player') {
      await this.setPending(null);
      const chosen = command?.kind === 'pick' ? pending.options[command.n - 1] : pending.options.find(o => tidy(o) === tidy(text));
      if (chosen && (pending.command.kind === 'goal' || pending.command.kind === 'card' || pending.command.kind === 'sub')) return this.logEvent({ ...pending.command, player: chosen }, true);
    }
    if (pending?.type === 'their_scorer') {
      await this.setPending(null);
      const words = tidy(text).split(' ');
      if (!command && /^[\p{L}'’ -]{2,40}$/u.test(text.trim()) && words.length <= 3 && !words.some(w => NOT_A_NAME.has(w))) {
        const name = titleCase(text.trim());
        const { data } = await this.db.from('match_events').update({ player_name: name }).eq('id', pending.eventId).eq('match_id', this.match.id).select('id');
        this.log.result = `Their scorer: ${name}`;
        return [{ text: data?.length ? `Added their scorer: ${name}.` : "That goal isn't there any more." }];
      }
    }

    if (pending?.type === 'assist' || pending?.type === 'sub_off') {
      await this.setPending(null);
      const answer = await this.answerName(pending, text, command);
      if (answer) return answer;
    }

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
    const r = await readWithAi(text, firstNames(await this.squad()), readers);
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

  private async execute(c: ChatCommand): Promise<BotReply[]> {
    const m = this.match;
    switch (c.kind) {
      case 'help': return [{ text: SHORT_FORMAT_HELP }];
      case 'score': return [{ text: `${this.fullScore()}${m.status === 'live' ? `, ${getLiveMinute(m, this.now.getTime())}'` : m.status === 'halftime' ? ', half time' : ', not started'}.` }];
      case 'yes': case 'no': case 'pick': return [{ text: `Nothing to answer right now.\n${SHORT_FORMAT_HELP}` }];
      case 'kickoff':
        if (m.status !== 'upcoming') return [{ text: 'This game is already under way.' }];
        await this.updateMatch({ status: 'live', period: 'first_half', current_minute: periodStartMinute(m, 'first_half') });
        await this.alert('kickoff');
        return [{ text: `Kick-off logged for ${m.home_team_name} vs ${m.away_team_name}. Clock running.` }];
      case 'halftime':
        if (m.status !== 'live' || m.period !== 'first_half') return [{ text: m.status === 'upcoming' ? 'Kick-off first: send ko.' : 'Half time is only after the first half.' }];
        await this.updateMatch({ status: 'halftime', period: 'halftime', current_minute: halfMinutes(m) });
        return [{ text: `Half time, ${this.score()}.` }];
      case 'second_half':
        if (m.status !== 'halftime') return [{ text: 'The second half starts after half time (send ht first).' }];
        await this.updateMatch({ status: 'live', period: 'second_half', current_minute: periodStartMinute(m, 'second_half') });
        return [{ text: 'Second half under way. Clock running.' }];
      case 'fulltime':
        if (m.status === 'upcoming') return [{ text: "This game hasn't kicked off yet." }];
        await this.setPending({ type: 'fulltime' });
        return [{ text: `End the match at ${this.score()}? Followers get the full-time alert.`, buttons: ['Yes, end it', 'Not yet'] }];
      case 'undo': return this.undo();
      case 'goal': case 'card': case 'sub': return this.logEvent(c);
    }
  }

  private async updateMatch(patch: Partial<Match>) {
    const next = { ...patch, period_started_at: this.now.toISOString() };
    await this.db.from('matches').update(next).eq('id', this.match.id);
    Object.assign(this.match, next);
  }

  private async alert(kind: 'kickoff' | 'goal' | 'fulltime', minute?: number, scorer?: string) {
    try {
      await sendMatchAlert(this.db, this.club.slug, this.match, this.teams, kind, this.match.home_score, this.match.away_score, minute, scorer);
    } catch (e) {
      console.error('[chat-bot] alert failed:', e);
    }
  }

  private async fullTime(): Promise<BotReply[]> {
    const m = this.match;
    if (!['live', 'halftime'].includes(m.status)) return [{ text: 'This game is not live.' }];
    const final = m.period === 'extra_time' || m.period === 'penalties' ? undefined : fullMinutes(m);
    await this.updateMatch({ status: 'completed', period: 'full_time', ...(final ? { current_minute: final } : {}) });
    await this.db.from('chat_links').update({ active_match_id: null, pending: null }).eq('id', this.link.id);
    await this.alert('fulltime');
    this.log.result = `Full time ${this.score()}`;
    return [{ text: `Full time: ${this.fullScore()}. Thanks for scoring!` }];
  }

  /**
   * The reply to "Assist?" or "Who's going off?": a name from the squad (or a tap when two match), or No.
   * Null when the message is something else (say "g jack"), which is then handled as usual.
   */
  private async answerName(p: Extract<Pending, { type: 'assist' | 'sub_off' }>, text: string, command: ChatCommand | null): Promise<BotReply[] | null> {
    const assist = p.type === 'assist';
    if (command?.kind === 'no') {
      this.log.result = assist ? 'No assist' : 'Sub cancelled';
      return [{ text: assist ? 'OK, no assist.' : 'OK, sub cancelled. Nothing saved.' }];
    }
    const words = tidy(text).split(' ');
    const picked = command?.kind === 'pick' ? p.options?.[command.n - 1] : p.options?.find(o => tidy(o) === tidy(text));
    const nameLike = !command && /^[\p{L}'’ -]{2,40}$/u.test(text.trim()) && words.length <= 3 && !words.some(w => NOT_A_NAME.has(w));
    if (!picked && !nameLike) return null;
    const other = assist ? p.scorer : p.on;
    const hits = picked ? [{ id: '', name: picked }] : findPlayers(text, await this.squad()).filter(x => x.name !== other);
    const again = assist ? 'No assist' : 'Cancel';
    // After a goal, a longer message that names no one ("what a strike") just skips the assist
    if (!hits.length && !picked && assist && words.length > 1) return null;
    if (!hits.length) {
      await this.setPending(p);
      return [{ text: `No one called "${text.trim()}" in this game's squad. Send the name again, or tap ${again}.`, buttons: [again] }];
    }
    if (hits.length > 1) {
      const options = hits.slice(0, 4).map(x => x.name);
      await this.setPending({ ...p, options });
      return [{ text: `${hits.length === 2 ? 'Two' : 'More than one'} players called "${titleCase(text.trim())}". Which one?`, buttons: options }];
    }
    const name = hits[0].name;
    if (assist) {
      const { data } = await this.db.from('match_events').update({ assist_player_name: name }).eq('id', p.eventId).eq('match_id', this.match.id).select('id');
      this.log.result = `Assist: ${name}`;
      return [{ text: data?.length ? `Assist: ${name}.` : "That goal isn't there any more." }];
    }
    return this.saveSub(p.on, name, p.minute, p.added);
  }

  private async saveSub(on: string, off: string, minute: number, added: number): Promise<BotReply[]> {
    if (!['live', 'halftime'].includes(this.match.status)) return [{ text: 'This game is not live.' }];
    const { data, error } = await this.db.rpc('chat_log_event', {
      p_match_id: this.match.id, p_event_type: 'sub', p_team_side: this.ourSide, p_player_name: on,
      p_minute: minute, p_added_minute: added, p_detail: subDetail(on, off), p_logged_via: `chat:${this.member.full_name}`.slice(0, 80),
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) return [{ text: "Couldn't save that. Check the game is still live and try again." }];
    this.log.eventId = row.event_id;
    const when = minuteLabel(minute, added);
    this.log.result = `Sub (${when}): ${on} on, ${off} off`;
    return [{ text: `Sub (${when}): ${on} on, ${off} off.`, buttons: ['Undo'] }];
  }

  private async logEvent(c: Extract<ChatCommand, { kind: 'goal' | 'card' | 'sub' }>, answered = false): Promise<BotReply[]> {
    const m = this.match;
    if (m.status === 'upcoming') return [{ text: 'Kick-off first: send ko.' }];
    if (!['live', 'halftime'].includes(m.status)) return [{ text: 'This game is not live.' }];

    // Who: one of our squad, or their player's name as typed (or their team)
    let player: string;
    if (c.side === 'us' && c.player) {
      const hits = answered ? (await this.squad()).filter(p => p.name === c.player) : findPlayers(c.player, await this.squad());
      if (!hits.length) return [{ text: `No one called "${c.player}" in this game's squad. Send the name as it is on the team list.` }];
      if (hits.length > 1) {
        const options = hits.slice(0, 4).map(p => p.name);
        await this.setPending({ type: 'player', command: c, options });
        return [{ text: `${hits.length > 4 ? 'More than four' : hits.length === 2 ? 'Two' : String(hits.length)} players called "${titleCase(c.player)}" in this squad. Which one?`, buttons: options }];
      }
      player = hits[0].name;
    } else {
      player = c.player ? titleCase(c.player) : (this.ourSide === 'home' ? (c.side === 'us' ? m.home_team_name : m.away_team_name) : (c.side === 'us' ? m.away_team_name : m.home_team_name));
    }

    // When: the minute sent, else the live clock
    const at = c.minute ? { minute: c.minute, added: c.added || 0 } : (() => { const s = splitMinute(m, m.period, getLiveMinute(m, this.now.getTime())); return { minute: s.minute, added: s.added }; })();
    if (c.kind === 'sub') {
      await this.setPending({ type: 'sub_off', on: player, minute: at.minute, added: at.added });
      return [{ text: `${player} coming on (${minuteLabel(at.minute, at.added)}). Who's going off?`, buttons: ['Cancel'] }];
    }
    const side = c.side === 'us' ? this.ourSide : this.ourSide === 'home' ? 'away' : 'home';
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

    const when = minuteLabel(at.minute, at.added);
    if (c.kind === 'card') {
      this.log.result = `${c.color === 'yellow' ? 'Yellow' : 'Red'} card ${player} (${when})`;
      return [{ text: `${c.color === 'yellow' ? 'Yellow' : 'Red'} card ${player} (${when}).`, buttons: ['Undo'] }];
    }
    await this.alert('goal', at.minute, c.side === 'us' && c.type !== 'own_goal' ? player : undefined);
    const label = c.type === 'own_goal' ? `Own goal${c.player ? ` ${player}` : ''}` : c.type === 'penalty' ? `Penalty goal ${player}` : `Goal ${player}`;
    this.log.result = `${label} (${when})`;
    if (scoringSide(c) === 'them' && c.type !== 'own_goal' && !c.player) {
      await this.setPending({ type: 'their_scorer', eventId: row.event_id });
      return [{ text: `${label} (${when}). Now ${this.score()}. Know their scorer? Just send the name.`, buttons: ['Undo'] }];
    }
    // Our own goal from open play: ask for the assist (optional, any other message skips it)
    if (c.side === 'us' && c.type === 'goal') {
      await this.setPending({ type: 'assist', eventId: row.event_id, scorer: player });
      return [{ text: `${label} (${when}). Now ${this.score()}. Assist? Send the name, or tap No assist.`, buttons: ['No assist', 'Undo'] }];
    }
    return [{ text: `${label} (${when}). Now ${this.score()}.`, buttons: ['Undo'] }];
  }

  private async undo(): Promise<BotReply[]> {
    const { data: last } = await this.db.from('chat_messages').select('id, event_id, result').eq('chat_id', this.chatId).eq('match_id', this.match.id)
      .not('event_id', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!last?.event_id) return [{ text: 'Nothing from this chat to undo. Fix anything else in Match Centre.' }];
    const { data, error } = await this.db.rpc('chat_undo_event', { p_event_id: last.event_id });
    await this.db.from('chat_messages').update({ event_id: null, result: `${last.result || ''} (undone)`.slice(0, 500) }).eq('id', last.id);
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) return [{ text: 'That was already removed in Match Centre.' }];
    this.match.home_score = row.home_score;
    this.match.away_score = row.away_score;
    await this.setPending(null);
    this.log.result = `Undo: ${last.result || ''}`;
    return [{ text: `Removed: ${last.result || 'the last event'}. Now ${this.score()}.` }];
  }
}
