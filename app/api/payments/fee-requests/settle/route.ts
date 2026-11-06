import { NextRequest, NextResponse } from 'next/server';
import { requireClubPerm } from '@/lib/supabase/server-auth';
import { getServiceClient } from '@/lib/supabase/service';
import { getStripe } from '@/lib/stripe';
import { closeOpenCheckout } from '@/lib/payments-server';
import { canReopenFee } from '@/lib/fee-requests';
import { isUuid } from '@/lib/ids';
import type { Payment } from '@/lib/supabase/types';

// The treasurer settles bills themselves (finance editors):
//   POST { clubId, paymentId, action: 'cash' | 'excuse' | 'reopen' }    one person
//   POST { clubId, requestId, action: 'close' }                         excuse everyone still owing
// Writes go through the caller's own session, so row-level security and the audit log see who did it.
// A card checkout left open is closed first: paying it afterwards would charge someone who no longer owes.

const CHUNK = 100;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const action: string = body?.action;
  const single = ['cash', 'excuse', 'reopen'].includes(action) && isUuid(body?.paymentId);
  const whole = action === 'close' && isUuid(body?.requestId);
  if (!isUuid(body?.clubId) || (!single && !whole)) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });

  const auth = await requireClubPerm(req, body.clubId, ['finance'], 'edit');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: 'This is not available right now.' }, { status: 503 });

  let query = db.from('payments').select('id, kind, status, method, stripe_session_id').eq('club_id', body.clubId).eq('kind', 'fee_request');
  query = single ? query.eq('id', body.paymentId) : query.eq('request_id', body.requestId).eq('status', 'pending');
  const { data: rows, error: readError } = await query;
  if (readError) return NextResponse.json({ error: 'Could not read that payment. Please try again.' }, { status: 500 });
  const bills = (rows || []) as (Pick<Payment, 'id' | 'kind' | 'status' | 'method'> & { stripe_session_id: string | null })[];
  if (!bills.length) return NextResponse.json({ error: whole ? 'Nobody on this request still owes anything.' : 'Payment not found.' }, { status: whole ? 409 : 404 });

  const now = new Date().toISOString();

  if (action === 'reopen') {
    if (!canReopenFee(bills[0])) return NextResponse.json({ error: 'Only a cash payment or an excused fee can be undone here.' }, { status: 409 });
    const { error } = await auth.supabase.from('payments')
      .update({ status: 'pending', method: 'bank_transfer', paid_at: null, rejection_reason: null, reviewed_by: null, reviewed_at: null })
      .eq('id', bills[0].id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ updated: 1 });
  }

  // cash, excuse and close only ever act on someone who still owes
  const open = bills.filter(b => b.status === 'pending');
  if (!open.length) return NextResponse.json({ error: 'This has already been paid or closed.' }, { status: 409 });

  // Never touch a bill whose card payment went through a moment ago: the webhook will mark it paid
  const withCheckout = open.filter(b => b.stripe_session_id);
  const justPaid = new Set<string>();
  if (withCheckout.length) {
    const stripe = getStripe();
    const { data: settings } = await db.from('club_payment_settings').select('stripe_account_id').eq('club_id', body.clubId).maybeSingle();
    if (!stripe || !settings?.stripe_account_id) return NextResponse.json({ error: 'Card payments can\'t be reached right now. Please try again.' }, { status: 503 });
    for (const bill of withCheckout) {
      const closed = await closeOpenCheckout(stripe, bill.stripe_session_id!, settings.stripe_account_id).catch(() => null);
      if (!closed) return NextResponse.json({ error: 'Card payments can\'t be reached right now. Please try again.' }, { status: 502 });
      if (closed === 'paid') justPaid.add(bill.id);
    }
  }
  const ids = open.filter(b => !justPaid.has(b.id)).map(b => b.id);
  if (!ids.length) return NextResponse.json({ error: 'They have just paid by card. It will show here shortly.' }, { status: 409 });

  if (action === 'cash') {
    const { error: updateError } = await auth.supabase.from('payments')
      .update({ method: 'cash', stripe_session_id: null, stripe_payment_intent_id: null }).eq('id', ids[0]).eq('status', 'pending');
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    const { error } = await auth.supabase.rpc('fulfil_payment', { p_payment_id: ids[0] });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ updated: 1 });
  }

  for (let i = 0; i < ids.length; i += CHUNK) {
    const { error } = await auth.supabase.from('payments')
      .update({ status: 'rejected', stripe_session_id: null, rejection_reason: 'Excused by the club', reviewed_by: auth.userId, reviewed_at: now })
      .in('id', ids.slice(i, i + CHUNK)).eq('status', 'pending');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ updated: ids.length, stillProcessing: justPaid.size });
}
