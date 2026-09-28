import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServiceClient } from '@/lib/supabase/service';
import { availabilityReminder, eventReminder, renewalReminder } from '@/lib/email/templates';
import { CLUB_BRAND_COLUMNS, clubBaseUrl, clubBrand, type ClubBrandRow } from '@/lib/email/club-brand';
import { filterDrafts, looksLikeEmail, materialize, sendClubEmails, type EmailDraft } from '@/lib/email/club-emails';
import { cleanSettings, type ReminderSetting } from '@/lib/email/settings';
import { formatWhen, formatDay, localDate } from '@/lib/email/format';

// Daily reminder emails, triggered by the Cloudflare cron in worker.ts (or by hand:
// POST with "Authorization: Bearer $CRON_SECRET"; add ?dry=1 to list what would be sent).
//   - match availability: squad members who haven't answered, for matches in the next 48 hours
//   - events: registered attendees, for events starting in the next 30 hours
//   - membership: 14 days before expiry, and once in the week after it lapses (clubs with paid plans)
// Each club switches these on in Admin -> Email Notifications (clubs.email_settings); all start off.
// Unsubscribed addresses are skipped, and each reminder goes out at most once (email_log).

const MAX_SENDS = 1000;

type Club = ClubBrandRow & { email_settings: unknown };

/** Active clubs (by id) that switched `setting` on */
async function clubsWith(db: SupabaseClient, setting: ReminderSetting, ids?: string[]) {
  let query = db.from('clubs').select(`${CLUB_BRAND_COLUMNS}, email_settings`).eq('is_active', true);
  if (ids) query = query.in('id', [...new Set(ids)]);
  const { data } = await query;
  return new Map(((data || []) as Club[]).filter(c => cleanSettings(c.email_settings)[setting]).map(c => [c.id, c]));
}

async function availabilityDrafts(db: SupabaseClient): Promise<EmailDraft[]> {
  const now = new Date();
  const { data: matches } = await db.from('matches')
    .select('id, club_id, title, competition, home_team_name, away_team_name, match_date, venue')
    .eq('status', 'upcoming')
    .gt('match_date', now.toISOString())
    .lte('match_date', new Date(now.getTime() + 48 * 3600000).toISOString());
  const clubs = await clubsWith(db, 'availability_reminders', (matches || []).map(m => m.club_id));
  const due = (matches || []).filter(m => clubs.has(m.club_id));
  if (!due.length) return [];

  const { data: rows } = await db.from('player_availabilities')
    .select('id, match_id, response_token, member:club_members(full_name, email, status)')
    .in('match_id', due.map(m => m.id))
    .eq('status', 'pending');
  const byId = new Map(due.map(m => [m.id, m]));

  // ponytail: one email per match; group per player per day if tournament days start sending several
  return (rows || []).flatMap(r => {
    const member = (Array.isArray(r.member) ? r.member[0] : r.member) as { full_name: string; email: string | null; status: string } | null;
    const match = byId.get(r.match_id);
    const club = match && clubs.get(match.club_id);
    if (!looksLikeEmail(member?.email) || member.status === 'alumni' || !match || !club || !r.response_token) return [];
    return [{
      key: `availability:${r.id}`,
      club, kind: 'availability' as const, refId: match.id, to: member.email,
      render: (unsubscribeUrl: string | null) => availabilityReminder({
        brand: clubBrand(club),
        unsubscribeUrl,
        memberName: member.full_name,
        fixture: `${match.home_team_name} vs ${match.away_team_name}`,
        competition: match.title || match.competition, // tournament games carry their stage here, e.g. "Group A • Round 4"
        when: formatWhen(match.match_date),
        venue: match.venue,
        link: `${clubBaseUrl(club)}/availability?token=${encodeURIComponent(r.response_token)}`,
      }),
    }];
  });
}

