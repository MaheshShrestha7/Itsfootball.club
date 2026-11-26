// The automatic club emails the daily job sends (app/api/cron/reminders), each behind its own switch in
// Admin -> Emails (clubs.email_settings):
//   AUTO-1 admin_summary   each admin's "Needs you" list, on mornings when it changed
//   AUTO-3 fee_reminders   unpaid fee requests: 3 days before, 3 days after, a week later
//   AUTO-8 weekly_roundup  the coming week, last week's results and news, on the club's chosen day
// The rules are pure in lib/club-automations.ts.
import type { SupabaseClient } from '@supabase/supabase-js';
import { attentionItems, seasonToStart } from '@/lib/admin-attention';
import { adminAreas, feeReminderStep, localDay, summaryFingerprint } from '@/lib/club-automations';
import { clubTimeZone } from '@/lib/dates';
import { countsTowardClubRecord, type ClubTeam, type Match } from '@/lib/supabase/types';
import { kickoff, publicFixtures } from '@/lib/fixtures';
import { publicScoreHidden } from '@/lib/teams';
import { hasSentChange, sponsorSignupStage } from '@/lib/sponsors';
import { SITE_URL } from '@/lib/seo';
import { CLUB_BRAND_COLUMNS, clubBaseUrl, clubBrand, type ClubBrandRow } from './club-brand';
import { MEMBER_RECIPIENT_COLUMNS, memberRecipient, normalizeEmail, type EmailDraft } from './club-emails';
import { BILL_COLUMNS, emailBills, type BillRow } from './fee-requests';
import { cleanSettings, DEFAULT_ROUNDUP_DAY, type ReminderSetting } from './settings';
import { formatMatchWhen, formatWhen } from './format';
import { adminSummary, feeRequest, paymentReceipt, weeklyRoundup, type EmailSection } from './templates';

type Club = ClubBrandRow & { email_settings: unknown; owner_id?: string | null };
const DAY = 86400000;

/** Active clubs that switched `setting` on */
async function clubsWith(db: SupabaseClient, setting: ReminderSetting, ids?: string[]): Promise<Club[]> {
  let query = db.from('clubs').select(`${CLUB_BRAND_COLUMNS}, email_settings, owner_id`).eq('is_active', true);
  // payments of a deleted club keep a null club_id; one null would fail the whole lookup
  if (ids) query = query.in('id', [...new Set(ids)].filter(Boolean));
  const { data } = await query;
  return ((data || []) as Club[]).filter(c => cleanSettings(c.email_settings)[setting]);
}

const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count || 0;

// ---------------------------------------------------------------------------------------------
// AUTO-1: admin morning summary
// ---------------------------------------------------------------------------------------------

/** What the email calls each admin area */
const AREA_LABEL: Record<string, string> = {
  'match-center': 'Match Centre', members: 'Members', finance: 'Finance', inquiries: 'Inbox',
  sponsors: 'Sponsors', shop: 'Shop', seasons: 'Seasons',
};

/** One club's "Needs you" list, as the dashboard works it out, without the day-to-day nudges (line-ups,
 *  juniors' details, expired passes, sponsors ending) that would make the email the same every morning */
