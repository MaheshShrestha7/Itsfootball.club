import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { getServiceClient } from '@/lib/supabase/service';
import { preparePayment, readPaymentInput } from '@/lib/payments-server';
import { bookingFeeCents } from '@/lib/finance';
import { durableRateLimit, getClientIp } from '@/lib/rate-limit';
import { requireUser } from '@/lib/supabase/server-auth';

// Starts a hosted Stripe Checkout on the club's connected account. The webhook completes it.
export async function POST(req: NextRequest) {
  if (!(await durableRateLimit(`checkout:${getClientIp(req.headers)}`, 10, 10 * 60 * 1000))) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes.' }, { status: 429 });
  }
  const stripe = getStripe();
  const db = getServiceClient();
  if (!stripe || !db) return NextResponse.json({ error: 'Card payments are not available right now.' }, { status: 503 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });

  // Renewals need the member's own session (see preparePayment)
  const payer = await requireUser(req);
  const prepared = await preparePayment(db, readPaymentInput(k => (body as Record<string, unknown>)[k]), payer.ok ? payer.userId : null);
  if (!prepared.ok) return NextResponse.json({ error: prepared.error }, { status: prepared.status });
  const { draft } = prepared;
  if (!draft.stripeAccountId || !draft.stripeChargesEnabled) {
    return NextResponse.json({ error: 'This club does not take card payments yet. Please use bank transfer.' }, { status: 400 });
  }

  const { data: payment, error } = await db
    .from('payments')
    .insert({ ...draft.row, method: 'stripe', status: 'pending' })
    .select('id')
    .single();
  if (error || !payment) return NextResponse.json({ error: 'Could not start the payment.' }, { status: 500 });

  const origin = new URL(req.url).origin;
  const page = draft.row.kind === 'sponsorship' ? 'sponsor' : draft.row.kind === 'shop_order' ? 'shop' : 'member';
  const path = `/${draft.club.slug}/${page}`;
  // Tickets: the buyer lands on their tickets; the order id is the (unguessable) key to that page
  const ticketsPath = `/${draft.club.slug}/tickets/${payment.id}`;
  const currency = draft.currency.toLowerCase();
  // Booking fee sits on top of the club's price as its own line; Stripe routes it to the platform
  // (application fee), so the club still receives amount_cents, which is what its ledger records.
  const fee = bookingFeeCents(draft.row.amount_cents);
  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        line_items: [
          // Free items stay on the order (row.items) but not on Stripe, which may refuse a $0 line
          ...(draft.lines ?? [{ name: draft.label, unit_cents: draft.row.amount_cents, quantity: 1 }]).filter(l => l.unit_cents > 0).map(l => (
            { quantity: l.quantity, price_data: { currency, unit_amount: l.unit_cents, product_data: { name: l.name } } }
          )),
          ...(fee > 0
            ? [{ quantity: 1, price_data: { currency, unit_amount: fee, product_data: { name: 'Booking fee', description: 'Keeps itsfootball.club free for every club' } } }]
            : []),
        ],
        customer_email: draft.row.payer_email || undefined,
        client_reference_id: payment.id,
        metadata: { payment_id: payment.id },
        payment_intent_data: { metadata: { payment_id: payment.id }, ...(fee > 0 ? { application_fee_amount: fee } : {}) },
        success_url: draft.row.kind === 'event_ticket' ? `${origin}${ticketsPath}` : `${origin}${path}?payment=success`,
        cancel_url: draft.row.kind === 'event_ticket'
          ? `${origin}/${draft.club.slug}/events/${draft.row.event_id}?payment=cancelled`
          : `${origin}${path}?payment=cancelled`,
      },
      { stripeAccount: draft.stripeAccountId }
    );
    await db.from('payments').update({ stripe_session_id: session.id }).eq('id', payment.id);
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    await db.from('payments').update({ status: 'failed' }).eq('id', payment.id);
    return NextResponse.json({ error: 'Card payment could not be started. Please try again.' }, { status: 502 });
  }
}
