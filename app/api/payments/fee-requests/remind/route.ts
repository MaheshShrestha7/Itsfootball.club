import { NextRequest, NextResponse } from 'next/server';
import { requireClubPerm } from '@/lib/supabase/server-auth';
import { getServiceClient } from '@/lib/supabase/service';
import { durableRateLimit } from '@/lib/rate-limit';
import { BILL_COLUMNS, emailBills, type BillRow } from '@/lib/email/fee-requests';
import { isUuid } from '@/lib/ids';

// Nudges everyone who still owes on a request, at most once a day each.
//   POST { clubId, requestId }   finance editors
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!isUuid(body?.clubId) || !isUuid(body?.requestId)) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });

  const auth = await requireClubPerm(req, body.clubId, ['finance'], 'edit');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!(await durableRateLimit(`fee-remind:${body.requestId}`, 10, 60 * 60 * 1000))) {
    return NextResponse.json({ error: 'Those reminders have been sent. Try again later.' }, { status: 429 });
  }
  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: 'Reminders are not available right now.' }, { status: 503 });

  // club_id: a request id from another club finds nothing
  const { data: rows, error } = await db.from('payments').select(BILL_COLUMNS)
    .eq('club_id', body.clubId).eq('kind', 'fee_request').eq('request_id', body.requestId).eq('status', 'pending');
  if (error) return NextResponse.json({ error: 'Could not read that request. Please try again.' }, { status: 500 });
  if (!rows?.length) return NextResponse.json({ error: 'Nobody on this request still owes anything.' }, { status: 409 });

  return NextResponse.json({ count: rows.length, ...(await emailBills(db, body.clubId, rows as unknown as BillRow[], { reminder: true })) });
}
