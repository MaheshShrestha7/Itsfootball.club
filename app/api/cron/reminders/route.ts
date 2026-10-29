import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServiceClient } from '@/lib/supabase/service';
import { availabilityReminder, eventReminder, renewalReminder, sponsorLink } from '@/lib/email/templates';
import { formatMoney } from '@/lib/finance';
import { formatEndDate, isSponsorKey, matchSponsorPackage, sponsorPageUrl } from '@/lib/sponsors';
import { CLUB_BRAND_COLUMNS, clubBaseUrl, clubBrand, type ClubBrandRow } from '@/lib/email/club-brand';
import { filterDrafts, looksLikeEmail, materialize, memberRecipient, MEMBER_RECIPIENT_COLUMNS, sendClubEmails, type EmailDraft } from '@/lib/email/club-emails';
import { cleanSettings, type ReminderSetting } from '@/lib/email/settings';
import { formatWhen, formatMatchWhen, formatDay, localDate } from '@/lib/email/format';

// Daily reminder emails, triggered by the Cloudflare cron in worker.ts (or by hand:
// POST with "Authorization: Bearer $CRON_SECRET"; add ?dry=1 to list what would be sent).
//   - match availability: squad members who haven't answered, for matches in the next 48 hours
//   - events: registered attendees, for events starting in the next 30 hours
//   - membership: 14 days before expiry, and once in the week after it lapses (clubs with paid plans)
//   - sponsors: 30 days before the sponsorship ends, and once in the week after, with the renewal link
// Juniors' reminders go to their parent or guardian (memberRecipient).
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
    .select('id, club_id, title, competition, home_team_name, away_team_name, match_date, match_time, venue')
    .eq('status', 'upcoming')
    .gt('match_date', now.toISOString())
    .lte('match_date', new Date(now.getTime() + 48 * 3600000).toISOString());
  const clubs = await clubsWith(db, 'availability_reminders', (matches || []).map(m => m.club_id));
  const due = (matches || []).filter(m => clubs.has(m.club_id));
  if (!due.length) return [];

  // Every squad player gets a pending row (and so a personal link), even if no coach opened the
  // fixture on the Availability page (supabase/migrations/20261107_availability.sql).
  const { error: ensureError } = await db.rpc('ensure_match_availability', { p_match_ids: due.map(m => m.id) });
  if (ensureError) console.error('[reminders] could not create availability rows', ensureError.message);

  const { data: rows } = await db.from('player_availabilities')
    .select(`id, match_id, response_token, member:club_members(${MEMBER_RECIPIENT_COLUMNS}, status)`)
    .in('match_id', due.map(m => m.id))
    .eq('status', 'pending');
  const byId = new Map(due.map(m => [m.id, m]));

  // ponytail: one email per match; group per player per day if tournament days start sending several
  return (rows || []).flatMap(r => {
    const member = (Array.isArray(r.member) ? r.member[0] : r.member) as { full_name: string; email: string | null; guardian_name: string | null; guardian_email: string | null; status: string } | null;
    const match = byId.get(r.match_id);
    const club = match && clubs.get(match.club_id);
    const recipient = member && memberRecipient(member);
    if (!recipient || member.status === 'alumni' || !match || !club || !r.response_token) return [];
    return [{
      key: `availability:${r.id}`,
      club, kind: 'availability' as const, refId: match.id, to: recipient.to,
      render: (unsubscribeUrl: string | null) => availabilityReminder({
        brand: clubBrand(club),
        unsubscribeUrl,
        memberName: recipient.name,
        childName: recipient.childName,
        fixture: `${match.home_team_name} vs ${match.away_team_name}`,
        competition: match.title || match.competition, // tournament games carry their stage here, e.g. "Group A • Round 4"
        when: formatMatchWhen(match.match_date, match.match_time),
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
    .select(`id, club_id, ${MEMBER_RECIPIENT_COLUMNS}, membership_tier, membership_expires_at, status`)
    .in('club_id', [...clubs.keys()])
    .eq('membership_status', 'approved')
    .gte('membership_expires_at', localDate(-7))
    .lte('membership_expires_at', localDate(14));

  return (members || []).flatMap(m => {
    const club = clubs.get(m.club_id);
    const recipient = memberRecipient(m);
    if (!club || !recipient || m.status === 'alumni' || !m.membership_expires_at) return [];
    const expired = m.membership_expires_at < today;
    return [{
      // One "expiring soon" and one "expired" email per membership term (the expiry date names the term)
      key: `renewal-${expired ? 'expired' : 'soon'}:${m.id}:${m.membership_expires_at}`,
      club, kind: 'renewal' as const, refId: `${m.id}:${m.membership_expires_at}`, to: recipient.to,
      render: (unsubscribeUrl: string | null) => renewalReminder({
        brand: clubBrand(club),
        unsubscribeUrl,
        memberName: recipient.name,
        childName: recipient.childName,
        tier: m.membership_tier || 'Membership',
        expires: formatDay(m.membership_expires_at),
        expired,
        link: `${clubBaseUrl(club)}/member?renew=${m.id}`,
      }),
    }];
  });
}

async function sponsorRenewalDrafts(db: SupabaseClient): Promise<EmailDraft[]> {
  // SPP-1: sponsors still on the site (not ended by an admin) whose end date is 30 days away or passed
  // in the last week. Their renewal link works from 60 days before (canPayRenewal).
  const today = localDate();
  const { data: sponsors } = await db.from('sponsors').select('*')
    .eq('is_active', true).in('package_status', ['paid', 'confirmed'])
    .gte('ends_on', localDate(-7)).lte('ends_on', localDate(30));
  const clubs = await clubsWith(db, 'sponsor_renewal_reminders', (sponsors || []).map(s => s.club_id));
  // Money deals only: one agreed in goods or services has nothing to pay
  const due = (sponsors || []).filter(s => clubs.has(s.club_id) && isSponsorKey(s.access_key) && looksLikeEmail(s.contact_email)
    && (Number(s.package_value) > 0 || s.package_id));
  if (!due.length) return [];

  const clubIds = [...new Set(due.map(s => s.club_id))];
  const [{ data: packages }, { data: open }, { data: settings }] = await Promise.all([
    db.from('sponsorship_packages').select('id, club_id, name, tier, price_cents').in('club_id', clubIds).eq('is_active', true).gt('price_cents', 0),
    // Already paying: a receipt being checked, or an invoice out (due_on, migration 20261137)
    db.from('payments').select('*').in('sponsor_id', due.map(s => s.id)).eq('kind', 'sponsorship').in('status', ['awaiting_review', 'pending']),
    db.from('club_payment_settings').select('club_id, currency').in('club_id', clubIds),
  ]);
  const paying = new Set((open || []).filter(p => p.status === 'awaiting_review' || p.due_on).map(p => p.sponsor_id));
  const currency = new Map((settings || []).map(c => [c.club_id, c.currency as string]));

  return due.flatMap(s => {
    const club = clubs.get(s.club_id);
    const clubPackages = (packages || []).filter(p => p.club_id === s.club_id);
    const pkg = clubPackages.find(p => p.id === s.package_id) || matchSponsorPackage(s, clubPackages);
    if (!club || !pkg || paying.has(s.id)) return [];
    const ended = s.ends_on < today;
    const base = clubBaseUrl(club);
    return [{
      // One "ending soon" and one "ended" email per term (the end date names the term)
      key: `sponsor-renewal-${ended ? 'ended' : 'soon'}:${s.id}:${s.ends_on}`,
      club, kind: 'sponsor_reminder' as const, refId: `${s.id}:${s.ends_on}`, to: String(s.contact_email).trim(),
      render: (unsubscribeUrl: string | null) => sponsorLink({
        brand: clubBrand(club),
        unsubscribeUrl,
        contactName: s.contact_name || s.name,
        business: s.name,
        packageName: pkg.name,
        price: formatMoney(pkg.price_cents, currency.get(s.club_id) || 'AUD'),
        renewal: true,
        endsOn: formatEndDate(s.ends_on),
        ended,
        link: `${base}/sponsor?${new URLSearchParams({ pay: s.id, package: pkg.id, k: s.access_key })}`,
        pageLink: sponsorPageUrl(base, s.access_key),
        canReply: false,
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
  if (!secret) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  if (!sameSecret(req.headers.get('authorization') || '', `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Which settings are missing is only told to the cron itself
  if (!db || !process.env.RESEND_API_KEY) {
    const missing = [!db && 'SUPABASE_SECRET_KEY', !process.env.RESEND_API_KEY && 'RESEND_API_KEY'].filter(Boolean);
    return NextResponse.json({ error: 'Not configured', missing }, { status: 503 });
  }

  const drafts = (await Promise.all([availabilityDrafts(db), eventDrafts(db), renewalDrafts(db), sponsorRenewalDrafts(db)])).flat();

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
