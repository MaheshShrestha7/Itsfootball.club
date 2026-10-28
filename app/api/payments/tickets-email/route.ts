import { NextRequest, NextResponse } from 'next/server';
import { requireClubPerm } from '@/lib/supabase/server-auth';
import { getServiceClient } from '@/lib/supabase/service';
import { emailTickets } from '@/lib/email/tickets';
import { emailSponsorPaid } from '@/lib/email/sponsor-paid';
import { isUuid } from '@/lib/ids';
import type { Payment } from '@/lib/supabase/types';

// Emails a buyer their tickets after the club verifies their bank transfer (Finance -> Verify).
// A verified sponsorship gets the sponsor's thank-you email with the link to their own page.
//   POST { clubId, paymentId }   club admins with Finance edit; a paid ticket order or sponsorship
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!isUuid(body?.clubId) || !isUuid(body?.paymentId)) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  const auth = await requireClubPerm(req, body.clubId, ['finance'], 'edit');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const db = getServiceClient();
  if (!db || !process.env.RESEND_API_KEY) return NextResponse.json({ sent: false, error: 'Email is not set up.' }, { status: 503 });
  const { data: pay } = await db.from('payments').select('*').eq('id', body.paymentId).eq('club_id', body.clubId).maybeSingle();
  if (pay?.kind === 'sponsorship' && pay.status === 'paid') return NextResponse.json({ sent: await emailSponsorPaid(db, pay as Payment) });
  if (!pay || pay.kind !== 'event_ticket' || pay.status !== 'paid') {
    return NextResponse.json({ sent: false, error: 'Not a paid ticket order.' }, { status: 409 });
  }
  return NextResponse.json({ sent: await emailTickets(db, pay as Payment) });
}
