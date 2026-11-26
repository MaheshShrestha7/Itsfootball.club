import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { metaConfig, readSignedRequest } from '@/lib/meta-graph';
import { SITE_URL } from '@/lib/slugs';

// Meta's "Data deletion request" and "Deauthorise" callbacks (set both to this URL in the Meta app):
// someone removed the app in their Facebook settings, so the Pages they connected are disconnected
// and their Page tokens deleted. Facebook user ids are all we keep about them.
export async function POST(req: NextRequest) {
  const cfg = metaConfig();
  const db = getServiceClient();
  const form = await req.formData().catch(() => null);
  const signed = form?.get('signed_request');
  const data = cfg && typeof signed === 'string' ? await readSignedRequest(cfg.secret, signed) : null;
  if (!cfg || !db || !data) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });

  const { error } = await db.from('social_accounts').delete().eq('fb_user_id', data.user_id);
  if (error) return NextResponse.json({ error: 'Please try again.' }, { status: 500 });
  const code = Buffer.from(crypto.getRandomValues(new Uint8Array(8))).toString('hex');
  return NextResponse.json({ url: `${SITE_URL}/privacy#facebook`, confirmation_code: code });
}
