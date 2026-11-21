// One scoring link per club (server only). Anyone who taps the club's link (t.me/<bot>?start=<join_code>)
// says which member they are; the club's admins who already score by chat get Allow / No in Telegram,
// and the same ask waits in Match Centre settings. Allowed people get a chat link like the per-person
// "Link chat" one. Tables: club_chat_settings.join_code, chat_join_requests (migration 20261186).
import type { SupabaseClient } from '@supabase/supabase-js';
import { editTelegram, sendTelegram } from './telegram';
import { findPlayers, SHORT_FORMAT_HELP } from './chat-score';
import { clubTimeZone } from './dates';

const DAY = 86_400_000;
type Reply = { text: string };
interface Ask { chat_id: string; message_id: number }
export interface JoinRequest {
  id: string; club_id: string; chat_id: string; member_id: string | null; sender: string | null;
  status: 'naming' | 'waiting' | 'allowed' | 'declined'; asks: Ask[]; answered_by: string | null; created_at: string;
}

/** "Priya G (@priyag)": the Telegram name an admin sees on the ask */
export function senderName(from: { first_name?: unknown; last_name?: unknown; username?: unknown } | null | undefined): string | undefined {
  if (!from) return undefined;
  const name = [from.first_name, from.last_name].filter(x => typeof x === 'string' && x.trim()).join(' ');
  const user = typeof from.username === 'string' && from.username ? `@${from.username}` : '';
  return (name && user ? `${name} (${user})` : name || user).slice(0, 120) || undefined;
}

export const joinAskText = (name: string, role: string | null | undefined, sender: string | null | undefined, club: string) =>
  `🙋 ${name} wants to score for ${club}.\nClub role: ${role || 'Member'}${sender ? `\nTelegram: ${sender}` : ''}`;

const canScore = async (db: SupabaseClient, memberId: string) =>
  (await db.rpc('chat_member_can_score', { p_member_id: memberId })).data === true;

/** /start <code> with a club's link: asks who they are. null when the code isn't a club link. */
export async function startJoin(db: SupabaseClient, chatId: string, code: string, sender: string | undefined): Promise<Reply | null> {
  const { data: s } = await db.from('club_chat_settings').select('club_id, scoring_enabled').eq('join_code', code).maybeSingle();
  if (!s) return null;
  const { data: club } = await db.from('clubs').select('name').eq('id', s.club_id).maybeSingle();
  const name = club?.name || 'the club';
  if (!s.scoring_enabled) return { text: `Score by chat is turned off at ${name} right now. Ask a club admin.` };
  const { data: mine } = await db.from('chat_links').select('member_id').eq('channel', 'telegram').eq('chat_id', chatId).eq('club_id', s.club_id);
  for (const l of mine || []) {
    if (await canScore(db, l.member_id)) return { text: `This chat already scores for ${name}. When a game is on, send games to pick it.` };
  }
  await db.from('chat_join_requests').delete().eq('channel', 'telegram').eq('chat_id', chatId).eq('status', 'naming');
  const { error } = await db.from('chat_join_requests').insert({ club_id: s.club_id, channel: 'telegram', chat_id: chatId, sender: sender || null, status: 'naming' });
  if (error) return { text: "Couldn't start that. Please tap the club link again." };
  return { text: `Hi! This is the scoring chat for ${name}. Which member are you? Send your name as the club has it.` };
}

/** This chat's ask still waiting for a name (from the last day), if any */
export async function namingRequest(db: SupabaseClient, chatId: string, now: Date): Promise<JoinRequest | null> {
  const { data } = await db.from('chat_join_requests').select('*').eq('channel', 'telegram').eq('chat_id', chatId).eq('status', 'naming')
    .gte('created_at', new Date(now.getTime() - DAY).toISOString()).order('created_at', { ascending: false }).limit(1).maybeSingle();
  return (data as JoinRequest | null) || null;
}

