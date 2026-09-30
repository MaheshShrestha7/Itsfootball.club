import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { durableRateLimit, getClientIp } from '@/lib/rate-limit';
import { isUuid } from '@/lib/ids';
import { parseSubscription, pushConfigured } from '@/lib/push';

// Following a club's push notifications (the bell in the club navbar). No account needed.
//   POST { action: 'status' | 'follow' | 'unfollow', clubId, subscription }
// The subscription's endpoint is unguessable, so holding it is what proves the browser is yours.

export async function POST(req: NextRequest) {
  const db = getServiceClient();
  if (!db || !pushConfigured()) return NextResponse.json({ error: 'Notifications are not set up yet.' }, { status: 503 });

  const body = await req.json().catch(() => null);
  const sub = parseSubscription(body?.subscription);
  if (!isUuid(body?.clubId) || !sub) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  const clubId: string = body.clubId;

  if (body.action === 'status') {
    const { data } = await db.from('push_subscriptions').select('club_id').eq('endpoint', sub.endpoint).eq('club_id', clubId).maybeSingle();
    return NextResponse.json({ following: !!data });
  }

  if (!(await durableRateLimit(`push:${getClientIp(req.headers)}`, 30, 60 * 60 * 1000))) {
    return NextResponse.json({ error: 'Too many changes. Please try again later.' }, { status: 429 });
  }

  if (body.action === 'unfollow') {
    await db.from('push_subscriptions').delete().eq('endpoint', sub.endpoint).eq('club_id', clubId);
    return NextResponse.json({ following: false });
  }

  if (body.action === 'follow') {
    const { data: club } = await db.from('clubs').select('id').eq('id', clubId).eq('is_active', true).maybeSingle();
    if (!club) return NextResponse.json({ error: 'Club not found.' }, { status: 404 });
    const { error } = await db.from('push_subscriptions').upsert({ endpoint: sub.endpoint, club_id: clubId, p256dh: sub.p256dh, auth: sub.auth });
    if (error) {
      console.error('[push] follow failed:', error.message);
      return NextResponse.json({ error: 'Could not turn on notifications. Please try again.' }, { status: 500 });
    }
    return NextResponse.json({ following: true });
  }

  return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
}
