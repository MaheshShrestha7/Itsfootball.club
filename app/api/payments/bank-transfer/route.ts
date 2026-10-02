import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { preparePayment, readPaymentInput } from '@/lib/payments-server';
import { storeReceipt, MAX_RECEIPT_SIZE } from '@/lib/storage/receipts';
import { durableRateLimit, getClientIp } from '@/lib/rate-limit';
import { requireUser } from '@/lib/supabase/server-auth';

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

  // Renewals need the member's own session (see preparePayment)
  const payer = await requireUser(req);
  const prepared = await preparePayment(db, readPaymentInput(k => form.get(k)), payer.ok ? payer.userId : null);
  if (!prepared.ok) return NextResponse.json({ error: prepared.error }, { status: prepared.status });
  const { row } = prepared.draft;

  // Shop orders are card only: a receipt per order would be unbounded admin work and storage
  if (row.kind === 'shop_order') return NextResponse.json({ error: 'Shop orders are paid by card.' }, { status: 400 });

  // One receipt waiting per membership / sponsorship is enough
  let pending = db.from('payments').select('id').eq('club_id', row.club_id).eq('kind', row.kind).eq('status', 'awaiting_review');
  pending = row.member_id ? pending.eq('member_id', row.member_id) : pending.eq('sponsor_id', row.sponsor_id!);
  const { data: existing } = await pending.limit(1);
  if (existing?.length) {
    return NextResponse.json({ error: 'A receipt is already waiting for the club to check it.' }, { status: 409 });
  }

  const file = form.get('receipt');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Attach a photo or PDF of your receipt.' }, { status: 400 });
  const stored = await storeReceipt(row.club_id, file);
  if (!stored.ok) return NextResponse.json({ error: stored.error }, { status: stored.status });

  const reference = String(form.get('reference') || '').replace(/[<>]/g, '').trim().slice(0, 64) || null;
  const { error } = await db.from('payments').insert({
    ...row,
    method: 'bank_transfer',
    status: 'awaiting_review',
    receipt_key: stored.key,
    reference,
  });
  if (error) return NextResponse.json({ error: 'Could not save your receipt. Please try again.' }, { status: 500 });
  return NextResponse.json({ success: true });
}
