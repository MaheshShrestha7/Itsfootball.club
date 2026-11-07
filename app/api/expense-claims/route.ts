import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server-auth';
import { getServiceClient } from '@/lib/supabase/service';
import { MAX_RECEIPT_SIZE, storeReceipt } from '@/lib/storage/receipts';
import { durableRateLimit } from '@/lib/rate-limit';
import { canClaim, parseClaim } from '@/lib/expense-claims';
import { isUuid } from '@/lib/ids';
import { siteToday } from '@/lib/member-prices';

// A member claims money back: POST multipart { clubId, description, amount, category, spentOn, vendor?,
// accountName?, bankName?, bsb?, accountNumber?, receipt }. It waits for the treasurer and is not in the club's books until approved.
export async function POST(req: NextRequest) {
  if (Number(req.headers.get('content-length') || 0) > MAX_RECEIPT_SIZE + 512 * 1024) {
    return NextResponse.json({ error: 'Receipt must be 5 MB or smaller.' }, { status: 413 });
  }
  const auth = await requireUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!(await durableRateLimit(`expense-claim:${auth.userId}`, 20, 60 * 60 * 1000))) {
    return NextResponse.json({ error: 'That\'s a lot of claims in an hour. Please wait a little.' }, { status: 429 });
  }

  const form = await req.formData().catch(() => null);
  const clubId = form?.get('clubId');
  if (!form || !isUuid(clubId)) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  const parsed = parseClaim(k => form.get(k), siteToday());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const file = form.get('receipt');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Attach a photo or PDF of the receipt.' }, { status: 400 });

  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: 'Claims are not available right now.' }, { status: 503 });

  // The member comes from the session, so nobody can claim as someone else
  const [{ data: records }, { data: settings }] = await Promise.all([
    db.from('club_members').select('id, full_name, email, membership_status, status').eq('club_id', clubId).eq('user_id', auth.userId),
    db.from('club_payment_settings').select('currency').eq('club_id', clubId).maybeSingle(),
  ]);
  const member = (records || []).find(canClaim);
  if (!member) return NextResponse.json({ error: 'Only current members of this club can send it an expense claim.' }, { status: 403 });

  const stored = await storeReceipt(clubId, file);
  if (!stored.ok) return NextResponse.json({ error: stored.error }, { status: stored.status });

  const { value } = parsed;
  const { error } = await db.from('expense_claims').insert({
    club_id: clubId, member_id: member.id, submitted_by: auth.userId,
    claimant_name: member.full_name, claimant_email: auth.confirmedEmail || member.email || null,
    category: value.category, description: value.description, vendor: value.vendor,
    amount_cents: value.amountCents, currency: settings?.currency || 'AUD', spent_on: value.spentOn,
    receipt_key: stored.key, payout_details: value.payoutDetails,
  });
  if (error) {
    console.error('[expense-claims] create:', error.message);
    return NextResponse.json({ error: 'Your claim could not be saved. Please try again.' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
