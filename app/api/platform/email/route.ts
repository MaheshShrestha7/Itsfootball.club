import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/supabase/server-auth';
import { isUuid } from '@/lib/ids';
import { sendBatch } from '@/lib/email/send';
import type { PlatformClubPerson } from '@/lib/supabase/types';

// Mission Control emails a club's Owner or all its admins (components/admin/platform/EmailComposer.tsx).
//   POST { clubId, to: 'owner' | 'admins', subject, message }
// Plain text, Reply-To the platform admin's own address, and recorded as a club note.
// Operators and Super admins only; runs as the signed-in admin so the database checks apply.

const esc = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

export async function POST(req: NextRequest) {
  const auth = await requirePlatformAdmin(req, true);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => null);
  const clubId = typeof body?.clubId === 'string' && isUuid(body.clubId) ? body.clubId : '';
  const to = body?.to === 'admins' ? 'admins' : 'owner';
  const subject = typeof body?.subject === 'string' ? body.subject.trim() : '';
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  if (!clubId) return NextResponse.json({ error: 'Missing club.' }, { status: 400 });
  if (!subject || subject.length > 200) return NextResponse.json({ error: 'Write a subject (200 characters at most).' }, { status: 400 });
  if (!message || message.length > 4000) return NextResponse.json({ error: 'Write a message (4000 characters at most).' }, { status: 400 });
  if (message.includes('[REASON]')) return NextResponse.json({ error: 'Replace [REASON] with the reason first.' }, { status: 400 });

  const { data, error } = await auth.supabase.rpc('get_platform_club_people', { p_club_id: clubId });
  if (error) return NextResponse.json({ error: 'Could not load the club. Has migration 20261145 been run?' }, { status: 500 });
  const people = (data || []) as PlatformClubPerson[];
  const recipients = [...new Set(
    people.filter(p => (to === 'owner' ? p.is_owner : p.is_admin) && p.email).map(p => p.email!.toLowerCase())
  )];
  if (!recipients.length) return NextResponse.json({ error: to === 'owner' ? 'This club has no Owner with an email.' : 'This club has no admins with an email.' }, { status: 400 });

  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;white-space:pre-wrap">${esc(message)}</div>`;
  const result = await sendBatch(recipients.map(r => ({
    to: r,
    subject,
    text: message,
    html,
    ...(auth.confirmedEmail ? { replyTo: auth.confirmedEmail } : {}),
  })));
  if (!result.ok) {
    console.error('[platform/email] send failed:', result.error);
    return NextResponse.json({ error: 'The email could not be sent. Please try again.' }, { status: 502 });
  }

  // Shows in the club console's notes. A failure here doesn't undo the send.
  await auth.supabase.from('platform_club_notes').insert({
    club_id: clubId,
    kind: 'email',
    body: `${subject}\nTo: ${recipients.join(', ')}\n\n${message}`.slice(0, 4000),
    author_email: auth.confirmedEmail || null,
  });

  return NextResponse.json({ ok: true, sent: recipients.length });
}
