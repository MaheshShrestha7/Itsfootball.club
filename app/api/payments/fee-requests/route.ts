import { NextRequest, NextResponse } from 'next/server';
import { requireClubPerm } from '@/lib/supabase/server-auth';
import { getServiceClient } from '@/lib/supabase/service';
import { durableRateLimit } from '@/lib/rate-limit';
import { memberRecipient, MEMBER_RECIPIENT_COLUMNS } from '@/lib/email/recipient';
import { BILL_COLUMNS, emailBills, type BillRow } from '@/lib/email/fee-requests';
import { parseFeeRequest } from '@/lib/fee-requests';
import { isUuid } from '@/lib/ids';
import { siteToday } from '@/lib/member-prices';

// Sends a fee request: one bill per person, then an email to each.
//   POST { clubId, title, amountCents, dueOn, category, message?, memberIds[] }   finance editors
// Bills are written with the service role so the amount, currency and people come from here and the
// club's own records, never from what the browser says about them.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!isUuid(body?.clubId)) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  const clubId: string = body.clubId;

  const auth = await requireClubPerm(req, clubId, ['finance'], 'edit');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = parseFeeRequest(body, siteToday());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { title, amountCents, dueOn, category, message, memberIds } = parsed.value;

  if (!(await durableRateLimit(`fee-request:${clubId}`, 30, 60 * 60 * 1000))) {
    return NextResponse.json({ error: 'That\'s a lot of requests in an hour. Please wait a little.' }, { status: 429 });
  }
  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: 'Fee requests are not available right now.' }, { status: 503 });

  // In chunks: the ids travel in the request URL
  const people: { id: string; status: string | null; full_name: string; email: string | null; guardian_name: string | null; guardian_email: string | null }[] = [];
  for (let i = 0; i < memberIds.length; i += 100) {
    const { data, error } = await db.from('club_members').select(`id, status, ${MEMBER_RECIPIENT_COLUMNS}`).eq('club_id', clubId).in('id', memberIds.slice(i, i + 100));
    if (error) return NextResponse.json({ error: 'Could not read those people. Please try again.' }, { status: 500 });
    people.push(...(data || []));
  }
  const billable = people.filter(m => m.status !== 'alumni');
  if (!billable.length) return NextResponse.json({ error: 'Nobody on that list is a current member of this club.' }, { status: 400 });

  const { data: settings } = await db.from('club_payment_settings').select('currency').eq('club_id', clubId).maybeSingle();
  const requestId = crypto.randomUUID();
  const { data: rows, error } = await db.from('payments').insert(billable.map(m => {
    const recipient = memberRecipient(m);
    return {
      club_id: clubId, kind: 'fee_request', category,
      member_id: m.id,
      request_id: requestId,
      request_title: title,
      description: `${title} (${m.full_name})`,
      amount_cents: amountCents,
      currency: settings?.currency || 'AUD',
      method: 'bank_transfer', status: 'pending',
      due_on: dueOn,
      // Juniors' fees are paid by their parent or guardian
      payer_name: recipient?.name || m.full_name,
      payer_email: recipient?.to || null,
    };
  })).select(BILL_COLUMNS);
  if (error || !rows) {
    console.error('[fee-requests] create:', error?.message);
    return NextResponse.json({ error: 'The request could not be saved. Please try again.' }, { status: 500 });
  }

  const report = await emailBills(db, clubId, rows as unknown as BillRow[], { reminder: false, message });
  return NextResponse.json({ requestId, count: rows.length, ...report });
}