async function clubAttention(db: SupabaseClient, club: Club, now: number) {
  const today = localDay(now, clubTimeZone(club)).date;
  const id = club.id;
  const [applications, receipts, claims, feesOverdue, contact, memberMsgs, orders, instalments, sponsors, matches, seasons] = await Promise.all([
    count(db.from('club_members').select('id', { count: 'exact', head: true }).eq('club_id', id).eq('membership_status', 'pending')),
    count(db.from('payments').select('id', { count: 'exact', head: true }).eq('club_id', id).eq('status', 'awaiting_review')),
    count(db.from('expense_claims').select('id', { count: 'exact', head: true }).eq('club_id', id).eq('status', 'submitted')),
    count(db.from('payments').select('id', { count: 'exact', head: true }).eq('club_id', id).eq('kind', 'fee_request').eq('status', 'pending').lt('due_on', today)),
    count(db.from('contact_inquiries').select('id', { count: 'exact', head: true }).eq('club_id', id).eq('status', 'unread')),
    count(db.from('member_messages').select('id', { count: 'exact', head: true }).eq('club_id', id).eq('sender_type', 'member').eq('is_read', false)),
    count(db.from('payments').select('id', { count: 'exact', head: true }).eq('club_id', id).eq('kind', 'shop_order').eq('status', 'paid').is('fulfilled_at', null)),
    count(db.from('payments').select('id', { count: 'exact', head: true }).eq('club_id', id).eq('kind', 'sponsorship').eq('status', 'pending').not('instalment_plan_id', 'is', null).lt('due_on', today)),
    db.from('sponsors').select('*').eq('club_id', id).then(r => r.data || []),
    db.from('matches').select('*').eq('club_id', id).in('status', ['upcoming', 'live', 'halftime'])
      .gte('match_date', new Date(now - 31 * DAY).toISOString().slice(0, 10)).lte('match_date', new Date(now).toISOString())
      .then(r => (r.data || []) as Match[]),
    db.from('club_seasons').select('id, name, start_date, end_date, is_current').eq('club_id', id).then(r => r.data || []),
  ]);
  const items = attentionItems(club.slug, {
    pendingApplications: applications, receiptsToReview: receipts, claimsToReview: claims, feesOverdue,
    unreadMessages: contact + memberMsgs, unreadContact: contact, ordersToHandOut: orders, instalmentsOverdue: instalments,
    sponsorsToPutOnSite: sponsors.filter(s => sponsorSignupStage(s, now) === 'paid').length,
    sponsorChanges: sponsors.filter(s => hasSentChange(s)).length,
    newSeason: seasonToStart(seasons, today),
  }, matches, now);
  return items.filter(i => !i.key.startsWith('lineup-'));
}

/** People who run the club: the owner, plus approved members with admin labels or an access role */
async function clubAdmins(db: SupabaseClient, club: Club) {
  const [{ data: people }, { data: roles }] = await Promise.all([
    db.from('club_members').select('id, user_id, full_name, role, roles, membership_status, status').eq('club_id', club.id).not('user_id', 'is', null),
    db.from('club_access_roles').select('name, permissions').eq('club_id', club.id),
  ]);
  const byUser = new Map<string, { name: string; areas: 'all' | Set<string> }>();
  for (const p of people || []) {
    if ((p.membership_status || 'approved') !== 'approved' || p.status === 'suspended') continue;
    const areas = adminAreas(p, (roles || []) as { name: string; permissions: Record<string, string> | null }[]);
    if (areas === 'all' || areas.size) byUser.set(p.user_id, { name: p.full_name, areas });
  }
  if (club.owner_id) byUser.set(club.owner_id, { name: byUser.get(club.owner_id)?.name || '', areas: 'all' });
  // The sign-in email, so it reaches the person who opens the admin pages
  const out: { userId: string; email: string; name: string; areas: 'all' | Set<string> }[] = [];
  for (const [userId, a] of byUser) {
    const { data } = await db.auth.admin.getUserById(userId);
    const email = data?.user?.email;
    if (email) out.push({ userId, email, name: a.name || String(data.user?.user_metadata?.full_name || ''), areas: a.areas });
  }
  return out;
}

