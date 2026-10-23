import { NextRequest, NextResponse } from 'next/server';
import { requireClubPerm } from '@/lib/supabase/server-auth';
import { getServiceClient } from '@/lib/supabase/service';
import { CLUB_BRAND_COLUMNS, clubBrand, type ClubBrandRow } from '@/lib/email/club-brand';
import { sendClubEmails, looksLikeEmail } from '@/lib/email/club-emails';
import { inquiryReply } from '@/lib/email/templates';
import { isUuid } from '@/lib/ids';

// Replies to a contact-form enquiry from the Inbox (migration 20261119).
//   POST { clubId, inquiryId, body, senderName }   club admins who can edit the Inbox
// The reply is always saved to the enquiry's history, then emailed to the enquirer when email is
// set up (replies go to the club's contact email). `emailed: false` tells the admin to send it
// themselves.

const clean = (s: unknown, max: number) => (typeof s === 'string' ? s.replace(/[<>]/g, '').trim().slice(0, max) : '');

export async function POST(req: NextRequest) {
  const input = await req.json().catch(() => null);
  const text = typeof input?.body === 'string' ? input.body.replace(/[<>]/g, '').trim() : '';
  if (!isUuid(input?.clubId) || !isUuid(input?.inquiryId) || !text) {
    return NextResponse.json({ error: 'Write a reply first.' }, { status: 400 });
  }
  if (text.length > 4000) return NextResponse.json({ error: 'The reply is too long (4000 characters maximum).' }, { status: 400 });

  const auth = await requireClubPerm(req, input.clubId, ['inquiries'], 'edit');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: 'Replies cannot be saved right now.' }, { status: 503 });

  const [{ data: inquiry }, { data: club }] = await Promise.all([
    db.from('contact_inquiries').select('id, club_id, sender_name, sender_email, inquiry_type, message')
      .eq('id', input.inquiryId).eq('club_id', input.clubId).maybeSingle(),
    db.from('clubs').select(`${CLUB_BRAND_COLUMNS}, contact_email`).eq('id', input.clubId).maybeSingle(),
  ]);
  if (!inquiry || !club) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const { data: reply, error } = await db.from('contact_inquiry_replies').insert({
    inquiry_id: inquiry.id,
    club_id: inquiry.club_id,
    body: text,
    sent_by_name: clean(input.senderName, 255) || null,
    sent_by_user: auth.userId,
  }).select('*').single();
  if (error || !reply) {
    console.error('[inquiry-reply] save failed:', error?.message);
    return NextResponse.json({ error: 'The reply could not be saved.' }, { status: 500 });
  }
  await db.from('contact_inquiries').update({ status: 'replied' }).eq('id', inquiry.id);

  let emailed = false;
  if (process.env.RESEND_API_KEY && looksLikeEmail(inquiry.sender_email)) {
    const row = club as ClubBrandRow & { contact_email?: string | null };
    const replyTo = looksLikeEmail(row.contact_email) ? row.contact_email.trim() : undefined;
    const report = await sendClubEmails(db, [{
      key: `inquiry_reply:${reply.id}`,
      clubId: row.id,
      kind: 'inquiry_reply',
      refId: inquiry.id,
      to: inquiry.sender_email.trim(),
      fromName: row.name,
      replyTo,
      email: inquiryReply({
        brand: clubBrand(row),
        senderName: inquiry.sender_name,
        reply: text,
        inquiryType: inquiry.inquiry_type || 'General Inquiry',
        original: inquiry.message || '',
        canReply: !!replyTo,
      }),
    }]);
    emailed = report.sent > 0;
    if (emailed) {
      await db.from('contact_inquiry_replies').update({ emailed: true }).eq('id', reply.id);
      reply.emailed = true;
    } else if (report.error) {
      console.error('[inquiry-reply] email failed:', report.error);
    }
  }

  return NextResponse.json({ reply, emailed });
}