/** The name they sent: finds the member, then asks the club's admins */
export async function nameJoin(db: SupabaseClient, req: JoinRequest, typed: string): Promise<Reply> {
  const [{ data: club }, { data: members }] = await Promise.all([
    db.from('clubs').select('name').eq('id', req.club_id).maybeSingle(),
    db.from('club_members').select('id, full_name, role, membership_status, status').eq('club_id', req.club_id),
  ]);
  const clubName = club?.name || 'the club';
  const current = (members || []).filter(m => (m.membership_status ?? 'approved') === 'approved' && m.status !== 'suspended' && m.full_name);
  const hits = findPlayers(typed.slice(0, 80), current.map(m => ({ id: m.id as string, name: m.full_name as string, role: m.role as string | null })));
  if (!hits.length) return { text: `I can't find "${typed.slice(0, 60)}" at ${clubName}. Send your name as the club has it, or ask a club admin to add you.` };
  if (hits.length > 1) return { text: `More than one member matches "${typed.slice(0, 60)}". Send your full name.` };
  const who = hits[0];
  if (!(await canScore(db, who.id))) {
    await db.from('chat_join_requests').update({ status: 'declined', member_id: who.id, answered_by: 'their role' }).eq('id', req.id);
    return { text: `Thanks, ${who.name}. Your role at ${clubName} doesn't allow scoring. Ask a club admin for a role that can edit Match Centre, then tap the club link again.` };
  }
  const { data: claimed } = await db.from('chat_join_requests').update({ status: 'waiting', member_id: who.id }).eq('id', req.id).eq('status', 'naming').select('id');
  if (!claimed?.length) return { text: 'That ask has already moved on. Tap the club link again if you need to.' };

  // Every chat already scoring for the club, from people who still may (the admins and managers)
  const { data: links } = await db.from('chat_links').select('chat_id, member_id').eq('channel', 'telegram').eq('club_id', req.club_id);
  const asks: Ask[] = [];
  const sent = new Set<string>();
  const text = joinAskText(who.name, who.role, req.sender, clubName);
  for (const l of links || []) {
    if (l.chat_id === req.chat_id || sent.has(l.chat_id) || !(await canScore(db, l.member_id))) continue;
    sent.add(l.chat_id);
    const id = await sendTelegram(l.chat_id, text, [{ text: 'Allow', data: `allow:${req.id}` }, { text: 'No', data: `deny:${req.id}` }]);
    if (id) asks.push({ chat_id: l.chat_id, message_id: id });
  }
  if (asks.length) await db.from('chat_join_requests').update({ asks }).eq('id', req.id);
  return { text: `Thanks, ${who.name}${who.role ? ` (${who.role})` : ''}. I've asked the club's admins to let you score. I'll message you here when they do.\nNot you? Tap the club link again.` };
}

/** Allow or No, from an admin's chat or Match Centre settings. by: the admin's name. clubId: the admin's club. */
export async function answerJoin(db: SupabaseClient, id: string, allow: boolean, by: string, clubId: string, now: Date): Promise<Reply & { ok: boolean }> {
  const { data } = await db.from('chat_join_requests').select('*').eq('id', id).maybeSingle();
  const req = data as JoinRequest | null;
  if (!req || req.club_id !== clubId || !req.member_id) return { ok: false, text: "That ask isn't there any more." };
  if (req.status !== 'waiting') return { ok: false, text: `Already answered${req.answered_by ? ` by ${req.answered_by}` : ''}.` };
  const [{ data: member }, { data: club }] = await Promise.all([
    db.from('club_members').select('full_name, role').eq('id', req.member_id).maybeSingle(),
    db.from('clubs').select('name, config').eq('id', req.club_id).maybeSingle(),
  ]);
  const name = member?.full_name || 'They';
  const first = name.split(' ')[0];
  const clubName = club?.name || 'the club';
  const ok = allow && (await canScore(db, req.member_id));
  const { data: claimed } = await db.from('chat_join_requests')
    .update({ status: ok ? 'allowed' : 'declined', answered_by: by.slice(0, 120), answered_at: now.toISOString() })
    .eq('id', id).eq('status', 'waiting').select('id');
  if (!claimed?.length) return { ok: false, text: 'Someone else answered that just now.' };

  if (ok) {
    const { error } = await db.from('chat_links').upsert(
      { club_id: req.club_id, member_id: req.member_id, channel: 'telegram', chat_id: req.chat_id, linked_at: now.toISOString(), active_match_id: null, pending: null },
      { onConflict: 'channel,chat_id,member_id' },
    );
    if (error) {
      await db.from('chat_join_requests').update({ status: 'waiting', answered_by: null, answered_at: null }).eq('id', id);
      return { ok: false, text: "Couldn't save that. Try again." };
    }
    // One club per chat, as with the per-person link
    await db.from('chat_links').delete().eq('channel', 'telegram').eq('chat_id', req.chat_id).neq('club_id', req.club_id);
    await sendTelegram(req.chat_id, `You're in. ${by} said yes, so you can score for ${clubName}.\nWhen a game is on, send games to pick it, then things like g sam 23.\n${SHORT_FORMAT_HELP}`);
  } else {
    await sendTelegram(req.chat_id, `${clubName} didn't allow scoring by chat this time. Ask a club admin if that's a mistake.`);
  }

  // The asks in other admins' chats say who answered, and lose their buttons
  const time = new Intl.DateTimeFormat('en-AU', { timeZone: clubTimeZone(club || {}), hour: 'numeric', minute: '2-digit' }).format(now).replace(/\s/g, '').toLowerCase();
  const done = `${joinAskText(name, member?.role, req.sender, clubName)}\n${ok ? '✓ Allowed' : '✗ Turned down'} by ${by}, ${time}`;
  for (const a of req.asks || []) await editTelegram(a.chat_id, a.message_id, done);

  if (allow && !ok) return { ok: false, text: `${name}'s role no longer allows scoring, so I couldn't let them in.` };
  return { ok: true, text: ok ? `Done. ${first} can score now, and I've let them know.` : `Done. I've told ${first} no.` };
}
