import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServiceClient } from '@/lib/supabase/service';
import { sendEmail } from '@/lib/email/send';
import { availabilityReminder, eventReminder, renewalReminder, type RenderedEmail } from '@/lib/email/templates';
import { CLUB_BRAND_COLUMNS, clubBaseUrl, clubBrand, type ClubBrandRow } from '@/lib/email/club-brand';

// Daily reminder emails, triggered by the Cloudflare cron in worker.ts (or by hand:
// POST with "Authorization: Bearer $CRON_SECRET"; add ?dry=1 to list what would be sent).
//   - match availability: squad members who haven't answered, for matches in the next 48 hours
//   - events: registered attendees, for events starting in the next 30 hours
//   - membership: 14 days before expiry, and once in the week after it lapses (clubs with paid plans)
// Each reminder is claimed in email_log first, so it goes out at most once.

const TIME_ZONE = process.env.EMAIL_TIMEZONE || 'Australia/Sydney';
// ponytail: sequential sends under Resend's default 2 req/s; switch to the batch endpoint past a few hundred a day
const MAX_SENDS = 200;
const SEND_GAP_MS = 550;

const when = (iso: string) =>
  new Intl.DateTimeFormat('en-AU', { timeZone: TIME_ZONE, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
const day = (date: string) =>
  new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${date}T00:00:00Z`));
/** Today's date (YYYY-MM-DD) in the clubs' time zone, shifted by `offsetDays` */
const localDate = (offsetDays = 0) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date(Date.now() + offsetDays * 86400000));

interface Reminder {
  key: string;
  clubId: string;
  to: string;
  email: RenderedEmail;
  fromName: string;
}

/** Equal-time string compare, so the secret can't be guessed byte by byte from response timing */
function sameSecret(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function clubsById(db: SupabaseClient, ids: string[]) {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map<string, ClubBrandRow>();
  const { data } = await db.from('clubs').select(CLUB_BRAND_COLUMNS).in('id', unique).eq('is_active', true);
  return new Map(((data || []) as ClubBrandRow[]).map(c => [c.id, c]));
}

async function availabilityReminders(db: SupabaseClient): Promise<Reminder[]> {
  const now = new Date();
  const { data: matches } = await db.from('matches')
    .select('id, club_id, title, competition, home_team_name, away_team_name, match_date, venue')
    .eq('status', 'upcoming')
    .gt('match_date', now.toISOString())
    .lte('match_date', new Date(now.getTime() + 48 * 3600000).toISOString());
  if (!matches?.length) return [];

  const { data: rows } = await db.from('player_availabilities')
    .select('id, match_id, response_token, member:club_members(full_name, email, status)')
    .in('match_id', matches.map(m => m.id))
    .eq('status', 'pending');
  const clubs = await clubsById(db, matches.map(m => m.club_id));
  const byId = new Map(matches.map(m => [m.id, m]));

  // ponytail: one email per match; group per player per day if tournament days start sending several
  return (rows || []).flatMap(r => {
    const member = (Array.isArray(r.member) ? r.member[0] : r.member) as { full_name: string; email: string | null; status: string } | null;
    const match = byId.get(r.match_id);
    const club = match && clubs.get(match.club_id);
    if (!member?.email || member.status === 'alumni' || !match || !club || !r.response_token) return [];
    const brand = clubBrand(club);
    return [{
      key: `availability:${r.id}`,
      clubId: club.id,
      to: member.email,
      fromName: club.name,
      email: availabilityReminder({
        brand,
        memberName: member.full_name,
        fixture: `${match.home_team_name} vs ${match.away_team_name}`,
        competition: match.title || match.competition, // tournament games carry their stage here, e.g. "Group A • Round 4"
        when: when(match.match_date),
        venue: match.venue,
        link: `${clubBaseUrl(club)}/availability?token=${encodeURIComponent(r.response_token)}`,
      }),
    }];
  });
}

async function eventReminders(db: SupabaseClient): Promise<Reminder[]> {
  const now = new Date();
  const { data: events } = await db.from('events')
    .select('id, club_id, title, start_time, location')
    .gt('start_time', now.toISOString())
    .lte('start_time', new Date(now.getTime() + 30 * 3600000).toISOString());
  if (!events?.length) return [];

  const { data: attendees } = await db.from('event_attendees')
    .select('id, event_id, attendee_name, attendee_email')
    .in('event_id', events.map(e => e.id))
    .eq('checkin_status', 'registered')
    .not('attendee_email', 'is', null);
  const clubs = await clubsById(db, events.map(e => e.club_id));
  const byId = new Map(events.map(e => [e.id, e]));

  return (attendees || []).flatMap(a => {
    const event = byId.get(a.event_id);
    const club = event && clubs.get(event.club_id);
    if (!event || !club || !a.attendee_email) return [];
    return [{
      key: `event:${a.id}`,
      clubId: club.id,
      to: a.attendee_email,
      fromName: club.name,
      email: eventReminder({
        brand: clubBrand(club),
        attendeeName: a.attendee_name,
        event: event.title,
        when: when(event.start_time),
        venue: event.location,
        link: `${clubBaseUrl(club)}/events/${event.id}`,
      }),
    }];
  });
}

async function renewalReminders(db: SupabaseClient): Promise<Reminder[]> {
  // Only clubs members can actually renew with (the member page shows "Renew" only for paid plans)
  const { data: plans } = await db.from('membership_plans').select('club_id').eq('is_active', true).gt('price_cents', 0);
  const clubIds = [...new Set((plans || []).map(p => p.club_id))];
  if (!clubIds.length) return [];

  const today = localDate();
  const { data: members } = await db.from('club_members')
    .select('id, club_id, full_name, email, membership_tier, membership_expires_at, status')
    .in('club_id', clubIds)
    .eq('membership_status', 'approved')
    .not('email', 'is', null)
    .gte('membership_expires_at', localDate(-7))
    .lte('membership_expires_at', localDate(14));
  const clubs = await clubsById(db, clubIds);

  return (members || []).flatMap(m => {
    const club = clubs.get(m.club_id);
    if (!club || !m.email || m.status === 'alumni' || !m.membership_expires_at) return [];
    const expired = m.membership_expires_at < today;
    return [{
      // One "expiring soon" and one "expired" email per membership term (the expiry date names the term)
      key: `renewal-${expired ? 'expired' : 'soon'}:${m.id}:${m.membership_expires_at}`,
      clubId: club.id,
      to: m.email,
      fromName: club.name,
      email: renewalReminder({
        brand: clubBrand(club),
        memberName: m.full_name,
        tier: m.membership_tier || 'Membership',
        expires: day(m.membership_expires_at),
        expired,
        link: `${clubBaseUrl(club)}/member`,
      }),
    }];
  });
}

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const db = getServiceClient();
  if (!secret || !db || !process.env.RESEND_API_KEY) {
    const missing = [!secret && 'CRON_SECRET', !db && 'SUPABASE_SECRET_KEY', !process.env.RESEND_API_KEY && 'RESEND_API_KEY'].filter(Boolean);
    return NextResponse.json({ error: 'Not configured', missing }, { status: 503 });
  }
  if (!sameSecret(req.headers.get('authorization') || '', `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const all = (await Promise.all([availabilityReminders(db), eventReminders(db), renewalReminders(db)])).flat();

  // Drop anything already sent (in chunks: the keys travel in the request URL)
  const sentKeys = new Set<string>();
  for (let i = 0; i < all.length; i += 100) {
    const { data: done } = await db.from('email_log').select('key').in('key', all.slice(i, i + 100).map(r => r.key));
    (done || []).forEach(d => sentKeys.add(d.key));
  }
  const due = all.filter(r => !sentKeys.has(r.key));

  if (req.nextUrl.searchParams.get('dry') === '1') {
    return NextResponse.json({ dryRun: true, due: due.map(r => ({ key: r.key, to: r.to, subject: r.email.subject })), alreadySent: sentKeys.size });
  }

  const result = { sent: 0, failed: 0, skipped: Math.max(0, due.length - MAX_SENDS), alreadySent: sentKeys.size };
  for (const r of due.slice(0, MAX_SENDS)) {
    // Claim first: if two runs overlap, only one gets the row
    const { data: claimed, error: claimError } = await db.from('email_log')
      .upsert({ key: r.key, club_id: r.clubId, recipient: r.to }, { onConflict: 'key', ignoreDuplicates: true })
      .select('key');
    if (claimError) {
      // e.g. migration 20261014_email_log.sql not applied: send nothing rather than risk repeats
      console.error('[reminders] cannot claim in email_log:', claimError.message);
      return NextResponse.json({ ...result, error: `email_log: ${claimError.message}` }, { status: 500 });
    }
    if (!claimed?.length) continue;

    const sent = await sendEmail({ to: r.to, ...r.email, fromName: r.fromName, idempotencyKey: r.key });
    if (sent.ok) {
      result.sent++;
      await db.from('email_log').update({ resend_id: sent.id }).eq('key', r.key);
    } else {
      result.failed++;
      console.error(`[reminders] ${r.key} failed:`, sent.error);
      await db.from('email_log').delete().eq('key', r.key); // release the claim so tomorrow's run retries
    }
    await new Promise(res => setTimeout(res, SEND_GAP_MS));
  }
  return NextResponse.json(result);
}
