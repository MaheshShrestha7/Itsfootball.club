import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { metaConfig, pagesFromCode, readState, seal } from '@/lib/meta-graph';
import { clubUrl } from '@/lib/social-posts';

// Facebook sends the admin back here after "Connect with Facebook". The Pages they allowed are kept
// as a pending sign-in, and the admin's own browser finishes it (POST /api/social/meta, finish) with
// the one-time code in the link, so a sign-in link sent to someone else can't connect their Page.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const cfg = metaConfig();
  const db = getServiceClient();
  const state = cfg ? await readState(cfg.secret, q.get('state') || '') : null;
  if (!cfg || !db || !state) return new NextResponse('This Facebook sign-in has expired. Go back to Admin, Social media and press Connect with Facebook again.', { status: 400 });

  const { data: club } = await db.from('clubs').select('slug, custom_domain').eq('id', state.clubId).maybeSingle();
  if (!club) return new NextResponse('Club not found.', { status: 404 });
  const back = (param: string) => NextResponse.redirect(clubUrl(club, `/${club.slug}/admin/social?tab=accounts&${param}`), 303);

  const code = q.get('code');
  if (!code) return back('meta_error=cancelled');
  try {
    const { fbUserId, pages } = await pagesFromCode(cfg, code);
    const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('hex');
    const { error } = await db.from('social_accounts').upsert({
      club_id: state.clubId, pending_by: state.userId, pending_at: new Date().toISOString(),
      pending_enc: await seal(cfg.secret, JSON.stringify({ fbUserId, nonce, pages })),
    }, { onConflict: 'club_id' });
    if (error) throw error;
    return back(`meta=${nonce}`);
  } catch (e) {
    console.error('Facebook sign-in failed:', (e as Error).message);
    return back('meta_error=failed');
  }
}
