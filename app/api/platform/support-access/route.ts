import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/supabase/server-auth';
import { isUuid } from '@/lib/ids';
import { sendEmail } from '@/lib/email/send';
import { supportAccessRequest } from '@/lib/email/templates';
import { SITE_URL } from '@/lib/slugs';

// MCF-10: a platform admin asks the club's Owner for a few hours of Club Admin access.
//   POST { clubId, hours: 2 | 24 | 72, reason? }
// The database saves the request (migration 20261177) and returns the Owner to email; the Owner
// answers on the club's Roles page. Runs as the signed-in admin so the checks and log apply.
export async function POST(req: NextRequest) {
  const auth = await requirePlatformAdmin(req, true);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => null);
  const clubId = typeof body?.clubId === 'string' && isUuid(body.clubId) ? body.clubId : '';
  const hours = Number(body?.hours);
  const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 300) : '';
  if (!clubId) return NextResponse.json({ error: 'Missing club.' }, { status: 400 });

  const { data, error } = await auth.supabase.rpc('platform_request_support_access', { p_club_id: clubId, p_hours: hours, p_reason: reason || null });
  if (error) {
    const missing = /function .* does not exist|Could not find the function/i.test(error.message);
    return NextResponse.json({ error: missing ? 'Run migration 20261177_mission_control_features.sql first.' : error.message }, { status: missing ? 500 : 400 });
  }
  const row = (Array.isArray(data) ? data[0] : data) as { owner_email: string | null; owner_name: string | null; club_name: string; club_slug: string } | null;
  if (!row?.owner_email) return NextResponse.json({ ok: true, emailed: false, error: 'Saved, but the Owner has no email address to tell them.' }, { status: 502 });

  const message = supportAccessRequest({
    ownerName: row.owner_name || 'there',
    clubName: row.club_name,
    hours,
    reason: reason || null,
    link: `${SITE_URL}/${row.club_slug}/admin/roles#support-access`,
  });
  const sent = await sendEmail({ to: row.owner_email, ...message, ...(auth.confirmedEmail ? { replyTo: auth.confirmedEmail } : {}) });
  if (!sent.ok) {
    console.error('[platform/support-access] send failed:', sent.error);
    return NextResponse.json({ ok: true, emailed: false, error: 'The request is saved, but the email to the Owner could not be sent. Tell them another way.' }, { status: 502 });
  }
  return NextResponse.json({ ok: true, emailed: true });
}
