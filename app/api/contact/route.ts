import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { FRIENDLY_TYPE, friendlyMessage, parseFriendly } from '@/lib/friendlies';
import { isUuid } from '@/lib/ids';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INQUIRY_TYPES = new Set([
  'General Inquiry',
  'Player Trial',
  'Sponsorship',
  'Media Request',
  'Youth Academy',
  FRIENDLY_TYPE,
]);

/** Yesterday in Sydney: the earliest date an invitation may offer (allowing for clubs further west) */
function earliestDate(): string {
  const d = new Date(Date.now() - 86400000);
  return d.toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' });
}

function sanitizeText(text: unknown): string {
  if (typeof text !== 'string') return '';
  return text.replace(/[<>]/g, '').trim();
}

function getServerSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req.headers);

    // Best-effort per-instance throttle. The durable ceiling is the Postgres
    // per-email cooldown trigger on contact_inquiries (see migration), which
    // holds regardless of how many edge isolates are running.
    const throttle = rateLimit(`contact:${ip}`, 5, 10 * 60 * 1000);
    if (!throttle.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many messages sent. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid request.' }, { status: 400 });
    }

    // Honeypot: real visitors never see or fill this field (see ContactModal).
    // Pretend success so bots don't learn their submission was rejected.
    if (typeof (body as any).website === 'string' && (body as any).website.trim().length > 0) {
      return NextResponse.json({ success: true });
    }

    const clubId = typeof (body as any).club_id === 'string' ? (body as any).club_id : '';
    const name = sanitizeText((body as any).sender_name);
    const email = sanitizeText((body as any).sender_email).toLowerCase();
    const phone = (body as any).sender_phone ? sanitizeText((body as any).sender_phone) : null;
    const rawInquiryType = (body as any).inquiry_type;
    const inquiryType = INQUIRY_TYPES.has(rawInquiryType) ? rawInquiryType : 'General Inquiry';
    let message = sanitizeText((body as any).message);
    // Sent from an event page: which event it's about, kept at the top of the message for the Inbox
    const about = sanitizeText((body as any).about).replace(/\s+/g, ' ').slice(0, 200);

    // A friendly invitation: what the fixture needs, checked here and kept as `details`; the
    // message becomes a readable summary with their note under it (lib/friendlies.ts)
    let friendly: { details: Record<string, unknown>; teamId: string } | null = null;
    if (inquiryType === FRIENDLY_TYPE) {
      if (!clubId || !name || !email) {
        return NextResponse.json({ success: false, error: 'Please fill in your name and email.' }, { status: 400 });
      }
      const teamId = (body as any).team_id;
      const parsed = parseFriendly((body as any).friendly, earliestDate());
      if (!parsed.ok) return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
      if (!isUuid(teamId)) return NextResponse.json({ success: false, error: 'Pick the team you’d like to play.' }, { status: 400 });
      const client = getServerSupabaseClient();
      const { data: team } = client
        ? await client.from('club_teams').select('id, name, is_active, open_to_friendlies').eq('id', teamId).eq('club_id', clubId).maybeSingle()
        : { data: null };
      if (!team || !team.is_active || team.open_to_friendlies !== true) {
        return NextResponse.json({ success: false, error: 'That team isn’t taking friendly invitations right now.' }, { status: 400 });
      }
      const note = message.slice(0, 1500);
      friendly = { details: { ...parsed.details, team_name: team.name }, teamId: team.id };
      message = friendlyMessage({ ...parsed.details }, team.name, note);
    }

    if (!clubId || !name || !email || !message) {
      return NextResponse.json(
        { success: false, error: 'Please fill in your name, email and message.' },
        { status: 400 }
      );
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Please provide a valid email address.' },
        { status: 400 }
      );
    }
    if (message.length > 4000) {
      return NextResponse.json(
        { success: false, error: 'Your message is too long (4000 characters maximum).' },
        { status: 400 }
      );
    }

    const client = getServerSupabaseClient();
    if (!client) {
      return NextResponse.json(
        { success: false, error: 'Messages cannot be sent right now. Please try again later.' },
        { status: 503 }
      );
    }

    const { error } = await client.from('contact_inquiries').insert({
      club_id: clubId,
      sender_name: name,
      sender_email: email,
      sender_phone: phone,
      inquiry_type: inquiryType,
      message: about && !friendly ? `About: ${about}\n\n${message}` : message,
      status: 'unread',
      ...(friendly ? { details: friendly.details, team_id: friendly.teamId } : {}),
    });

    if (error) {
      const isCooldown = /rate limit|cooldown/i.test(error.message || '');
      return NextResponse.json(
        {
          success: false,
          error: isCooldown
            ? 'You already sent a message recently. Please wait a few minutes before sending another.'
            : 'Your message could not be sent. Please try again in a moment.',
        },
        { status: isCooldown ? 429 : 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Your message could not be sent. Please try again in a moment.' },
      { status: 500 }
    );
  }
}
