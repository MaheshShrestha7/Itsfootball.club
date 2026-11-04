import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server-auth';
import { getServiceClient } from '@/lib/supabase/service';
import { durableRateLimit } from '@/lib/rate-limit';

// The signed-in user's club emails on/off (Account settings, components/account/AccountSettings.tsx).
// Same email_opt_outs rows the unsubscribe link in each email writes (app/api/email/unsubscribe),
// keyed on the account's confirmed address. Sign-in links, receipts and payment emails ignore them.
//   GET                                   -> { email, optedOut: clubId[] }
//   POST { clubId, subscribed: boolean }  -> { clubId, subscribed }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!auth.confirmedEmail) return NextResponse.json({ email: null, optedOut: [] });
  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: 'Please try again later.' }, { status: 503 });

  const { data, error } = await db.from('email_opt_outs').select('club_id').eq('email', auth.confirmedEmail);
  if (error) return NextResponse.json({ error: 'Please try again later.' }, { status: 500 });
  return NextResponse.json({ email: auth.confirmedEmail, optedOut: (data || []).map(r => r.club_id as string) });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!auth.confirmedEmail) return NextResponse.json({ error: 'Confirm your email address first.' }, { status: 403 });
  if (!(await durableRateLimit(`email-prefs:${auth.userId}`, 30, 10 * 60 * 1000))) {
    return NextResponse.json({ error: 'Too many changes. Please wait a few minutes.' }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const clubId = String(body.clubId || '');
  if (!UUID_RE.test(clubId) || typeof body.subscribed !== 'boolean') {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: 'Please try again later.' }, { status: 503 });

  const { data: club } = await db.from('clubs').select('id').eq('id', clubId).maybeSingle();
  if (!club) return NextResponse.json({ error: 'This club no longer exists.' }, { status: 404 });

  const email = auth.confirmedEmail;
  const { error } = body.subscribed
    ? await db.from('email_opt_outs').delete().eq('club_id', clubId).eq('email', email)
    : await db.from('email_opt_outs').upsert({ club_id: clubId, email }, { onConflict: 'club_id,email', ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: 'Please try again later.' }, { status: 500 });
  return NextResponse.json({ clubId, subscribed: body.subscribed });
}
