// The live scoreboard in a scorer's chat (server only): one message the bot posts at kick-off, pins, and
// rewrites after every change, whether it came by chat or from Match Centre. No ticking clock: Telegram
// would need an edit a minute for every live game, so the board says when it was last updated instead.
// chat_links.board = { match_id, message_id } (migration 20261184_chat_board.sql).
import type { SupabaseClient } from '@supabase/supabase-js';
import { editTelegram } from './telegram';
import { clubTimeZone } from './dates';
import { compareEventMinute, eventMinuteLabel } from './match-length';
import type { Match, MatchEvent } from './supabase/types';

const PERIODS: Record<string, string> = { first_half: '1st half', second_half: '2nd half', extra_time: 'extra time', penalties: 'penalties' };

/** The board's text: state, score, goals and cards in order, and when it was last updated */
export function boardText(m: Match, events: Pick<MatchEvent, 'minute' | 'added_minute' | 'event_type' | 'player_name' | 'assist_player_name' | 'team_side'>[], zone: string, now: Date): string {
  const state = m.status === 'completed' ? '🏁 FULL TIME'
    : m.status === 'halftime' ? '⏸ HALF TIME'
    : m.status === 'live' ? `🟢 LIVE${PERIODS[m.period || ''] ? ` · ${PERIODS[m.period || '']}` : ''}`
    : '⏱ NOT STARTED';
  const where = m.tournament_id ? [m.tournament_match_number ? `M#${m.tournament_match_number}` : '', m.tournament_group || ''].filter(Boolean).join(' · ') : '';
  const pens = m.home_penalty_score != null && m.away_penalty_score != null ? `\n(${m.home_penalty_score}-${m.away_penalty_score} on penalties)` : '';
  const lines = events
    .filter(e => ['goal', 'penalty', 'own_goal', 'yellow_card', 'red_card'].includes(e.event_type))
    .sort(compareEventMinute)
    .map(e => {
      const who = e.player_name || '';
      const what = e.event_type === 'yellow_card' ? `🟨 ${who}` : e.event_type === 'red_card' ? `🟥 ${who}`
        : e.event_type === 'own_goal' ? `⚽ Own goal ${who}` : `⚽ ${who}${e.event_type === 'penalty' ? ' (pen)' : ''}${e.assist_player_name ? ` (assist ${e.assist_player_name})` : ''}`;
      return `${eventMinuteLabel(e)}' ${what}`;
    });
  const time = new Intl.DateTimeFormat('en-AU', { timeZone: zone, hour: 'numeric', minute: '2-digit' }).format(now).replace(/\s/g, '').toLowerCase();
  return [
    `${state}${where ? `   ${where}` : ''}`,
    '',
    `${m.home_team_name}  ${m.home_score ?? 0}`,
    `${m.away_team_name}  ${m.away_score ?? 0}${pens}`,
    ...(lines.length ? ['', ...lines] : []),
    '',
    `Updated ${time}`,
  ].join('\n');
}

type Edit = (chatId: string, messageId: number, text: string) => Promise<'ok' | 'gone' | 'failed'>;

/** Rewrites every chat's board for this match. Returns how many were edited. */
export async function refreshBoards(db: SupabaseClient, matchId: string, now = new Date(), edit: Edit = editTelegram): Promise<number> {
  const { data: links, error } = await db.from('chat_links').select('id, chat_id, board').eq('board->>match_id', matchId);
  if (error || !links?.length) return 0;
  const [{ data: match }, { data: events }] = await Promise.all([
    db.from('matches').select('*').eq('id', matchId).maybeSingle(),
    db.from('match_events').select('minute, added_minute, event_type, player_name, assist_player_name, team_side').eq('match_id', matchId),
  ]);
  if (!match) return 0;
  const { data: club } = await db.from('clubs').select('config').eq('id', match.club_id).maybeSingle();
  const text = boardText(match as Match, events || [], clubTimeZone(club || {}), now);
  let edited = 0;
  for (const l of links) {
    const id = Number(l.board?.message_id);
    if (!Number.isInteger(id)) continue;
    const r = await edit(l.chat_id, id, text);
    if (r === 'ok') edited++;
    // Deleted in the chat: stop trying
    if (r === 'gone') await db.from('chat_links').update({ board: null }).eq('id', l.id);
  }
  return edited;
}

/** Remembers the board just posted in a chat, so later changes rewrite it */
export async function rememberBoard(db: SupabaseClient, linkId: string, matchId: string, messageId: number) {
  await db.from('chat_links').update({ board: { match_id: matchId, message_id: messageId } }).eq('id', linkId);
}