export async function adminSummaryDrafts(db: SupabaseClient, now = Date.now()): Promise<EmailDraft[]> {
  const clubs = await clubsWith(db, 'admin_summary');
  const drafts: EmailDraft[] = [];
  for (const club of clubs) {
    const items = await clubAttention(db, club, now);
    if (!items.length) continue;
    const today = localDay(now, clubTimeZone(club)).date;
    const admins = await clubAdmins(db, club);
    // The last summary each admin got: the same list again is not news
    const { data: sent } = await db.from('email_log').select('recipient, ref_id, sent_at').eq('club_id', club.id).eq('kind', 'admin_summary')
      .gte('sent_at', new Date(now - 30 * DAY).toISOString()).order('sent_at', { ascending: false });
    const last = new Map<string, string>();
    for (const r of sent || []) if (!last.has(normalizeEmail(r.recipient))) last.set(normalizeEmail(r.recipient), r.ref_id);
    for (const admin of admins) {
      const mine = items.filter(i => admin.areas === 'all' || admin.areas.has(i.area));
      if (!mine.length) continue;
      const fingerprint = summaryFingerprint(mine);
      if (last.get(normalizeEmail(admin.email)) === fingerprint) continue;
      drafts.push({
        key: `admin_summary:${club.id}:${admin.userId}:${today}`,
        club, kind: 'admin_summary', refId: fingerprint, to: admin.email,
        render: unsubscribeUrl => adminSummary({
          brand: clubBrand(club),
          adminName: admin.name,
          items: mine.map(i => ({ area: AREA_LABEL[i.area] || 'Admin', text: i.text, url: `${SITE_URL}${i.href}` })),
          dashboardUrl: `${SITE_URL}/${club.slug}/admin`,
          unsubscribeUrl,
        }),
      });
    }
  }
  return drafts;
}

// ---------------------------------------------------------------------------------------------
// AUTO-3: fee request reminders
// ---------------------------------------------------------------------------------------------

/** Sends today's numbered reminders (each once, email_log). Bills go out whatever the opt-outs say, like
 *  the Remind button: unsubscribing stops club news, not what someone owes. */
export async function sendFeeReminders(db: SupabaseClient, dry: boolean, now = Date.now()) {
  const { data } = await db.from('payments').select(`club_id, ${BILL_COLUMNS}`)
    .eq('kind', 'fee_request').eq('status', 'pending').not('due_on', 'is', null)
    .gte('due_on', new Date(now - 18 * DAY).toISOString().slice(0, 10)).lte('due_on', new Date(now + 4 * DAY).toISOString().slice(0, 10));
  const rows = (data || []) as unknown as (BillRow & { club_id: string })[];
  const clubs = await clubsWith(db, 'fee_reminders', rows.map(r => r.club_id));
  const report = { due: 0, emailed: 0, notEmailed: 0 };
  for (const club of clubs) {
    const today = localDay(now, clubTimeZone(club)).date;
    const steps = new Map<string, number>();
    for (const r of rows) {
      const step = r.club_id === club.id && r.due_on ? feeReminderStep(r.due_on, today) : null;
      if (step) steps.set(r.id, step);
    }
    const due = rows.filter(r => steps.has(r.id));
    report.due += due.length;
    if (dry || !due.length) continue;
    const sent = await emailBills(db, club.id, due, { reminder: true, key: r => `fee_reminder:${r.id}:auto${steps.get(r.id)}` });
    report.emailed += sent.emailed;
    report.notEmailed += sent.notEmailed;
  }
  return report;
}

// ---------------------------------------------------------------------------------------------
// AUTO-8: weekly round-up
// ---------------------------------------------------------------------------------------------

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
/** "Tue 24 Nov" in the club's zone */
const dayLabel = (iso: string, timeZone: string) => new Intl.DateTimeFormat('en-AU', { timeZone, weekday: 'short', day: 'numeric', month: 'short' })
  .formatToParts(new Date(iso)).filter(x => x.type !== 'literal').map(x => x.value).join(' ');

