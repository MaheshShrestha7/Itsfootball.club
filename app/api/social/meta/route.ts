import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { requireClubPerm } from '@/lib/supabase/server-auth';
import { readSocialSettings } from '@/lib/social-posts';
import { loginUrl, metaConfig, seal, signState, unseal, type MetaPending } from '@/lib/meta-graph';

// The club's Facebook Page and Instagram (Admin > Social media > Accounts, migration 20261188).
// GET: what's connected and which posts go out by themselves (anyone who can see News, or score games:
// their screen makes the kick-off, half time and full time posts). POST start: the Facebook sign-in link.
// POST finish: the admin who signed in picks the Page. DELETE: disconnect.
// Connecting and disconnecting need full News rights (Owner and Club Admin always have them).

const PENDING_FOR = 30 * 60000;

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function GET(req: NextRequest) {
  const clubId = req.nextUrl.searchParams.get('clubId') || '';
  if (!clubId) return fail('Invalid request.', 400);
  const auth = await requireClubPerm(req, clubId, ['content', 'match-center', 'matches'], 'view');
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getServiceClient();
  if (!metaConfig() || !db) return NextResponse.json({ configured: false });
  const [{ data, error }, { data: settings }] = await Promise.all([
    db.from('social_accounts').select('page_id, page_name, ig_username, connected_by_name, connected_at').eq('club_id', clubId).maybeSingle(),
    db.from('social_settings').select('rules, hashtags').eq('club_id', clubId).maybeSingle(),
  ]);
  if (error) return NextResponse.json({ configured: false, missing: true });
  return NextResponse.json({
    configured: true,
    connected: !!data?.page_id,
    page: data?.page_id ? { name: data.page_name, instagram: data.ig_username, by: data.connected_by_name, at: data.connected_at } : null,
    settings: readSocialSettings(settings),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const clubId = typeof body?.clubId === 'string' ? body.clubId : '';
  if (!clubId) return fail('Invalid request.', 400);
  const auth = await requireClubPerm(req, clubId, ['content'], 'full');
  if (!auth.ok) return fail(auth.error, auth.status);
  const cfg = metaConfig();
  const db = getServiceClient();
  if (!cfg || !db) return fail('Facebook posting is not set up on this site yet.', 503);

  if (body.action === 'start') return NextResponse.json({ url: loginUrl(cfg, await signState(cfg.secret, clubId, auth.userId)) });

  if (body.action !== 'finish') return fail('Invalid request.', 400);
  const { data: row } = await db.from('social_accounts').select('pending_enc, pending_by, pending_at').eq('club_id', clubId).maybeSingle();
  // Only the admin who signed in with Facebook, in the browser that came back from it (the nonce)
  const fresh = row?.pending_enc && row.pending_by === auth.userId && Date.now() - Date.parse(row.pending_at) < PENDING_FOR;
  const pending = fresh ? JSON.parse(await unseal(cfg.secret, row.pending_enc) || 'null') as MetaPending | null : null;
  if (!pending || typeof body.nonce !== 'string' || body.nonce !== pending.nonce) {
    return fail('That Facebook sign-in has expired. Press Connect with Facebook again.', 410);
  }
  if (!pending.pages.length) return fail("Facebook didn't give us any Pages you can post to. Check you're an admin of the club's Page, then connect again and tick it.", 422);
  const page = pending.pages.length === 1 ? pending.pages[0] : pending.pages.find(p => p.id === body.pageId);
  if (!page) return NextResponse.json({ choose: pending.pages.map(p => ({ id: p.id, name: p.name, instagram: p.igUsername || null })) });

  const { error } = await db.from('social_accounts').update({
    fb_user_id: pending.fbUserId, page_id: page.id, page_name: page.name, page_token_enc: await seal(cfg.secret, page.token),
    ig_user_id: page.igId || null, ig_username: page.igUsername || null,
    connected_by: auth.userId, connected_by_name: typeof body.name === 'string' ? body.name.slice(0, 120) || null : null,
    connected_at: new Date().toISOString(), pending_enc: null, pending_by: null, pending_at: null,
  }).eq('club_id', clubId);
  if (error) return fail("That didn't save. Please try again.", 500);
  return NextResponse.json({ connected: true });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const clubId = typeof body?.clubId === 'string' ? body.clubId : '';
  if (!clubId) return fail('Invalid request.', 400);
  const auth = await requireClubPerm(req, clubId, ['content'], 'full');
  if (!auth.ok) return fail(auth.error, auth.status);
  const db = getServiceClient();
  if (!db) return fail('Facebook posting is not set up on this site yet.', 503);
  // shortcut: the app keeps its permission in the person's Facebook settings until they remove it there
  const { error } = await db.from('social_accounts').delete().eq('club_id', clubId);
  if (error) return fail("That didn't save. Please try again.", 500);
  return NextResponse.json({ connected: false });
}
