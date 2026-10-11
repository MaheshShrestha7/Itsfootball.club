import { NextRequest, NextResponse } from 'next/server';
import { requireClubPerm } from '@/lib/supabase/server-auth';
import { getServiceClient } from '@/lib/supabase/service';
import { durableRateLimit, getClientIp } from '@/lib/rate-limit';
import { CLUB_BRAND_COLUMNS, clubBaseUrl, clubBrand, type ClubBrandRow } from '@/lib/email/club-brand';
import { sendClubEmails, looksLikeEmail } from '@/lib/email/club-emails';
import { applicationApproved, applicationReceived, applicationRejected } from '@/lib/email/templates';
import { isUuid } from '@/lib/ids';

// Emails an applicant about their membership application. The email always matches what the
// database says (the row's status), never what the caller claims, and goes to the row's own email.
//   POST { clubId, memberId, kind: 'applied' }    anyone, within an hour of applying (the applicant
//                                                 is signed out; only they know the new row's id)
//   POST { clubId, memberId, kind: 'approved' | 'rejected' }   club admins with Member Approvals
// Each email goes out once per application (email_log), however often this is called.

const KINDS = { applied: 'pending', approved: 'approved', rejected: 'rejected' } as const;
type Kind = keyof typeof KINDS;
const APPLY_WINDOW_MS = 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const kind = body?.kind as Kind;
  if (!isUuid(body?.clubId) || !isUuid(body?.memberId) || !(kind in KINDS)) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  if (kind === 'applied') {
    if (!(await durableRateLimit(`application-email:${getClientIp(req.headers)}`, 10, 60 * 60 * 1000))) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
    }
  } else {
    const auth = await requireClubPerm(req, body.clubId, ['members'], 'edit');
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const db = getServiceClient();
  if (!db || !process.env.RESEND_API_KEY) return NextResponse.json({ sent: false, error: 'Email is not set up.' }, { status: 503 });

  const [{ data: club }, { data: member }] = await Promise.all([
    db.from('clubs').select(CLUB_BRAND_COLUMNS).eq('id', body.clubId).maybeSingle(),
    db.from('club_members')
      .select('id, full_name, email, membership_tier, membership_status, rejection_reason, applied_at, reviewed_at')
      .eq('club_id', body.clubId).eq('id', body.memberId).maybeSingle(),
  ]);
  if (!club || !member) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  if (member.membership_status !== KINDS[kind]) {
    return NextResponse.json({ sent: false, error: 'The application is not in that state.' }, { status: 409 });
  }
  if (!looksLikeEmail(member.email)) return NextResponse.json({ sent: false, error: 'No email address.' }, { status: 400 });
  if (kind === 'applied' && !(member.applied_at && Date.now() - new Date(member.applied_at).getTime() < APPLY_WINDOW_MS)) {
    return NextResponse.json({ sent: false, error: 'Too late to send.' }, { status: 409 });
  }

  const row = club as ClubBrandRow;
  const brand = clubBrand(row);
  const link = `${clubBaseUrl(row)}/member`;
  const tier = member.membership_tier || 'Membership';
  let email;
  if (kind === 'applied') {
    const { data: plan } = await db.from('membership_plans').select('price_cents')
      .eq('club_id', row.id).eq('name', tier).eq('is_active', true).maybeSingle();
    email = applicationReceived({ brand, memberName: member.full_name, tier, link, payable: (plan?.price_cents || 0) > 0 });
  } else if (kind === 'approved') {
    email = applicationApproved({ brand, memberName: member.full_name, tier, link });
  } else {
    email = applicationRejected({ brand, memberName: member.full_name, tier, reason: member.rejection_reason, link });
  }

  // Keyed on the application round, so applying again after a rejection gets fresh emails
  const round = (kind === 'applied' ? member.applied_at : member.reviewed_at) || '';
  const report = await sendClubEmails(db, [{
    key: `member_${kind}:${member.id}:${round}`,
    clubId: row.id,
    kind: `member_${kind}`,
    refId: member.id,
    to: member.email,
    fromName: row.name,
    email,
  }]);
  if (report.error && !report.sent) {
    console.error('[application-email] failed:', report.error);
    return NextResponse.json({ sent: false, error: 'Sending failed.' }, { status: 502 });
  }
  return NextResponse.json({ sent: report.sent > 0, alreadySent: report.alreadySent > 0 });
}
