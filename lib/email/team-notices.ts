// F27-2: messages to one team (players, their parents and guardians, and the team's staff), and
// the alert when one of its fixtures is cancelled, postponed or moved. Each goes by email (once
// per address), into each member's Messages inbox in the club app, and, when the club asks or for
// fixture changes, as a push notification to the club's followers.
import type { SupabaseClient } from '@supabase/supabase-js';
import { clubBaseUrl, clubBrand, type ClubBrandRow } from './club-brand';
import { memberRecipient, MEMBER_RECIPIENT_COLUMNS, normalizeEmail, type EmailDraft } from './club-emails';
import { fixtureChangeNotice, teamMessage } from './templates';
import type { FixtureChange } from '@/lib/fixture-alerts';
import { formatMatchWhen } from './format';
import type { PushMessage } from '@/lib/push';

export const MAX_TEAM_TITLE = 120;
export const MAX_TEAM_BODY = 2000;

interface TeamMember {
  id: string;
  full_name: string;
  email: string | null;
  guardian_name?: string | null;
  guardian_email?: string | null;
  role: string | null;
  roles: string[] | null;
}

export interface TeamAudience {
  teamName: string;
  members: TeamMember[];
}

const isPlayer = (m: TeamMember) =>
  [...(m.roles || []), ...(m.role || '').split(',')].some(r => r.trim().toLowerCase() === 'player');

/**
 * Approved, current members of a team (any team role). A fixture without a team belongs to the
 * club's main team; a club that hasn't set up teams reaches all its players.
 */
export async function teamAudience(db: SupabaseClient, clubId: string, teamId: string | null): Promise<TeamAudience | null> {
  const { data: teams } = await db.from('club_teams').select('id, name, short_name, is_default').eq('club_id', clubId);
  const team = teamId ? (teams || []).find(t => t.id === teamId) : (teams || []).find(t => t.is_default);
  if (teamId && !team) return null;

  const select = `id, ${MEMBER_RECIPIENT_COLUMNS}, role, roles, status`;
  let rows: (TeamMember & { status: string | null })[] = [];
  if (team) {
    const { data: links } = await db.from('club_team_members').select('member_id').eq('team_id', team.id).eq('is_active', true);
    const ids = [...new Set((links || []).map(l => l.member_id as string))];
    for (let i = 0; i < ids.length; i += 200) {
      const { data } = await db.from('club_members').select(select)
        .eq('club_id', clubId).eq('membership_status', 'approved').in('id', ids.slice(i, i + 200));
      rows.push(...((data || []) as typeof rows));
    }
  }
  if (!team || (!teamId && !rows.length)) {
    const { data } = await db.from('club_members').select(select).eq('club_id', clubId).eq('membership_status', 'approved');
    rows = ((data || []) as typeof rows).filter(isPlayer);
  }
  return {
    teamName: team ? (team.short_name?.trim() || team.name) : 'the squad',
    members: rows.filter(m => m.status !== 'alumni'),
  };
}

/** One email per address (a parent of two players in the team gets it once) */
function emailDrafts(
  club: ClubBrandRow,
  members: TeamMember[],
  kind: EmailDraft['kind'],
  refId: string,
  keyFor: (to: string) => string,
  render: (r: { name: string; childName?: string }) => EmailDraft['render']
): { drafts: EmailDraft[]; noEmail: number } {
  const seen = new Set<string>();
  const drafts: EmailDraft[] = [];
  let noEmail = 0;
  for (const m of members) {
    const r = memberRecipient(m);
    if (!r) { noEmail++; continue; }
    const to = normalizeEmail(r.to);
    if (seen.has(to)) continue;
    seen.add(to);
    drafts.push({ key: keyFor(to), club, kind, refId, to: r.to, render: render(r) });
  }
  return { drafts, noEmail };
}

/** The app inbox copy: one per member (guardians read their children's messages) */
const inboxRows = (club: ClubBrandRow, members: TeamMember[], subject: string, content: string) =>
  members.map(m => ({
    club_id: club.id,
    member_id: m.id,
    sender_type: 'admin',
    sender_name: club.name,
    subject: subject.slice(0, 255),
    category: 'General',
    content,
    is_read: false,
  }));

