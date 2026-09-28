import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { verifyWebhook } from '@/lib/email/webhook';
import { authEmail, type AuthAction } from '@/lib/email/templates';
import { clubForUrl, clubBrand } from '@/lib/email/club-brand';
import { sendEmail } from '@/lib/email/send';

// Supabase Auth "Send Email" hook: Supabase calls this instead of sending its own email, and we
// send a branded one through Resend. Set up in Supabase -> Authentication -> Hooks (see docs/email.md).

interface HookPayload {
  user: { email?: string; new_email?: string };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: AuthAction;
    site_url: string;
  };
}

const ACTIONS = new Set<AuthAction>(['signup', 'magiclink', 'recovery', 'invite', 'email_change', 'email', 'reauthentication']);

// Supabase shows the failure message to the user who asked for the email
const fail = (status: number, message: string) => NextResponse.json({ error: { http_code: status, message } }, { status });

export async function POST(req: NextRequest) {
  const secret = process.env.SEND_EMAIL_HOOK_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!secret || !supabaseUrl || !process.env.RESEND_API_KEY) {
    const missing = [!secret && 'SEND_EMAIL_HOOK_SECRET', !supabaseUrl && 'NEXT_PUBLIC_SUPABASE_URL', !process.env.RESEND_API_KEY && 'RESEND_API_KEY'].filter(Boolean);
    return NextResponse.json({ error: { http_code: 503, message: 'Email is not configured' }, missing }, { status: 503 });
  }

  const body = await req.text();
  const valid = await verifyWebhook(secret, {
    id: req.headers.get('webhook-id'),
    timestamp: req.headers.get('webhook-timestamp'),
    signature: req.headers.get('webhook-signature'),
  }, body);
  if (!valid) return fail(401, 'Invalid signature');

  let payload: HookPayload;
  try {
    payload = JSON.parse(body);
  } catch {
    return fail(400, 'Invalid payload');
  }
  const to = payload.user?.email;
  const data = payload.email_data;
  if (!to || !data || !ACTIONS.has(data.email_action_type)) return fail(400, 'Unsupported email');

  const redirectTo = data.redirect_to || data.site_url;
  const link = `${supabaseUrl.replace(/\/+$/, '')}/auth/v1/verify?token=${encodeURIComponent(data.token_hash)}&type=${encodeURIComponent(data.email_action_type)}&redirect_to=${encodeURIComponent(redirectTo)}`;

  // Member sign-in links point back at the club's own page: brand those emails as the club
  const db = getServiceClient();
  const club = db && redirectTo ? await clubForUrl(db, redirectTo).catch(() => null) : null;
  const brand = club ? clubBrand(club) : undefined;

  const email = authEmail(data.email_action_type, link, data.token, brand);
  const sent = await sendEmail({ to, ...email, fromName: brand?.name });
  if (!sent.ok) {
    console.error('[email-hook] send failed:', sent.error);
    return fail(502, 'We could not send the email right now. Please try again in a minute.');
  }
  return NextResponse.json({});
}
