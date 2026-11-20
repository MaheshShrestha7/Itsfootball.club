import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/supabase/server-auth';
import { sendEmail } from '@/lib/email/send';
import { SITE_URL } from '@/lib/slugs';

// Mission Control -> Manage admins (components/admin/platform/PlatformAdminsModal.tsx), MCX-5.
//   POST { email, role, invite?: boolean }   Super admins only (add_platform_admin checks, as the signed-in admin)
// Adds someone or changes their role (the function upserts on email; a trigger writes the Action log),
// then, for a new admin, emails them how to get in.

const ROLES = { super_admin: 'Super admin', operator: 'Operator', analyst: 'Analyst' } as const;
const WHAT: Record<keyof typeof ROLES, string> = {
  super_admin: 'You can do everything, including adding and removing other admins.',
  operator: 'You can suspend clubs, answer support, post broadcasts and edit grounds.',
  analyst: 'You can look at everything, but not change anything.',
};
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const auth = await requirePlatformAdmin(req, true);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const role = body?.role as keyof typeof ROLES;
  if (!EMAIL_RE.test(email) || email.length > 254) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  if (!(role in ROLES)) return NextResponse.json({ error: 'Pick Super admin, Operator or Analyst.' }, { status: 400 });

  const { error } = await auth.supabase.rpc('add_platform_admin', { p_email: email, p_role: role });
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === '42501' ? 403 : 400 });
  if (body?.invite !== true) return NextResponse.json({ ok: true, emailed: false });

  const link = `${SITE_URL}/admin/platform`;
  const text = `Hi,\n\nYou've been added to Mission Control, the itsfootball.club team's control room, as ${ROLES[role]}. ${WHAT[role]}\n\n`
    + `Sign in with this email address (${email}) at ${link}. If you don't have an account yet, sign up with this email first. `
    + `Mission Control asks for a code from an authenticator app as well as your password.\n\nAdded by ${auth.confirmedEmail || 'a Super admin'}.`;
  const esc = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
  const sent = await sendEmail({
    to: email,
    subject: 'You can now open Mission Control on itsfootball.club',
    text,
    html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;white-space:pre-wrap">${esc(text)}</div>`,
    ...(auth.confirmedEmail ? { replyTo: auth.confirmedEmail } : {}),
    log: { kind: 'platform_admin' },
  });
  if (!sent.ok) {
    console.error('[platform/admins] invite send failed:', sent.error);
    return NextResponse.json({ ok: true, emailed: false, error: 'Added, but the email could not be sent. Tell them yourself.' }, { status: 502 });
  }
  return NextResponse.json({ ok: true, emailed: true });
}
