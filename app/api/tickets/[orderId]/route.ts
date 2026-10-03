import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { durableRateLimit, getClientIp } from '@/lib/rate-limit';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRIVATE = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };

// A buyer's tickets. The order id is the key: only the buyer (checkout redirect, email) and the
// club's admins ever see it. Ticket codes go out only once the order is paid.
export async function GET(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  // The tickets page polls while the card payment confirms (every 3 s for up to a minute)
  if (!(await durableRateLimit(`tickets:${getClientIp(req.headers)}`, 60, 10 * 60 * 1000))) {
    return NextResponse.json({ error: 'Too many requests. Please wait a few minutes.' }, { status: 429, headers: PRIVATE });
  }
  const { orderId } = await params;
  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: 'Tickets are not available right now.' }, { status: 503, headers: PRIVATE });
  const notFound = NextResponse.json({ error: 'Order not found.' }, { status: 404, headers: PRIVATE });
  if (!UUID_RE.test(orderId)) return notFound;

  const { data: order } = await db.from('payments')
    .select('id, status, payer_name, event_id')
    .eq('id', orderId).eq('kind', 'event_ticket').maybeSingle();
  if (!order) return notFound;

  const [{ data: event }, { data: tickets }] = await Promise.all([
    db.from('events').select('id, title, start_time, location').eq('id', order.event_id).maybeSingle(),
    order.status === 'paid'
      ? db.from('event_attendees').select('qr_ticket_code, checkin_status').eq('payment_id', order.id).order('created_at')
      : Promise.resolve({ data: [] }),
  ]);

  return NextResponse.json({
    status: order.status,
    buyer: order.payer_name,
    event,
    tickets: (tickets || []).map(t => ({ code: t.qr_ticket_code, status: t.checkin_status })),
  }, { headers: PRIVATE });
}
