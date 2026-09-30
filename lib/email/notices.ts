// Notices an admin sends by hand from Admin -> Email Notifications. Each recipient gets a given
// notice once (the key names the notice and the address), however often the button is pressed.
import type { SupabaseClient } from '@supabase/supabase-js';
import { eventNotice, matchNotice, newsNotice, renewalReminder } from './templates';
import { clubBaseUrl, clubBrand, type ClubBrandRow } from './club-brand';
import { looksLikeEmail, normalizeEmail, type EmailDraft } from './club-emails';
import { formatDay, formatWhen, localDate } from './format';
import { articleText } from '@/lib/article-text';
import type { PushMessage } from '@/lib/push';

export const NOTICE_KINDS = ['renewal', 'match', 'event', 'news'] as const;
export type NoticeKind = (typeof NOTICE_KINDS)[number];
export type NoticeAudience = 'members' | 'players';

export interface NoticeRequest {
  kind: NoticeKind;
  /** The match / event / article; unused for renewal */
  refId?: string;
  /** Match notices only: the whole membership, or players only */
  audience?: NoticeAudience;
  /** Optional personal note from the admin */
  message?: string;
  /** Renewal only: just this member (sent from Members Administration), whatever their expiry date */
  memberId?: string;
}

export const MAX_MESSAGE_LENGTH = 1000;

interface MemberRow {
  id: string;
  full_name: string;
  email: string | null;
  role: string | null;
  roles: string[] | null;
  status: string | null;
  membership_tier: string | null;
  membership_expires_at: string | null;
}

/** Approved, current members with a usable email, one per address (families often share one) */
async function members(db: SupabaseClient, clubId: string): Promise<(MemberRow & { email: string })[]> {
  const { data } = await db.from('club_members')
    .select('id, full_name, email, role, roles, status, membership_tier, membership_expires_at')
    .eq('club_id', clubId)
    .eq('membership_status', 'approved')
    .not('email', 'is', null);
  const seen = new Set<string>();
  return ((data || []) as MemberRow[]).filter((m): m is MemberRow & { email: string } => {
    if (!looksLikeEmail(m.email) || m.status === 'alumni') return false;
    const e = normalizeEmail(m.email);
    if (seen.has(e)) return false;
    seen.add(e);
    return true;
  });
}

const isPlayer = (m: MemberRow) =>
  [...(m.roles || []), ...(m.role || '').split(',')].some(r => r.trim().toLowerCase() === 'player');

export type PreparedNotice =
  // push: what followers of the club get as a notification. Public details only (never the admin's
  // message, which is written for members), and none for renewals or players-only match notices.
  | { ok: true; drafts: EmailDraft[]; label: string; skippedNoEmail: number; push?: PushMessage }
  | { ok: false; status: 400 | 404; error: string };

