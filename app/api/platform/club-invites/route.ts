import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/supabase/server-auth';
import { isUuid } from '@/lib/ids';
import { sendEmail } from '@/lib/email/send';
import { clubAdminInvite } from '@/lib/email/templates';
import { SITE_URL } from '@/lib/slugs';

// Mission Control invites any email to own or run a club, without joining it (migration 20261160).
//   POST { action: 'invite', clubId, email, role: 'owner' | 'admin', keepOldOwner }
//   POST { action: 'resend', inviteId }
// Makes the link's random token here, hands it to the database (which stores only its hash),
// and emails the link. Operators and Super admins only; runs as the signed-in admin so the
// database checks and the audit log apply. Cancelling is a plain RPC from the club drawer.

const newToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');

const expiresOn = () =>
  new Date(Date.now() + 7 * 86400000).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Australia/Sydney' });

export async function POST(req: NextRequest) {
  const auth = await requirePlatformAdmin(req, true);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => null);
  const action = body?.action === 'resend' ? 'resend' : 'invite';
  const token = newToken();

  let clubId: string;
  let email: string;
  let role: 'owner' | 'admin';

  if (action === 'invite') {
    clubId = typeof body?.clubId === 'string' && isUuid(body.clubId) ? body.clubId : '';
    email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    role = body?.role === 'owner' ? 'owner' : 'admin';
    if (!clubId) return NextResponse.json({ error: 'Missing club.' }, { status: 400 });
    if (!email) return NextResponse.json({ error: 'Type their email address.' }, { status: 400 });

    const { data, error } = await auth.supabase.rpc('platform_invite_club_admin', {
      p_club_id: clubId,
      p_email: email,
      p_role: role,
      p_keep_old_owner: body?.keepOldOwner !== false,
      p_token: token,
    });
    if (error) {
      const missing = /function .* does not exist|Could not find the function/i.test(error.message);
      return NextResponse.json({ error: missing ? 'Run migration 20261160_club_admin_invites.sql first.' : error.message }, { status: missing ? 500 : 400 });
    }
    const row = (Array.isArray(data) ? data[0] : data) as { status: string; invite_id: string | null } | null;
    // An approved member was made Club Admin straight away: nothing to email
    if (row?.status === 'applied') return NextResponse.json({ ok: true, status: 'applied' });
  } else {
    const inviteId = typeof body?.inviteId === 'string' && isUuid(body.inviteId) ? body.inviteId : '';
    if (!inviteId) return NextResponse.json({ error: 'Missing invite.' }, { status: 400 });
    const { data, error } = await auth.supabase.rpc('platform_resend_club_admin_invite', { p_invite_id: inviteId, p_token: token });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const row = (Array.isArray(data) ? data[0] : data) as { club_id: string; email: string; role: 'owner' | 'admin' } | null;
    if (!row) return NextResponse.json({ error: 'Invite not found.' }, { status: 404 });
    ({ club_id: clubId, email, role } = row);
  }

  const { data: club } = await auth.supabase.from('clubs').select('name').eq('id', clubId).maybeSingle();
  const message = clubAdminInvite({
    clubName: club?.name || 'your club',
    role,
    email,
    link: `${SITE_URL}/invite/${token}`,
    expires: expiresOn(),
  });
  const sent = await sendEmail({ to: email, ...message, ...(auth.confirmedEmail ? { replyTo: auth.confirmedEmail } : {}) });
  if (!sent.ok) {
    console.error('[platform/club-invites] send failed:', sent.error);
    // The invite is saved; Resend from the drawer tries the email again with a new link
    return NextResponse.json({ ok: true, status: 'invited', emailed: false, error: 'The invite is saved, but the email could not be sent. Press Resend to try again.' }, { status: 502 });
  }
  return NextResponse.json({ ok: true, status: 'invited', emailed: true });
}