async function eventDrafts(db: SupabaseClient): Promise<EmailDraft[]> {
  const now = new Date();
  const { data: events } = await db.from('events')
    .select('id, club_id, title, start_time, location')
    .gt('start_time', now.toISOString())
    .lte('start_time', new Date(now.getTime() + 30 * 3600000).toISOString());
  const clubs = await clubsWith(db, 'event_reminders', (events || []).map(e => e.club_id));
  const due = (events || []).filter(e => clubs.has(e.club_id));
  if (!due.length) return [];

  const { data: attendees } = await db.from('event_attendees')
    .select('id, event_id, attendee_name, attendee_email')
    .in('event_id', due.map(e => e.id))
    .eq('checkin_status', 'registered')
    .not('attendee_email', 'is', null);
  const byId = new Map(due.map(e => [e.id, e]));

  return (attendees || []).flatMap(a => {
    const event = byId.get(a.event_id);
    const club = event && clubs.get(event.club_id);
    if (!event || !club || !looksLikeEmail(a.attendee_email)) return [];
    return [{
      key: `event:${a.id}`,
      club, kind: 'event' as const, refId: event.id, to: a.attendee_email,
      render: (unsubscribeUrl: string | null) => eventReminder({
        brand: clubBrand(club),
        unsubscribeUrl,
        attendeeName: a.attendee_name,
        event: event.title,
        when: formatWhen(event.start_time),
        venue: event.location,
        link: `${clubBaseUrl(club)}/events/${event.id}`,
      }),
    }];
  });
}

async function renewalDrafts(db: SupabaseClient): Promise<EmailDraft[]> {
  // Only clubs members can actually renew with (the member page shows "Renew" only for paid plans)
  const { data: plans } = await db.from('membership_plans').select('club_id').eq('is_active', true).gt('price_cents', 0);
  const clubs = await clubsWith(db, 'renewal_reminders', (plans || []).map(p => p.club_id));
  if (!clubs.size) return [];

  const today = localDate();
  const { data: members } = await db.from('club_members')
    .select('id, club_id, full_name, email, membership_tier, membership_expires_at, status')
    .in('club_id', [...clubs.keys()])
    .eq('membership_status', 'approved')
    .not('email', 'is', null)
    .gte('membership_expires_at', localDate(-7))
    .lte('membership_expires_at', localDate(14));

  return (members || []).flatMap(m => {
    const club = clubs.get(m.club_id);
    if (!club || !looksLikeEmail(m.email) || m.status === 'alumni' || !m.membership_expires_at) return [];
    const expired = m.membership_expires_at < today;
    return [{
      // One "expiring soon" and one "expired" email per membership term (the expiry date names the term)
      key: `renewal-${expired ? 'expired' : 'soon'}:${m.id}:${m.membership_expires_at}`,
      club, kind: 'renewal' as const, refId: `${m.id}:${m.membership_expires_at}`, to: m.email,
      render: (unsubscribeUrl: string | null) => renewalReminder({
        brand: clubBrand(club),
        unsubscribeUrl,
        memberName: m.full_name,
        tier: m.membership_tier || 'Membership',
        expires: formatDay(m.membership_expires_at),
        expired,
        link: `${clubBaseUrl(club)}/member`,
      }),
    }];
  });
}

/** Equal-time string compare, so the secret can't be guessed byte by byte from response timing */
function sameSecret(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
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

  const drafts = (await Promise.all([availabilityDrafts(db), eventDrafts(db), renewalDrafts(db)])).flat();

  const { due, optedOut, alreadySent } = await filterDrafts(db, drafts);

  if (req.nextUrl.searchParams.get('dry') === '1') {
    return NextResponse.json({
      dryRun: true,
      due: due.map(d => ({ key: d.key, to: d.to, subject: d.render(null).subject })),
      alreadySent,
      optedOut,
    });
  }

  const report = await sendClubEmails(db, await materialize(due.slice(0, MAX_SENDS)));
  const body = { ...report, alreadySent: report.alreadySent + alreadySent, optedOut, deferred: Math.max(0, due.length - MAX_SENDS) };
  if (report.error?.startsWith('email_log')) {
    console.error('[reminders]', report.error);
    return NextResponse.json(body, { status: 500 });
  }
  return NextResponse.json(body);
}