export async function prepareNotice(db: SupabaseClient, club: ClubBrandRow, req: NoticeRequest): Promise<PreparedNotice> {
  const brand = clubBrand(club);
  const base = clubBaseUrl(club);
  const message = req.message?.trim().slice(0, MAX_MESSAGE_LENGTH) || null;
  const { count: total } = await db.from('club_members').select('id', { count: 'exact', head: true })
    .eq('club_id', club.id).eq('membership_status', 'approved');
  const everyone = await members(db, club.id);
  const skippedNoEmail = Math.max(0, (total || 0) - everyone.length);

  switch (req.kind) {
    case 'renewal': {
      const today = localDate();
      let due: (MemberRow & { email: string })[];
      if (req.memberId) {
        const { data: member } = await db.from('club_members')
          .select('id, full_name, email, role, roles, status, membership_tier, membership_expires_at')
          .eq('club_id', club.id).eq('id', req.memberId).eq('membership_status', 'approved').maybeSingle();
        if (!member) return { ok: false, status: 404, error: 'Member not found.' };
        if (!looksLikeEmail(member.email)) return { ok: false, status: 400, error: `${member.full_name} has no email address.` };
        if (!member.membership_expires_at) return { ok: false, status: 400, error: `${member.full_name} has no membership expiry date yet.` };
        due = [member as MemberRow & { email: string }];
      } else {
        // Expiring within 30 days, or lapsed within the last 60
        const from = localDate(-60), to = localDate(30);
        due = everyone.filter(m => m.membership_expires_at && m.membership_expires_at >= from && m.membership_expires_at <= to);
      }
      return {
        ok: true, label: 'Membership renewal notice', skippedNoEmail,
        drafts: due.map(m => ({
          // Sent by hand to one member: once a day, separate from the once-a-term bulk notice
          key: req.memberId ? `notice_renewal:${m.id}:${m.membership_expires_at}:manual:${today}` : `notice_renewal:${m.id}:${m.membership_expires_at}`,
          club, kind: 'notice_renewal', refId: `${m.id}:${m.membership_expires_at}`, to: m.email,
          render: unsubscribeUrl => renewalReminder({
            brand, unsubscribeUrl, message,
            memberName: m.full_name,
            tier: m.membership_tier || 'Membership',
            expires: formatDay(m.membership_expires_at!),
            expired: m.membership_expires_at! < today,
            link: `${base}/member`,
          }),
        })),
      };
    }

    case 'match': {
      const { data: match } = await db.from('matches')
        .select('id, title, competition, home_team_name, away_team_name, match_date, venue, status')
        .eq('club_id', club.id).eq('id', req.refId || '').maybeSingle();
      if (!match) return { ok: false, status: 404, error: 'Match not found.' };
      if (['completed', 'cancelled'].includes(match.status)) return { ok: false, status: 400, error: 'That match is already over.' };
      const audience = req.audience === 'players' ? everyone.filter(isPlayer) : everyone;
      const fixture = `${match.home_team_name} vs ${match.away_team_name}`;
      return {
        ok: true, label: `Match notice: ${fixture}`, skippedNoEmail,
        push: req.audience === 'players' ? undefined : { title: fixture, body: `${match.title || match.competition || club.name} · ${formatWhen(match.match_date)}`, url: `/${club.slug}/match/${match.id}`, tag: `match:${match.id}` },
        drafts: audience.map(m => ({
          key: `notice_match:${match.id}:${normalizeEmail(m.email)}`,
          club, kind: 'notice_match', refId: match.id, to: m.email,
          render: unsubscribeUrl => matchNotice({
            brand, unsubscribeUrl, message,
            recipientName: m.full_name,
            fixture,
            competition: match.title || match.competition,
            when: formatWhen(match.match_date),
            venue: match.venue,
            link: `${base}/match/${match.id}`,
          }),
        })),
      };
    }

    case 'event': {
      const { data: event } = await db.from('events')
        .select('id, title, description, start_time, location')
        .eq('club_id', club.id).eq('id', req.refId || '').maybeSingle();
      if (!event) return { ok: false, status: 404, error: 'Event not found.' };
      if (new Date(event.start_time).getTime() < Date.now()) return { ok: false, status: 400, error: 'That event has already started.' };
      return {
        ok: true, label: `Event notice: ${event.title}`, skippedNoEmail,
        push: { title: event.title, body: `${club.name} · ${formatWhen(event.start_time)}`, url: `/${club.slug}/events/${event.id}`, tag: `event:${event.id}` },
        drafts: everyone.map(m => ({
          key: `notice_event:${event.id}:${normalizeEmail(m.email)}`,
          club, kind: 'notice_event', refId: event.id, to: m.email,
          render: unsubscribeUrl => eventNotice({
            brand, unsubscribeUrl, message,
            recipientName: m.full_name,
            event: event.title,
            description: event.description,
            when: formatWhen(event.start_time),
            venue: event.location,
            link: `${base}/events/${event.id}`,
          }),
        })),
      };
    }

    case 'news': {
      const { data: article } = await db.from('news_articles')
        .select('id, title, summary, content, cover_image_url')
        .eq('club_id', club.id).eq('id', req.refId || '').maybeSingle();
      if (!article) return { ok: false, status: 404, error: 'Article not found.' };
      const summary = article.summary || articleText(article.content).slice(0, 280);
      return {
        ok: true, label: `News: ${article.title}`, skippedNoEmail,
        push: { title: `${club.name}: ${article.title}`, body: summary?.slice(0, 140) || 'New from the club', url: `/${club.slug}#news`, tag: `news:${article.id}` },
        drafts: everyone.map(m => ({
          key: `notice_news:${article.id}:${normalizeEmail(m.email)}`,
          club, kind: 'notice_news', refId: article.id, to: m.email,
          render: unsubscribeUrl => newsNotice({
            brand, unsubscribeUrl, message,
            recipientName: m.full_name,
            title: article.title,
            summary,
            image: article.cover_image_url,
            link: `${base}#news`,
          }),
        })),
      };
    }
  }
}
