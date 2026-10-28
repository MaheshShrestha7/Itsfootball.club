// What's waiting for a club admin: the dashboard's "Needs you" card and the dot on the phone
// Admin Menu button. Pure, so it can be checked without a browser (lib/admin-attention.check.ts).
import type { Match } from './supabase/types';
import { countsTowardClubRecord } from './supabase/types';
import { kickoff, hasKickoffTime } from './fixtures';

const HOUR = 3600000;
const DAY = 24 * HOUR;

export interface AttentionCounts {
  pendingApplications: number;
  receiptsToReview: number;
  unreadMessages: number;
  ordersToHandOut: number;
  /** Paid sponsors still hidden: they go on the site when an admin taps Put on site */
  sponsorsToPutOnSite?: number;
  /** Sponsors who signed up on the website in the last two weeks and haven't paid yet */
  sponsorSignups?: number;
}

export interface AttentionItem {
  key: string;
  /** Access area (lib/permissions.ts) needed to act on it */
  area: string;
  count?: number;
  text: string;
  href: string;
  tone: 'urgent' | 'normal';
}

/** A fixture still marked upcoming (or left live) three hours after kick-off, from the last month */
export function needsResult(m: Match, now = Date.now()): boolean {
  if (!['upcoming', 'live', 'halftime'].includes(m.status)) return false;
  const k = kickoff(m);
  // Date-only cup fixtures: give them the whole day
  const due = k + (hasKickoffTime(m) ? 3 * HOUR : DAY);
  return !!k && due < now && now - k < 30 * DAY;
}

/** A real fixture in the next 7 days with no line-up saved */
export function needsLineup(m: Match, now = Date.now()): boolean {
  if (m.status !== 'upcoming' || !countsTowardClubRecord(m)) return false;
  const k = kickoff(m);
  if (!k || k < now || k - now > 7 * DAY) return false;
  const lineup = [...(m.home_lineup_coords || []), ...(m.away_lineup_coords || [])];
  return lineup.length === 0;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const opponentOf = (m: Match) => m.opponent_name || (m.is_club_home ? m.away_team_name : m.home_team_name);

export function attentionItems(slug: string, counts: AttentionCounts, matches: Match[], now = Date.now()): AttentionItem[] {
  const base = `/${slug}/admin`;
  const items: AttentionItem[] = [];
  for (const m of matches.filter(x => needsResult(x, now)).sort((a, b) => kickoff(a) - kickoff(b))) {
    items.push({ key: `result-${m.id}`, area: 'match-center', text: `Enter the result: ${m.home_team_name} vs ${m.away_team_name}`, href: `${base}/match-center?match=${m.id}`, tone: 'urgent' });
  }
  if (counts.pendingApplications) items.push({ key: 'applications', area: 'members', count: counts.pendingApplications, text: `${plural(counts.pendingApplications, 'application', 'applications')} to approve`, href: `${base}/people?tab=applications`, tone: 'urgent' });
  if (counts.receiptsToReview) items.push({ key: 'receipts', area: 'finance', count: counts.receiptsToReview, text: `${plural(counts.receiptsToReview, 'bank transfer receipt', 'bank transfer receipts')} to check`, href: `${base}/finance`, tone: 'urgent' });
  if (counts.unreadMessages) items.push({ key: 'messages', area: 'inquiries', count: counts.unreadMessages, text: `${plural(counts.unreadMessages, 'unread message', 'unread messages')}`, href: `${base}/inquiries`, tone: 'normal' });
  if (counts.sponsorsToPutOnSite) items.push({ key: 'sponsors-paid', area: 'sponsors', count: counts.sponsorsToPutOnSite, text: `${plural(counts.sponsorsToPutOnSite, 'paid sponsor', 'paid sponsors')} waiting to go on the site`, href: `${base}/sponsors?view=new`, tone: 'urgent' });
  if (counts.sponsorSignups) items.push({ key: 'sponsors-new', area: 'sponsors', count: counts.sponsorSignups, text: `${plural(counts.sponsorSignups, 'new sponsor sign-up', 'new sponsor sign-ups')} not paid yet`, href: `${base}/sponsors?view=new`, tone: 'normal' });
  if (counts.ordersToHandOut) items.push({ key: 'orders', area: 'shop', count: counts.ordersToHandOut, text: `${plural(counts.ordersToHandOut, 'shop order', 'shop orders')} to hand out`, href: `${base}/shop#orders`, tone: 'normal' });
  for (const m of matches.filter(x => needsLineup(x, now)).sort((a, b) => kickoff(a) - kickoff(b))) {
    items.push({ key: `lineup-${m.id}`, area: 'lineup', text: `Pick the line-up ${m.is_club_home ? 'vs' : 'at'} ${opponentOf(m)}`, href: `${base}/lineup/draft?match=${m.id}`, tone: 'normal' });
  }
  return items;
}
