import { NextRequest, NextResponse } from 'next/server';
import { getStripe, Stripe } from '@/lib/stripe';
import { getServiceClient } from '@/lib/supabase/service';

// Connect webhook: receives events from every club's connected Stripe account.
// Payments are matched on the Checkout Session id we stored, never on metadata, because a club
// admin can create their own sessions (with any metadata) on their own account.
export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const db = getServiceClient();
  const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  if (!stripe || !db || !secret) {
    // Names only (never values), so a misconfigured deploy says what it's missing
    const missing = [
      !stripe && 'STRIPE_SECRET_KEY',
      !secret && 'STRIPE_CONNECT_WEBHOOK_SECRET',
      !db && (process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SUPABASE_SECRET_KEY' : 'NEXT_PUBLIC_SUPABASE_URL'),
    ].filter(Boolean);
    return NextResponse.json({ error: 'Not configured', missing }, { status: 503 });
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      await req.text(),
      req.headers.get('stripe-signature') || '',
      secret,
      undefined,
      Stripe.createSubtleCryptoProvider()
    );
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status !== 'paid') break; // async methods finish later
      const intent = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null;
      const { data: payment } = await db
        .from('payments')
        .update({ stripe_payment_intent_id: intent })
        .eq('stripe_session_id', session.id)
        .select('id')
        .maybeSingle();
      if (!payment) break; // not one of ours
      const { error } = await db.rpc('fulfil_payment', { p_payment_id: payment.id });
      if (error) {
        console.error('fulfil_payment failed:', error.message);
        return NextResponse.json({ error: 'Fulfilment failed' }, { status: 500 }); // Stripe retries
      }
      break;
    }
    case 'checkout.session.async_payment_failed':
    case 'checkout.session.expired': {
      const session = event.data.object as Stripe.Checkout.Session;
      await db.from('payments').update({ status: 'failed' }).eq('stripe_session_id', session.id).eq('status', 'pending');
      break;
    }
    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge;
      const intent = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
      // Partial refunds stay 'paid'; the Stripe dashboard has the detail
      if (charge.refunded && intent) {
        await db.from('payments').update({ status: 'refunded' }).eq('stripe_payment_intent_id', intent);
      }
      break;
    }
    case 'account.updated': {
      const account = event.data.object as Stripe.Account;
      await db
        .from('club_payment_settings')
        .update({ stripe_charges_enabled: Boolean(account.charges_enabled), updated_at: new Date().toISOString() })
        .eq('stripe_account_id', account.id);
      break;
    }
  }
  return NextResponse.json({ received: true });
}
