import { NextRequest, NextResponse } from 'next/server';
import { getStripe, Stripe } from '@/lib/stripe';
import { getServiceClient } from '@/lib/supabase/service';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CLUB_BRAND_COLUMNS, clubBaseUrl, clubBrand, type ClubBrandRow } from '@/lib/email/club-brand';
import { formatWhen } from '@/lib/email/format';
import { sendEmail } from '@/lib/email/send';
import { ticketsEmail } from '@/lib/email/templates';
import type { Payment } from '@/lib/supabase/types';

/** Emails the buyer the link to their tickets. Stripe retries this webhook, so Resend dedupes by order id. */
async function emailTickets(db: SupabaseClient, pay: Payment) {
  if (!pay.payer_email || !pay.event_id) return;
  const [{ data: club }, { data: event }] = await Promise.all([
    db.from('clubs').select(CLUB_BRAND_COLUMNS).eq('id', pay.club_id).maybeSingle(),
    db.from('events').select('title, start_time, location').eq('id', pay.event_id).maybeSingle(),
  ]);
  if (!club || !event) return;
  const quantity = (pay.items || []).reduce((n, i) => n + i.quantity, 0) || 1;
  const email = ticketsEmail({
    brand: clubBrand(club as ClubBrandRow),
    buyerName: pay.payer_name || '',
    event: event.title,
    quantity,
    when: formatWhen(event.start_time),
    venue: event.location,
    link: `${clubBaseUrl(club as ClubBrandRow)}/tickets/${pay.id}`,
  });
  const sent = await sendEmail({ ...email, to: pay.payer_email, fromName: (club as ClubBrandRow).name, idempotencyKey: `tickets-${pay.id}` });
  // Logged, not retried: the buyer already landed on the tickets page after paying
  if (!sent.ok) console.error('Tickets email failed:', pay.id, sent.error);
}

// Connect webhook: receives events from every club's connected Stripe account.
// Payments are matched on the Checkout Session id we stored, never on metadata, because a club
// admin can create their own sessions (with any metadata) on their own account.
export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const db = getServiceClient();
  const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  if (!stripe || !db || !secret) {
    // Names only (never values), and only in the server log: callers learn nothing about the setup
    const missing = [
      !stripe && 'STRIPE_SECRET_KEY',
      !secret && 'STRIPE_CONNECT_WEBHOOK_SECRET',
      !db && (process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SUPABASE_SECRET_KEY' : 'NEXT_PUBLIC_SUPABASE_URL'),
    ].filter(Boolean);
    console.error('[stripe-webhook] not configured, missing:', missing.join(', '));
    return NextResponse.json({ error: 'Not configured' }, { status: 503 });
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
      const { data: paid, error } = await db.rpc('fulfil_payment', { p_payment_id: payment.id });
      if (error) {
        console.error('fulfil_payment failed:', error.message);
        return NextResponse.json({ error: 'Fulfilment failed' }, { status: 500 }); // Stripe retries
      }
      if ((paid as Payment | null)?.kind === 'event_ticket' && (paid as Payment).status === 'paid') await emailTickets(db, paid as Payment);
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
        const { data: refunded } = await db.from('payments').update({ status: 'refunded' }).eq('stripe_payment_intent_id', intent).select('id');
        // A club refunding from its own dashboard pays back the whole charge, booking fee included, but Stripe
        // keeps our fee on the platform. Hand it back so a full refund never costs the club money.
        // ponytail: full refunds only; partial refunds keep the fee (add a proportional fee refund if clubs ask)
        const feeId = typeof charge.application_fee === 'string' ? charge.application_fee : charge.application_fee?.id;
        if (feeId && refunded?.length) {
          // Logged, not retried: it also fails harmlessly when the fee was already refunded
          await stripe.applicationFees.createRefund(feeId).catch(err => console.error('Booking fee refund failed:', feeId, (err as Error).message));
        }
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
