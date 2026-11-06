import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { durableRateLimit, getClientIp } from '@/lib/rate-limit';
import { isUuid } from '@/lib/ids';

const PRIVATE = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };

// One bill (a fee request, or one instalment of a sponsorship), for its pay page. The id is the key, as with tickets: only the person it was sent to and the
// club's finance team ever see it. Only what the payer needs comes back, never the club's own notes.
export async function GET(req: NextRequest, { params }: { params: Promise<{ paymentId: string }> }) {
  // The pay page polls while a card payment confirms (every 3 s for up to a minute)
  if (!(await durableRateLimit(`fee-bill:${getClientIp(req.headers)}`, 60, 10 * 60 * 1000))) {
    return NextResponse.json({ error: 'Too many requests. Please wait a few minutes.' }, { status: 429, headers: PRIVATE });
  }
  const { paymentId } = await params;
  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: 'This is not available right now.' }, { status: 503, headers: PRIVATE });
  const notFound = NextResponse.json({ error: 'We couldn\'t find this payment. Check the link, or ask the club.' }, { status: 404, headers: PRIVATE });
  if (!isUuid(paymentId)) return notFound;

  const { data: bill } = await db.from('payments')
    .select('*, member:club_members(full_name)')
    .eq('id', paymentId).in('kind', ['fee_request', 'sponsorship']).maybeSingle();
  // A sponsorship only opens here if it's an instalment; other payments aren't paid from this page
  if (!bill || (bill.kind === 'sponsorship' && !bill.instalment_plan_id)) return notFound;

  const member = (Array.isArray(bill.member) ? bill.member[0] : bill.member) as { full_name: string } | null;
  const sponsor = bill.sponsor_id ? (await db.from('sponsors').select('name').eq('id', bill.sponsor_id).maybeSingle()).data : null;
  return NextResponse.json({
    clubId: bill.club_id,
    kind: bill.kind,
    status: bill.status,
    title: bill.request_title || bill.description,
    forName: member?.full_name ?? sponsor?.name ?? null,
    amountCents: bill.amount_cents,
    currency: bill.currency,
    dueOn: bill.due_on,
  }, { headers: PRIVATE });
}