export interface PreparedTeamNotice {
  label: string;
  drafts: EmailDraft[];
  inbox: ReturnType<typeof inboxRows>;
  members: number;
  noEmail: number;
  push?: PushMessage;
  /** Names this notice: the inbox copies and push go once per key */
  onceKey: string;
}

export function teamMessageNotice(
  club: ClubBrandRow,
  audience: TeamAudience,
  m: { id: string; title: string; body: string; push: boolean }
): PreparedTeamNotice {
  const brand = clubBrand(club);
  const base = clubBaseUrl(club);
  const { drafts, noEmail } = emailDrafts(club, audience.members, 'notice_team', m.id, to => `notice_team:${m.id}:${to}`,
    r => unsubscribeUrl => teamMessage({ brand, unsubscribeUrl, recipientName: r.name, childName: r.childName, team: audience.teamName, title: m.title, body: m.body, link: `${base}/member?tab=messages` }));
  return {
    label: `Message to ${audience.teamName}: ${m.title}`,
    drafts,
    inbox: inboxRows(club, audience.members, `${audience.teamName}: ${m.title}`, m.body),
    members: audience.members.length,
    noEmail,
    push: m.push ? { title: `${audience.teamName}: ${m.title}`, body: m.body.slice(0, 140), url: `/${club.slug}`, tag: `team:${m.id}` } : undefined,
    onceKey: `team:${m.id}`,
  };
}

export interface FixtureChangeInput {
  change: FixtureChange;
  /** The fixture as it is now, and as it was (for "moved") */
  now: { date: string; time?: string | null; venue?: string | null };
  was?: { date: string; time?: string | null; venue?: string | null };
}

export function fixtureChangeNoticeFor(
  club: ClubBrandRow,
  audience: TeamAudience,
  match: { id: string; slug?: string | null; home_team_name: string; away_team_name: string },
  input: FixtureChangeInput
): PreparedTeamNotice {
  const brand = clubBrand(club);
  const base = clubBaseUrl(club);
  const fixture = `${match.home_team_name} vs ${match.away_team_name}`;
  const when = formatMatchWhen(input.now.date, input.now.time);
  const wasWhen = input.was ? formatMatchWhen(input.was.date, input.was.time) : undefined;
  const venue = input.now.venue?.trim() || '';
  // A new key for each new date and place, so a game moved twice is announced twice
  const version = `${input.change}:${input.now.date.slice(0, 16)}:${input.now.time || ''}:${venue.toLowerCase().slice(0, 40)}`;
  const link = `${base}/match/${match.slug || match.id}`;
  const { drafts, noEmail } = emailDrafts(club, audience.members, 'notice_fixture', match.id, to => `notice_fixture:${match.id}:${version}:${to}`,
    r => unsubscribeUrl => fixtureChangeNotice({ brand, unsubscribeUrl, recipientName: r.name, childName: r.childName, team: audience.teamName, fixture, change: input.change, when, venue, wasWhen, wasVenue: input.was?.venue || undefined, link }));
  const headline = input.change === 'cancelled' ? 'Cancelled' : input.change === 'postponed' ? 'Postponed' : 'Moved';
  const text = input.change === 'moved'
    ? `${fixture} has changed. Now: ${when}${venue ? ` at ${venue}` : ''}.${wasWhen && wasWhen !== when ? ` (Was ${wasWhen}.)` : ''}`
    : `${fixture} (${when}) is ${input.change}.${input.change === 'postponed' ? ' The club will let you know the new date.' : ''}`;
  return {
    label: `${headline}: ${fixture}`,
    drafts,
    inbox: inboxRows(club, audience.members, `${headline}: ${fixture}`, text),
    members: audience.members.length,
    noEmail,
    push: { title: `${headline}: ${fixture}`, body: text.slice(0, 140), url: `/${club.slug}/match/${match.slug || match.id}`, tag: `match-${match.id}` },
    onceKey: `fixture:${match.id}:${version}`,
  };
}

/** A fixture date or time from the client: an ISO timestamp or YYYY-MM-DD, and HH:MM */
export const validDate = (v: unknown): v is string => typeof v === 'string' && v.length <= 40 && !Number.isNaN(Date.parse(v));
export const validTime = (v: unknown): v is string | null | undefined => v == null || v === '' || (typeof v === 'string' && /^\d{1,2}:\d{2}$/.test(v));
