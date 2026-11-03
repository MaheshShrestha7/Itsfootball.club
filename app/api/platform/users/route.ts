import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/supabase/server-auth';
import { getServiceClient } from '@/lib/supabase/service';
import { isUuid } from '@/lib/ids';
import { SITE_URL } from '@/lib/slugs';
import { authEmail } from '@/lib/email/templates';
import { sendEmail } from '@/lib/email/send';
import { looksLikeEmail } from '@/lib/email/club-emails';
import { deleteAccount } from '@/lib/account-delete';

// Mission Control -> People: fix someone's account (components/admin/platform/AccountActions.tsx).
//   GET  ?id=<user id>                           sign-in status: confirmed, blocked, two-step, clubs owned
//   POST { userId, action, email? }              Operators and Super admins
//     action: signin_link | password_reset | reset_2fa | sign_out | change_email | block | unblock | delete
// Uses the service role (Supabase admin API), so each action is written to admin_audit_log here.
// Platform admins' own accounts can't be blocked, deleted, moved or stripped of two-step from here.

const ACTIONS = new Set(['signin_link', 'password_reset', 'reset_2fa', 'sign_out', 'change_email', 'block', 'unblock', 'delete']);
const GUARDED = new Set(['reset_2fa', 'change_email', 'block', 'delete']);
const BAN_FOREVER = '876000h'; // 100 years

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

export async function GET(req: NextRequest) {
  const auth = await requirePlatformAdmin(req);
  if (!auth.ok) return json({ error: auth.error }, auth.status);
  const id = req.nextUrl.searchParams.get('id') || '';
  if (!isUuid(id)) return json({ error: 'Missing account.' }, 400);
  const db = getServiceClient();
  if (!db) return json({ error: 'Account tools are not configured on the server.' }, 503);

  const [{ data: u, error }, factors, { data: owned }] = await Promise.all([
    db.auth.admin.getUserById(id),
    db.auth.admin.mfa.listFactors({ userId: id }),
    db.from('clubs').select('id, name, slug').eq('owner_id', id),
  ]);
  if (error || !u.user) return json({ error: 'Account not found.' }, 404);
  const banned = u.user.banned_until ? new Date(u.user.banned_until).getTime() > Date.now() : false;
  return json({
    email: u.user.email,
    email_confirmed_at: u.user.email_confirmed_at || null,
    last_sign_in_at: u.user.last_sign_in_at || null,
    banned,
    two_step: (factors.data?.factors || []).filter(f => f.status === 'verified').length,
    owned: owned || [],
  });
}