/** The round-up for one club this week, or null when there's nothing to say */
async function roundupFor(db: SupabaseClient, club: Club, now: number) {
  const tz = clubTimeZone(club);
  const base = clubBaseUrl(club);
  const [{ data: matchRows }, { data: events }, { data: news }, { data: teams }] = await Promise.all([
    db.from('matches').select('*').eq('club_id', club.id).in('status', ['upcoming', 'completed'])
      .gte('match_date', new Date(now - 8 * DAY).toISOString().slice(0, 10)).lte('match_date', new Date(now + 8 * DAY).toISOString()),
    db.from('events').select('id, title, start_time, location').eq('club_id', club.id).eq('is_public', true)
      .gte('start_time', new Date(now).toISOString()).lte('start_time', new Date(now + 7 * DAY).toISOString()).order('start_time'),
    db.from('news_articles').select('title, slug, summary, published_at').eq('club_id', club.id)
      .gte('published_at', new Date(now - 7 * DAY).toISOString()).lte('published_at', new Date(now).toISOString()).order('published_at', { ascending: false }),
    db.from('club_teams').select('*').eq('club_id', club.id),
  ]);
  // The club's own games against other clubs, as fans see them: no in-house or hosted-cup games
  const games = publicFixtures((matchRows || []) as Match[]).filter(countsTowardClubRecord).sort((a, b) => kickoff(a) - kickoff(b));
  const upcoming = games.filter(m => m.status === 'upcoming' && kickoff(m) >= now && kickoff(m) <= now + 7 * DAY);
  // A team that keeps its scores off the public site keeps them out of the email too
  const results = games.filter(m => m.status === 'completed' && kickoff(m) >= now - 7 * DAY && kickoff(m) <= now
    && !publicScoreHidden(m, (teams || []) as ClubTeam[]));
  const matchUrl = (m: Match) => `${base}/match/${encodeURIComponent(m.slug || m.id)}`;

  const coming = [
    ...upcoming.map(m => ({ at: kickoff(m), row: { label: formatMatchWhen(m.match_date, m.match_time, tz), value: `${m.home_team_name} vs ${m.away_team_name}`, sub: m.venue || null, url: matchUrl(m) } })),
    ...(events || []).map(e => ({ at: Date.parse(e.start_time), row: { label: formatWhen(e.start_time, tz), value: e.title, sub: e.location || null, url: `${base}/events/${e.id}` } })),
  ].sort((a, b) => a.at - b.at).map(x => x.row);
  const sections: EmailSection[] = [
    { heading: 'Coming up', rows: coming },
    { heading: 'Last week\'s results', rows: [...results].reverse().map(m => ({ label: dayLabel(m.match_date, tz), value: `${m.home_team_name} ${m.home_score} - ${m.away_score} ${m.away_team_name}`, url: matchUrl(m) })) },
    { heading: 'News', rows: (news || []).map(n => ({ label: dayLabel(n.published_at, tz), value: n.title, sub: n.summary ? (n.summary.length > 140 ? `${n.summary.slice(0, 137)}...` : n.summary) : null, url: `${base}/news/${encodeURIComponent(n.slug)}` })) },
  ];
  if (!sections.some(s => s.rows.length)) return null;
  const bits = [
    upcoming.length && plural(upcoming.length, 'game', 'games'),
    events?.length && plural(events.length, 'event', 'events'),
    results.length && plural(results.length, 'result', 'results'),
    news?.length && plural(news.length, 'news story', 'news stories'),
  ].filter(Boolean) as string[];
  return { sections, bits, fixturesUrl: `${base}/fixtures` };
}

