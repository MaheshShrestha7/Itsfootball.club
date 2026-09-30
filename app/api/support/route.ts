import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOfClub } from '@/lib/supabase/server-auth';
import { rateLimit } from '@/lib/rate-limit';
import { sendEmail } from '@/lib/email/send';

// Club admins message the itsfootball.club team. Emailed to SUPPORT_EMAIL with Reply-To set to the
// admin's verified sign-in address, so support answers straight from their inbox.
//   POST { clubId, topic, message }

const TOPICS = new Set(['Question', 'Bug report', 'Feature request', 'Billing', 'Other']);
const esc = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const clubId = typeof body?.clubId === 'string' ? body.clubId : '';
  const topic = TOPICS.has(body?.topic) ? body.topic : 'Other';
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  if (!clubId) return NextResponse.json({ error: 'Missing club.' }, { status: 400 });
  if (!message) return NextResponse.json({ error: 'Please write a message.' }, { status: 400 });
  if (message.length > 4000) return NextResponse.json({ error: 'Your message is too long (4000 characters maximum).' }, { status: 400 });

  const auth = await requireAdminOfClub(req, clubId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // ponytail: per-isolate throttle only; add a support_requests table if abuse ever shows up
  if (!rateLimit(`support:${auth.userId}`, 5, 60 * 60 * 1000).allowed) {
    return NextResponse.json({ error: 'Too many messages. Please try again in an hour.' }, { status: 429 });
  }

  const to = process.env.SUPPORT_EMAIL;
  if (!to) return NextResponse.json({ error: 'Support messages are not set up yet. Please try again later.' }, { status: 503 });

  const [{ data: userData }, { data: club }] = await Promise.all([
    auth.supabase.auth.getUser(auth.token),
    auth.supabase.from('clubs').select('name, slug').eq('id', clubId).maybeSingle(),
  ]);
  const email = userData.user?.email || '';
  const name = String(userData.user?.user_metadata?.full_name || email);
  const clubLabel = club ? `${club.name} (/${club.slug})` : clubId;

  const lines = [`From: ${name} <${email}>`, `Club: ${clubLabel}`, `Topic: ${topic}`, '', message];
  const result = await sendEmail({
    to,
    subject: `[Support] ${topic}: ${club?.name || 'club admin'}`,
    text: lines.join('\n'),
    html: `<pre style="font-family:inherit;white-space:pre-wrap">${esc(lines.join('\n'))}</pre>`,
    ...(email ? { replyTo: email } : {}),
  });
  if (!result.ok) return NextResponse.json({ error: 'Your message could not be sent. Please try again in a moment.' }, { status: 502 });
  return NextResponse.json({ ok: true });
}