export async function POST(req: NextRequest) {
  const auth = await requirePlatformAdmin(req, true);
  if (!auth.ok) return json({ error: auth.error }, auth.status);
  const db = getServiceClient();
  if (!db) return json({ error: 'Account tools are not configured on the server.' }, 503);

  const input = await req.json().catch(() => null);
  const userId: string = isUuid(input?.userId) ? input.userId : '';
  const action: string = ACTIONS.has(input?.action) ? input.action : '';
  if (!userId || !action) return json({ error: 'Missing account or action.' }, 400);

  const { data: target, error: lookupError } = await db.auth.admin.getUserById(userId);
  const user = target?.user;
  if (lookupError || !user) return json({ error: 'Account not found.' }, 404);
  const email = user.email || '';

  if (GUARDED.has(action)) {
    if (userId === auth.userId) return json({ error: 'Use your own account settings for that.' }, 400);
    const { data: admins } = await db.from('platform_admins').select('user_id, email').eq('is_active', true);
    if ((admins || []).some(a => a.user_id === userId || (a.email || '').toLowerCase() === email.toLowerCase())) {
      return json({ error: 'That is a platform admin. Remove them from Manage admins first.' }, 400);
    }
  }

  const audit = (summary: string, details: Record<string, unknown> = {}) =>
    db.from('admin_audit_log').insert({
      club_id: null, actor_id: auth.userId, actor_email: auth.confirmedEmail || null,
      action: `user_${action}`, target_table: 'auth.users', target_id: userId, summary: summary.slice(0, 300), details,
    }).then(({ error }) => { if (error) console.error('[platform/users] audit failed:', error.message); });

  switch (action) {
    case 'signin_link':
    case 'password_reset': {
      if (!email) return json({ error: 'This account has no email.' }, 400);
      const type = action === 'signin_link' ? 'magiclink' : 'recovery';
      const redirectTo = `${SITE_URL}${type === 'recovery' ? '/auth/reset' : '/my-clubs'}`;
      const { data, error } = await db.auth.admin.generateLink({ type, email, options: { redirectTo } });
      if (error || !data.properties) return json({ error: error?.message || 'Could not make the link.' }, 500);
      const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
      const link = `${supabaseUrl}/auth/v1/verify?token=${encodeURIComponent(data.properties.hashed_token)}&type=${type}&redirect_to=${encodeURIComponent(redirectTo)}`;
      const sent = await sendEmail({ to: email, ...authEmail(type, link, data.properties.email_otp) });
      if (!sent.ok) return json({ error: 'The email could not be sent. Please try again.' }, 502);
      await audit(`${type === 'recovery' ? 'Sent a password reset' : 'Sent a sign-in link'} to ${email}`);
      return json({ ok: true, message: `Sent to ${email}` });
    }

    case 'reset_2fa': {
      const { data, error } = await db.auth.admin.mfa.listFactors({ userId });
      if (error) return json({ error: error.message }, 500);
      const factors = data?.factors || [];
      for (const f of factors) {
        const { error: delError } = await db.auth.admin.mfa.deleteFactor({ id: f.id, userId });
        if (delError) return json({ error: delError.message }, 500);
      }
      await audit(`Reset two-step sign-in for ${email}`, { removed: factors.length });
      return json({ ok: true, message: factors.length ? 'Two-step sign-in removed. They can set it up again.' : 'They had no two-step sign-in.' });
    }

    case 'sign_out': {
      const { data, error } = await auth.supabase.rpc('platform_sign_out_user', { p_user_id: userId });
      if (error) return json({ error: 'Could not sign them out. Has migration 20261146 been run?' }, 500);
      await audit(`Signed ${email} out everywhere`, { sessions: data });
      return json({ ok: true, message: `Ended ${data ?? 0} ${data === 1 ? 'session' : 'sessions'}.` });
    }

    case 'change_email': {
      const next = typeof input?.email === 'string' ? input.email.trim().toLowerCase() : '';
      if (!looksLikeEmail(next)) return json({ error: 'Enter a valid email address.' }, 400);
      if (next === email.toLowerCase()) return json({ error: 'That is already their email.' }, 400);
      const { error } = await db.auth.admin.updateUserById(userId, { email: next, email_confirm: true });
      if (error) return json({ error: /already|registered|exists/i.test(error.message) ? 'Another account already uses that email.' : error.message }, 400);
      // Tell the old address, in case this wasn't them
      if (email) {
        await sendEmail({
          to: email,
          subject: 'Your itsfootball.club sign-in email was changed',
          text: `Hi,\n\nAt your request, itsfootball.club support changed the email you sign in with to ${next}.\n\nIf you didn't ask for this, reply to this email straight away.`,
          html: `<p>Hi,</p><p>At your request, itsfootball.club support changed the email you sign in with to <b>${next.replace(/[<>&"]/g, '')}</b>.</p><p>If you didn't ask for this, reply to this email straight away.</p>`,
          ...(process.env.SUPPORT_EMAIL ? { replyTo: process.env.SUPPORT_EMAIL } : {}),
        });
      }
      await audit(`Changed sign-in email from ${email} to ${next}`, { from: email, to: next });
      return json({ ok: true, message: `Their sign-in email is now ${next}.` });
    }

    case 'block':
    case 'unblock': {
      const { error } = await db.auth.admin.updateUserById(userId, { ban_duration: action === 'block' ? BAN_FOREVER : 'none' });
      if (error) return json({ error: error.message }, 500);
      if (action === 'block') await auth.supabase.rpc('platform_sign_out_user', { p_user_id: userId });
      await audit(`${action === 'block' ? 'Blocked' : 'Unblocked'} ${email}`);
      return json({ ok: true, message: action === 'block' ? 'Blocked and signed out.' : 'Unblocked. They can sign in again.' });
    }

    case 'delete': {
      const result = await deleteAccount(db, userId);
      if (!result.ok && result.status === 409) {
        return json({ error: `They own ${result.owned.map(c => c.name).join(', ')}. Make someone else the Owner in the club console first.` }, 409);
      }
      if (!result.ok) return json({ error: result.error }, 500);
      await audit(`Deleted the account ${email}`);
      return json({ ok: true, message: 'Account deleted. Their club records stay, unlinked.' });
    }
  }
  return json({ error: 'Unknown action.' }, 400);
}
