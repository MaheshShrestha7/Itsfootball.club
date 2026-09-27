import { NextRequest, NextResponse } from 'next/server';
import { requireClubAdmin, requireAdminOfClub } from '@/lib/supabase/server-auth';
import { storeReceipt, receiptUrl, MAX_RECEIPT_SIZE } from '@/lib/storage/receipts';
import { rateLimit } from '@/lib/rate-limit';

// GET ?type=payment|expense&id=...  -> { url } short-lived link to a receipt (club admins only)
export async function GET(req: NextRequest) {
  const auth = await requireClubAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const type = req.nextUrl.searchParams.get('type');
  const id = req.nextUrl.searchParams.get('id') || '';
  const table = type === 'expense' ? 'expenses' : type === 'payment' ? 'payments' : null;
  if (!table || !id) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });

  // Read with the caller's own session: row-level security only returns rows of clubs they run
  const { data } = await auth.supabase.from(table).select('club_id, receipt_key').eq('id', id).maybeSingle();
  if (!data?.receipt_key) return NextResponse.json({ error: 'Receipt not found.' }, { status: 404 });
  const { data: isAdmin } = await auth.supabase.rpc('is_club_admin', { p_club_id: data.club_id });
  if (isAdmin !== true) return NextResponse.json({ error: 'Receipt not found.' }, { status: 404 });

  const url = await receiptUrl(data.receipt_key);
  if (!url) return NextResponse.json({ error: 'Receipt storage is not available right now.' }, { status: 503 });
  return NextResponse.json({ url });
}

// POST multipart { clubId, receipt } -> { key }  receipt upload for an expense (club admins only)
export async function POST(req: NextRequest) {
  if (Number(req.headers.get('content-length') || 0) > MAX_RECEIPT_SIZE + 512 * 1024) {
    return NextResponse.json({ error: 'Receipt must be 5 MB or smaller.' }, { status: 413 });
  }
  const form = await req.formData().catch(() => null);
  const clubId = String(form?.get('clubId') || '');
  const file = form?.get('receipt');
  if (!clubId || !(file instanceof File)) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });

  const auth = await requireAdminOfClub(req, clubId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!rateLimit(`receipt:${auth.userId}`, 30, 10 * 60 * 1000).allowed) {
    return NextResponse.json({ error: 'Too many uploads. Please wait a few minutes.' }, { status: 429 });
  }

  const stored = await storeReceipt(clubId, file);
  if (!stored.ok) return NextResponse.json({ error: stored.error }, { status: stored.status });
  return NextResponse.json({ key: stored.key });
}