export async function roundupDrafts(db: SupabaseClient, now = Date.now()): Promise<EmailDraft[]> {
  const clubs = (await clubsWith(db, 'weekly_roundup'))
    .filter(c => localDay(now, clubTimeZone(c)).weekday === (cleanSettings(c.email_settings).weekly_roundup_day ?? DEFAULT_ROUNDUP_DAY));
  const drafts: EmailDraft[] = [];
  for (const club of clubs) {
    const content = await roundupFor(db, club, now);
    if (!content) continue;
    const today = localDay(now, clubTimeZone(club)).date;
    const { data: members } = await db.from('club_members').select(`id, ${MEMBER_RECIPIENT_COLUMNS}, status`)
      .eq('club_id', club.id).eq('membership_status', 'approved');
    // One email per address: a parent of two juniors gets one
    const seen = new Set<string>();
    for (const m of members || []) {
      const recipient = m.status === 'alumni' ? null : memberRecipient(m);
      if (!recipient || seen.has(normalizeEmail(recipient.to))) continue;
      seen.add(normalizeEmail(recipient.to));
      drafts.push({
        key: `weekly_roundup:${club.id}:${today}:${normalizeEmail(recipient.to)}`,
        club, kind: 'weekly_roundup', refId: `${club.id}:${today}`, to: recipient.to,
        render: unsubscribeUrl => weeklyRoundup({
          brand: clubBrand(club),
          memberName: recipient.name,
          sections: content.sections,
          subjectBits: content.bits,
          fixturesUrl: content.fixturesUrl,
          unsubscribeUrl,
        }),
      });
    }
  }
  return drafts;
}

// ---------------------------------------------------------------------------------------------
// Previews for Admin -> Emails
// ---------------------------------------------------------------------------------------------

export type AutomationPreview = 'admin_summary' | 'fee_reminders' | 'weekly_roundup' | 'receipt';
export const isAutomationPreview = (v: unknown): v is AutomationPreview =>
  v === 'admin_summary' || v === 'fee_reminders' || v === 'weekly_roundup' || v === 'receipt';

/** This club's email as it would go out today, or a note saying why none would (examples for bills and receipts) */
export async function automationPreview(
  db: SupabaseClient, club: ClubBrandRow, which: AutomationPreview,
  /** The admin summary shows the person previewing only the areas they can see themselves */
  canSee: (area: string) => Promise<boolean>,
  now = Date.now(),
): Promise<{ subject: string; html: string } | { empty: string }> {
  const brand = clubBrand(club);
  const base = clubBaseUrl(club);
  if (which === 'admin_summary') {
    const { data } = await db.from('clubs').select('owner_id').eq('id', club.id).maybeSingle();
    const all = await clubAttention(db, { ...club, email_settings: {}, owner_id: data?.owner_id }, now);
    const areas = [...new Set(all.map(i => i.area))];
    const allowed = new Set((await Promise.all(areas.map(async a => ((await canSee(a)) ? a : null)))).filter(Boolean));
    const items = all.filter(i => allowed.has(i.area));
    if (!items.length) return { empty: 'Nothing is waiting for you right now, so you wouldn\'t get a summary this morning.' };
    return adminSummary({
      brand, adminName: '', items: items.map(i => ({ area: AREA_LABEL[i.area] || 'Admin', text: i.text, url: `${SITE_URL}${i.href}` })),
      dashboardUrl: `${SITE_URL}/${club.slug}/admin`, unsubscribeUrl: 'https://itsfootball.club/unsubscribe',
    });
  }
  if (which === 'weekly_roundup') {
    const content = await roundupFor(db, { ...club, email_settings: {} }, now);
    if (!content) return { empty: 'Nothing is on in the next week and nothing happened last week, so this week\'s round-up would be skipped.' };
    return weeklyRoundup({ brand, memberName: '', sections: content.sections, subjectBits: content.bits, fixturesUrl: content.fixturesUrl, unsubscribeUrl: 'https://itsfootball.club/unsubscribe' });
  }
  if (which === 'fee_reminders') {
    return feeRequest({ brand, memberName: 'Sam Example', title: 'Example fee', price: '$50.00', dueOn: 'Friday', overdue: false, reminder: true, link: `${base}/pay/example` });
  }
  return paymentReceipt({
    brand, payerName: 'Sam Example', what: 'Example membership', price: '$120.00',
    paidOn: new Intl.DateTimeFormat('en-AU', { timeZone: clubTimeZone(club), weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(now)),
    method: 'card', reference: 'EXAMPLE1', link: base, canReply: true,
  });
}
