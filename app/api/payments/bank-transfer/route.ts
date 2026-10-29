import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { preparePayment, readPaymentInput } from '@/lib/payments-server';
import { storeReceipt, MAX_RECEIPT_SIZE } from '@/lib/storage/receipts';
import { durableRateLimit, getClientIp } from '@/lib/rate-limit';
import { requireUser } from '@/lib/supabase/server-auth';
import { TURNSTILE_FAILED, verifyTurnstile } from '@/lib/turnstile-server';

// Records a bank transfer with the payer's receipt (photo or PDF) for an admin to verify.
export async function POST(req: NextRequest) {
  if (!(await durableRateLimit(`bank-transfer:${getClientIp(req.headers)}`, 5, 10 * 60 * 1000))) {
    return NextResponse.json({ error: 'Too many uploads. Please wait a few minutes.' }, { status: 429 });
  }
  if (Number(req.headers.get('content-length') || 0) > MAX_RECEIPT_SIZE + 512 * 1024) {
    return NextResponse.json({ error: 'Receipt must be 5 MB or smaller.' }, { status: 413 });
  }
  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: 'Payments are not available right now.' }, { status: 503 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });

  // Renewals need the member's own session, or their guardian's (see preparePayment)
  const payer = await requireUser(req);
  // Signed-out buyers (event tickets, sponsors) pass the bot check before a receipt is stored
  if (!payer.ok && !(await verifyTurnstile(form.get('captchaToken'), getClientIp(req.headers)))) {
    return NextResponse.json({ error: TURNSTILE_FAILED }, { status: 400 });
  }
  const prepared = await preparePayment(db, readPaymentInput(k => form.get(k)), payer.ok ? payer.userId : null, payer.ok ? payer.confirmedEmail ?? null : null);
  if (!prepared.ok) return NextResponse.json({ error: prepared.error }, { status: prepared.status });
  const { row } = prepared.draft;

  // Shop orders are card only: a receipt per order would be unbounded admin work and storage.
  // Tickets can be paid by transfer (so clubs without card payments can still sell them); they're
  // issued when the club verifies the receipt.
  if (row.kind === 'shop_order') {
    return NextResponse.json({ error: 'This is paid by card.' }, { status: 400 });
  }

  // One receipt waiting per membership / sponsorship, or per buyer per event, is enough
  let pending = db.from('payments').select('id').eq('club_id', row.club_id).eq('kind', row.kind).eq('status', 'awaiting_review');
  pending = row.kind === 'event_ticket' ? pending.eq('event_id', row.event_id!).eq('payer_email', row.payer_email!)
    : row.member_id ? pending.eq('member_id', row.member_id) : pending.eq('sponsor_id', row.sponsor_id!);
  const { data: existing } = await pending.limit(1);
  if (existing?.length) {
    return NextResponse.json({ error: 'A receipt is already waiting for the club to check it.' }, { status: 409 });
  }

  const file = form.get('receipt');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Attach a photo or PDF of your receipt.' }, { status: 400 });
  const stored = await storeReceipt(row.club_id, file);
  if (!stored.ok) return NextResponse.json({ error: stored.error }, { status: stored.status });

  const reference = String(form.get('reference') || '').replace(/[<>]/g, '').trim().slice(0, 64) || null;
  const receipt = { method: 'bank_transfer', status: 'awaiting_review', receipt_key: stored.key, reference };
  // SPP-2: a receipt for an invoice the club sent goes on that invoice, so its number stays the same
  const { error } = prepared.draft.invoiceId
    ? await db.from('payments').update(receipt).eq('id', prepared.draft.invoiceId).eq('status', 'pending')
    : await db.from('payments').insert({ ...row, ...receipt });
  if (error) return NextResponse.json({ error: 'Could not save your receipt. Please try again.' }, { status: 500 });
  return NextResponse.json({ success: true });
}
