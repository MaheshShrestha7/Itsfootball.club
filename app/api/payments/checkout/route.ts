import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { getServiceClient } from '@/lib/supabase/service';
import { preparePayment, readPaymentInput } from '@/lib/payments-server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

// Starts a hosted Stripe Checkout on the club's connected account. The webhook completes it.
export async function POST(req: NextRequest) {
  if (!rateLimit(`checkout:${getClientIp(req.headers)}`, 10, 10 * 60 * 1000).allowed) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes.' }, { status: 429 });
  }
  const stripe = getStripe();
  const db = getServiceClient();
  if (!stripe || !db) return NextResponse.json({ error: 'Card payments are not available right now.' }, { status: 503 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });

  const prepared = await preparePayment(db, readPaymentInput(k => (body as Record<string, unknown>)[k]));
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
  const path = draft.row.kind === 'sponsorship' ? `/${draft.club.slug}/sponsor` : `/${draft.club.slug}/member`;
  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        line_items: [{
          quantity: 1,
          price_data: {
            currency: draft.currency.toLowerCase(),
            unit_amount: draft.row.amount_cents,
            product_data: { name: draft.label },
          },
        }],
        customer_email: draft.row.payer_email || undefined,
        client_reference_id: payment.id,
        metadata: { payment_id: payment.id },
        payment_intent_data: { metadata: { payment_id: payment.id } },
        success_url: `${origin}${path}?payment=success`,
        cancel_url: `${origin}${path}?payment=cancelled`,
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
