import { NextRequest, NextResponse } from 'next/server';
import { requireClubPerm } from '@/lib/supabase/server-auth';
import { getServiceClient } from '@/lib/supabase/service';
import { isUuid } from '@/lib/ids';
import { b64url } from '@/lib/push';
import { telegramConfigured, telegramStartLink } from '@/lib/telegram';
import { answerJoin } from '@/lib/chat-join';

// Score by chat for one club (club admins: Match Centre at "full").
//   GET  ?clubId=                                   -> the switch, whether AI reading is allowed, who is linked
//   POST { clubId, action: 'toggle', on }          -> turn score by chat on or off
//   POST { clubId, action: 'link', memberId }      -> a one-time Link chat link for that member (24 hours)
//   POST { clubId, action: 'unlink', memberId }    -> unlink every chat of that member
//   POST { clubId, action: 'join-link' }           -> a new club scoring link (the old one stops working)
//   POST { clubId, action: 'answer', requestId, allow } -> Allow / No for someone who asked through the club link
// The tables are server-only (migration 20261183_score_by_chat.sql), so this route uses the service role.

const DAY = 24 * 60 * 60 * 1000;
const NOT_READY = 'Run the score by chat migration (20261183_score_by_chat.sql) first.';

async function guard(req: NextRequest, clubId: unknown) {
  if (!isUuid(clubId)) return { error: NextResponse.json({ error: 'Invalid request.' }, { status: 400 }) };
  const auth = await requireClubPerm(req, clubId as string, ['match-center'], 'full');
  if (!auth.ok) return { error: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  const db = getServiceClient();
  if (!db) return { error: NextResponse.json({ error: 'The database is not configured on the server.' }, { status: 503 }) };
  return { db, clubId: clubId as string, userId: auth.userId };
}

export async function GET(req: NextRequest) {
  const g = await guard(req, req.nextUrl.searchParams.get('clubId'));
  if ('error' in g) return g.error;
  const [{ data: settings, error }, { data: links }] = await Promise.all([
    g.db.from('club_chat_settings').select('scoring_enabled, ai_allowed').eq('club_id', g.clubId).maybeSingle(),
    g.db.from('chat_links').select('member_id, linked_at, last_used_at').eq('club_id', g.clubId),
  ]);
  if (error) return NextResponse.json({ error: NOT_READY, ready: false }, { status: 503 });
  // The club link (migration 20261186): missing columns or table just leave it out
  const [{ data: join, error: joinError }, { data: waiting }] = await Promise.all([
    g.db.from('club_chat_settings').select('join_code, join_code_made_at, join_code_made_by').eq('club_id', g.clubId).maybeSingle(),
    g.db.from('chat_join_requests').select('id, member_id, sender, created_at').eq('club_id', g.clubId).eq('status', 'waiting').order('created_at', { ascending: true }).limit(50),
  ]);
  const ids = [...new Set([...(links || []).map(l => l.member_id), ...(waiting || []).map(w => w.member_id)].filter(Boolean))];
  const { data: people } = ids.length ? await g.db.from('club_members').select('id, full_name, role').in('id', ids) : { data: [] };
  const who = (id: string) => (people || []).find(p => p.id === id);
  return NextResponse.json({
    ready: true,
    botReady: telegramConfigured(),
    scoringEnabled: !!settings?.scoring_enabled,
    aiAllowed: !!settings?.ai_allowed,
    links: (links || []).map(l => ({ ...l, name: who(l.member_id)?.full_name || 'Former member', role: who(l.member_id)?.role || null })),
    joinReady: !joinError,
    joinLink: join?.join_code ? telegramStartLink(join.join_code) : null,
    joinMadeAt: join?.join_code_made_at || null,
    joinMadeBy: join?.join_code_made_by || null,
    waiting: (waiting || []).map(w => ({ id: w.id, sender: w.sender, askedAt: w.created_at, memberId: w.member_id, name: who(w.member_id)?.full_name || 'Someone', role: who(w.member_id)?.role || null })),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const g = await guard(req, body?.clubId);
  if ('error' in g) return g.error;
  const { db, clubId } = g;

  if (body.action === 'toggle') {
    const { error } = await db.from('club_chat_settings').upsert(
      { club_id: clubId, scoring_enabled: body.on === true, updated_at: new Date().toISOString() },
      { onConflict: 'club_id' },
    );
    if (error) return NextResponse.json({ error: NOT_READY }, { status: 503 });
    return NextResponse.json({ ok: true, scoringEnabled: body.on === true });
  }

  if (body.action === 'join-link' || body.action === 'answer') {
    const { data: me } = await db.from('club_members').select('full_name').eq('club_id', clubId).eq('user_id', g.userId).limit(1).maybeSingle();
    const by = me?.full_name || 'a club admin';
    if (body.action === 'answer') {
      if (!isUuid(body.requestId)) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
      const res = await answerJoin(db, body.requestId, body.allow === true, by, clubId, new Date());
      return res.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: res.text }, { status: 409 });
    }
    if (!telegramConfigured()) return NextResponse.json({ error: 'The bot is not set up yet. A platform admin connects it in Mission Control.' }, { status: 503 });
    const { data: club } = await db.from('clubs').select('slug').eq('id', clubId).maybeSingle();
    // "austral-K7P2xq…": the club's name first so people can tell links apart, then enough randomness to not be guessed
    const prefix = (club?.slug || 'club').replace(/[^a-z0-9]/gi, '').slice(0, 16) || 'club';
    const code = `${prefix}-${b64url(crypto.getRandomValues(new Uint8Array(9)))}`;
    const { error } = await db.from('club_chat_settings').upsert(
      { club_id: clubId, join_code: code, join_code_made_at: new Date().toISOString(), join_code_made_by: by.slice(0, 120), updated_at: new Date().toISOString() },
      { onConflict: 'club_id' },
    );
    if (error) return NextResponse.json({ error: 'Run the club link migration (20261186_chat_club_link.sql) first.' }, { status: 503 });
    return NextResponse.json({ ok: true, link: telegramStartLink(code) });
  }

  if (!isUuid(body.memberId)) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  const { data: member } = await db.from('club_members').select('id, full_name').eq('id', body.memberId).eq('club_id', clubId).maybeSingle();
  if (!member) return NextResponse.json({ error: 'That person is not in this club.' }, { status: 404 });

  if (body.action === 'unlink') {
    const { error } = await db.from('chat_links').delete().eq('member_id', member.id).eq('club_id', clubId);
    if (error) return NextResponse.json({ error: NOT_READY }, { status: 503 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'link') {
    if (!telegramConfigured()) return NextResponse.json({ error: 'The bot is not set up yet. A platform admin connects it in Mission Control.' }, { status: 503 });
    const { data: may } = await db.rpc('chat_member_can_score', { p_member_id: member.id });
    if (may !== true) {
      return NextResponse.json({ error: `${member.full_name}'s role doesn't allow editing Match Centre. Give them a role such as Manager or Volunteer first.` }, { status: 400 });
    }
    const code = b64url(crypto.getRandomValues(new Uint8Array(12)));
    const expiresAt = new Date(Date.now() + DAY).toISOString();
    await db.from('chat_link_codes').delete().eq('member_id', member.id).is('used_at', null);
    const { error } = await db.from('chat_link_codes').insert({ code, club_id: clubId, member_id: member.id, expires_at: expiresAt });
    if (error) return NextResponse.json({ error: NOT_READY }, { status: 503 });
    return NextResponse.json({ ok: true, link: telegramStartLink(code), expiresAt });
  }

  return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
}
