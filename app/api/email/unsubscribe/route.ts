import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe';
import { normalizeEmail } from '@/lib/email/club-emails';

// Unsubscribe from one club's emails. POST only: link scanners (e.g. Outlook Safe Links) open every
// GET in an email, which would unsubscribe people by accident. Two callers:
//   - mail apps' own "Unsubscribe" button (RFC 8058 one-click): POST with c, e, t in the query
//   - the /unsubscribe page: POST JSON { c, e, t, action: 'check' | 'unsubscribe' | 'resubscribe' }

export async function POST(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const json = req.headers.get('content-type')?.includes('application/json') ? await req.json().catch(() => ({})) : {};
  const clubId = String(json.c ?? q.get('c') ?? '');
  const email = normalizeEmail(String(json.e ?? q.get('e') ?? ''));
  const token = String(json.t ?? q.get('t') ?? '');
  const action: 'check' | 'unsubscribe' | 'resubscribe' = ['check', 'resubscribe'].includes(json.action) ? json.action : 'unsubscribe';

  if (!clubId || !email || !(await verifyUnsubscribeToken(clubId, email, token))) {
    return NextResponse.json({ error: 'This unsubscribe link is invalid or has expired.' }, { status: 400 });
  }
  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: 'Please try again later.' }, { status: 503 });

  const { data: club } = await db.from('clubs').select('name').eq('id', clubId).maybeSingle();
  if (!club) return NextResponse.json({ error: 'This club no longer exists.' }, { status: 404 });

  if (action === 'check') {
    const { data } = await db.from('email_opt_outs').select('email').eq('club_id', clubId).eq('email', email).maybeSingle();
    return NextResponse.json({ club: club.name, email, unsubscribed: !!data });
  }

  const { error } = action === 'resubscribe'
    ? await db.from('email_opt_outs').delete().eq('club_id', clubId).eq('email', email)
    : await db.from('email_opt_outs').upsert({ club_id: clubId, email }, { onConflict: 'club_id,email', ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: 'Please try again later.' }, { status: 500 });
  return NextResponse.json({ club: club.name, email, unsubscribed: action === 'unsubscribe' });
}
