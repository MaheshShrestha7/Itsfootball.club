import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/supabase/server-auth';
import { getServiceClient } from '@/lib/supabase/service';
import { logPlatformAction } from '@/lib/platform-audit';
import { isUuid } from '@/lib/ids';
import { SITE_URL } from '@/lib/slugs';
import { SITE_TIME_ZONE } from '@/lib/dates';
import { setTelegramWebhook, telegramConfigured } from '@/lib/telegram';
import { AI_MODELS, aiConfigured, askModel, type AiReader } from '@/lib/chat-ai';
import { parseAiReply } from '@/lib/chat-score';
import { dayStartIso } from '@/lib/chat-bot-server';

// Mission Control -> AI and chat: score by chat across the platform.
//   GET                                   -> switches, limits, today's use, each club's switches
//   POST { action: 'settings', ... }      -> AI master switch and daily limits
//   POST { action: 'club', clubId, aiAllowed }   -> AI reading on or off for one club
//   POST { action: 'webhook' }            -> points Telegram at this site (after the bot token is set)
//   POST { action: 'test', reader }       -> reads a sample message with one model, to check the key works
// Looking: any platform admin. Changing: Super admins and Operators. Changes go in the Action log.

const NOT_READY = 'Run the score by chat migration (20261183_score_by_chat.sql) first.';
const int = (v: unknown, min: number, max: number) => (Number.isInteger(v) && (v as number) >= min && (v as number) <= max ? (v as number) : null);

export async function GET(req: NextRequest) {
  const auth = await requirePlatformAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: 'The database is not configured on the server.' }, { status: 503 });

  const since = dayStartIso(SITE_TIME_ZONE, new Date());
  const [{ data: settings, error }, { data: clubs }, { data: today }, { data: links }] = await Promise.all([
    db.from('platform_chat_settings').select('ai_enabled, daily_limit, club_daily_limit, per_minute').eq('id', 1).maybeSingle(),
    db.from('club_chat_settings').select('club_id, scoring_enabled, ai_allowed'),
    db.from('chat_messages').select('club_id, reader, ai_error, created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(5000),
    db.from('chat_links').select('club_id'),
  ]);
  if (error) return NextResponse.json({ error: NOT_READY }, { status: 503 });

  const rows = today || [];
  const by = (r: string) => rows.filter(x => x.reader === r).length;
  const aiByClub: Record<string, number> = {};
  for (const r of rows) if (r.club_id && (r.reader === 'flash-lite' || r.reader === 'gemma')) aiByClub[r.club_id] = (aiByClub[r.club_id] || 0) + 1;
  const linkedByClub: Record<string, number> = {};
  for (const l of links || []) linkedByClub[l.club_id] = (linkedByClub[l.club_id] || 0) + 1;
  const lastError = rows.find(r => r.ai_error)?.created_at || null;

  return NextResponse.json({
    settings,
    setup: { bot: telegramConfigured(), ai: aiConfigured(), models: AI_MODELS },
    today: { messages: rows.length, short: by('short'), flash: by('flash-lite'), gemma: by('gemma'), none: by('none'), errors: rows.filter(r => r.ai_error).length, lastError },
    clubs: (clubs || []).map(c => ({ ...c, ai_used: aiByClub[c.club_id] || 0, linked: linkedByClub[c.club_id] || 0 })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requirePlatformAdmin(req, true);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: 'The database is not configured on the server.' }, { status: 503 });
  const body = await req.json().catch(() => null);

  if (body?.action === 'settings') {
    const daily = int(body.daily_limit, 0, 100000), club = int(body.club_daily_limit, 0, 100000), minute = int(body.per_minute, 1, 600);
    if (typeof body.ai_enabled !== 'boolean' || daily === null || club === null || minute === null) {
      return NextResponse.json({ error: 'Limits must be whole numbers: 0 to 100,000 a day, 1 to 600 a minute.' }, { status: 400 });
    }
    const next = { ai_enabled: body.ai_enabled, daily_limit: daily, club_daily_limit: club, per_minute: minute };
    const { error } = await db.from('platform_chat_settings').upsert({ id: 1, ...next, updated_at: new Date().toISOString() });
    if (error) return NextResponse.json({ error: NOT_READY }, { status: 503 });
    await logPlatformAction(db, auth, {
      action: 'ai_settings', table: 'platform_chat_settings', targetId: null,
      summary: `AI for score by chat ${next.ai_enabled ? 'on' : 'off'}; limits ${daily} a day, ${club} per club, ${minute} a minute per chat`,
      details: next,
    });
    return NextResponse.json({ ok: true, settings: next });
  }

  if (body?.action === 'club') {
    if (!isUuid(body.clubId) || typeof body.aiAllowed !== 'boolean') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    const { data: club } = await db.from('clubs').select('name').eq('id', body.clubId).maybeSingle();
    if (!club) return NextResponse.json({ error: 'Club not found.' }, { status: 404 });
    const { error } = await db.from('club_chat_settings').upsert({ club_id: body.clubId, ai_allowed: body.aiAllowed, updated_at: new Date().toISOString() }, { onConflict: 'club_id' });
    if (error) return NextResponse.json({ error: NOT_READY }, { status: 503 });
    await logPlatformAction(db, auth, {
      clubId: body.clubId, action: 'ai_club', table: 'club_chat_settings', targetId: body.clubId,
      summary: `AI for score by chat ${body.aiAllowed ? 'on' : 'off'} for ${club.name}`,
    });
    return NextResponse.json({ ok: true });
  }

  if (body?.action === 'webhook') {
    if (!telegramConfigured()) return NextResponse.json({ error: 'Add TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME and TELEGRAM_WEBHOOK_SECRET to the site first.' }, { status: 400 });
    // Telegram only takes letters, numbers, _ and - here, up to 256
    if (!/^[A-Za-z0-9_-]{1,256}$/.test(process.env.TELEGRAM_WEBHOOK_SECRET || '')) {
      return NextResponse.json({ error: 'TELEGRAM_WEBHOOK_SECRET can only use letters, numbers, _ and - (no spaces or other symbols). Change it in Cloudflare, deploy, then try again.' }, { status: 400 });
    }
    const r = await setTelegramWebhook(`${SITE_URL}/api/chat/telegram`);
    if (!r.ok) return NextResponse.json({ error: `Telegram said: ${r.description || 'no'}` }, { status: 502 });
    await logPlatformAction(db, auth, { action: 'ai_bot_connected', table: 'platform_chat_settings', summary: 'Connected Itsfootball.club Bot to Telegram' });
    return NextResponse.json({ ok: true });
  }

  if (body?.action === 'test') {
    const reader: AiReader = body.reader === 'gemma' ? 'gemma' : 'flash-lite';
    const r = await askModel(reader, 'sam again, great header', ['Sam', 'Jack', 'Arjun']);
    if (r.error) return NextResponse.json({ ok: false, model: AI_MODELS[reader], error: r.error });
    const command = parseAiReply(r.text || '');
    return NextResponse.json({ ok: !!command, model: AI_MODELS[reader], answer: (r.text || '').slice(0, 300), command });
  }

  return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
}
