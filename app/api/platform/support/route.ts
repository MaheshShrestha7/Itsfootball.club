import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/supabase/server-auth';
import { getServiceClient } from '@/lib/supabase/service';
import { isUuid } from '@/lib/ids';
import { sendEmail } from '@/lib/email/send';

// Mission Control -> Support: answer a request (components/admin/platform/SupportTab.tsx).
//   POST { requestId, body, status: 'waiting' | 'done' }   Operators and Super admins
// Saves the reply, emails it to the person (Reply-To SUPPORT_EMAIL, else your own address) and sets
// the status. Reading requests and changing status alone go straight to the tables (RLS).

const esc = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

export async function POST(req: NextRequest) {
  const auth = await requirePlatformAdmin(req, true);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: 'Support replies are not configured on the server.' }, { status: 503 });

  const input = await req.json().catch(() => null);
  const body = typeof input?.body === 'string' ? input.body.trim() : '';
  const status = input?.status === 'done' ? 'done' : 'waiting';
  if (!isUuid(input?.requestId)) return NextResponse.json({ error: 'Missing request.' }, { status: 400 });
  if (!body || body.length > 4000) return NextResponse.json({ error: 'Write a reply (4000 characters at most).' }, { status: 400 });

  const { data: request } = await db.from('support_requests').select('id, from_email, from_name, topic, message').eq('id', input.requestId).maybeSingle();
  if (!request) return NextResponse.json({ error: 'Request not found.' }, { status: 404 });

  const quoted = request.message.split('\n').map((l: string) => `> ${l}`).join('\n');
  const text = `${body}\n\n${quoted}`;
  const replyTo = process.env.SUPPORT_EMAIL || auth.confirmedEmail || undefined;
  const sent = await sendEmail({
    to: request.from_email,
    subject: `Re: ${request.topic}`,
    text,
    html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;white-space:pre-wrap">${esc(body)}</div>`
      + `<blockquote style="margin:16px 0 0;padding-left:12px;border-left:3px solid #ddd;color:#666;white-space:pre-wrap">${esc(request.message)}</blockquote>`,
    ...(replyTo ? { replyTo } : {}),
  });

  const { error } = await db.from('support_replies').insert({ request_id: request.id, body, author_email: auth.confirmedEmail || null, emailed: sent.ok });
  if (error) return NextResponse.json({ error: 'The reply could not be saved.' }, { status: 500 });
  if (!sent.ok) {
    console.error('[platform/support] send failed:', sent.error);
    return NextResponse.json({ error: 'Saved, but the email could not be sent. Try again or email them yourself.' }, { status: 502 });
  }
  await db.from('support_requests').update({ status, updated_at: new Date().toISOString() }).eq('id', request.id);
  return NextResponse.json({ ok: true });
}
