// Social media posts (Admin > Social media, migration 20261187): what the club could post right now,
// worked out from its fixtures and events, with a caption written only from what the data says.
// The admin shares each one from their phone, or posts it to the club's connected Facebook Page and
// Instagram (phase 2, /api/social/publish). Pure, no browser.
import { DATE_LOCALE, formatClock } from '@/lib/dates';
import { hasKickoffTime, kickoff } from '@/lib/fixtures';
import { SITE_URL, matchPath } from '@/lib/slugs';
import { juniorPublicName } from '@/lib/teams';
import { tagLink } from '@/lib/visit-source';
import type { ClubEvent, Match } from '@/lib/supabase/types';

export type SocialTrigger = 'fixture' | 'team' | 'kickoff' | 'halftime' | 'fulltime' | 'motm' | 'event' | 'birthday';
/** When a fixture or event post becomes ready: as soon as it's on the site, or a set time before it starts */
export type SocialTiming = 'now' | 'day' | 'two_days' | 'week';

/** auto: posted to the connected Facebook Page and Instagram by itself (AUTO_TRIGGERS only); otherwise an admin checks it first */
export interface SocialRule { on: boolean; when?: SocialTiming; auto?: boolean }
export interface SocialSettings { rules: Record<SocialTrigger, SocialRule>; hashtags: string }

export const SOCIAL_TRIGGERS: { key: SocialTrigger; label: string; what: string; timings?: SocialTiming[] }[] = [
  { key: 'fixture', label: 'Matchday', what: 'Matchday graphic with the date, kick-off and ground', timings: ['day', 'two_days', 'now'] },
  { key: 'team', label: 'Team announced', what: 'Matchday squad graphic once the lineup is saved' },
  { key: 'kickoff', label: 'Kick-off', what: 'Graphic and live score link while the game is on' },
  { key: 'halftime', label: 'Half time', what: 'Score at the break (not for teams that hide scores)' },
  { key: 'fulltime', label: 'Full time', what: 'Result graphic with the scorers' },
  { key: 'motm', label: 'Player of the Match', what: 'Player of the Match card once it is in the stats' },
  { key: 'event', label: 'Events', what: 'Public events, with the flyer if there is one', timings: ['now', 'week', 'two_days', 'day'] },
  { key: 'birthday', label: 'Player birthdays', what: 'Birthday card from squad dates of birth (junior privacy rules apply)' },
];

/** Posts that can go out by themselves: the moment matters, and the words and graphic come from the score */
export const AUTO_TRIGGERS = ['kickoff', 'halftime', 'fulltime'] as const;

/** The post a status change makes: kick-off, the break, or the final whistle */
export function autoTriggerFor(prev: Match['status'], now: Match['status']): (typeof AUTO_TRIGGERS)[number] | null {
  if (prev === now) return null;
  if (now === 'live' && prev === 'upcoming') return 'kickoff';
  if (now === 'halftime') return 'halftime';
  if (now === 'completed' && prev !== 'cancelled' && prev !== 'postponed') return 'fulltime';
  return null;
}

export const TIMING_LABEL: Record<SocialTiming, string> = {
  now: 'As soon as it is added', day: 'A day before', two_days: 'Two days before', week: 'A week before',
};
const TIMING_MS: Record<SocialTiming, number> = { now: Infinity, day: 864e5, two_days: 2 * 864e5, week: 7 * 864e5 };

export const DEFAULT_SOCIAL: SocialSettings = {
  rules: {
    fixture: { on: true, when: 'day' }, team: { on: true }, kickoff: { on: true }, halftime: { on: false },
    fulltime: { on: true }, motm: { on: false }, event: { on: true, when: 'now' }, birthday: { on: true },
  },
  hashtags: '',
};

/** Saved settings over the defaults; anything unreadable falls back to the default */
export function readSocialSettings(raw: unknown): SocialSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as { rules?: Record<string, Partial<SocialRule>>; hashtags?: unknown };
  const rules = { ...DEFAULT_SOCIAL.rules };
  for (const t of SOCIAL_TRIGGERS) {
    const saved = r.rules?.[t.key];
    if (!saved) continue;
    rules[t.key] = {
      on: typeof saved.on === 'boolean' ? saved.on : rules[t.key].on,
      ...(t.timings ? { when: t.timings.includes(saved.when as SocialTiming) ? saved.when as SocialTiming : rules[t.key].when } : {}),
      ...((AUTO_TRIGGERS as readonly string[]).includes(t.key) && saved.auto === true ? { auto: true } : {}),
    };
  }
  return { rules, hashtags: typeof r.hashtags === 'string' ? r.hashtags.slice(0, 300) : '' };
}

export interface BirthdayMember {
  id: string;
  full_name: string;
  date_of_birth?: string | null;
  jersey_number?: number | null;
  player_position?: string | null;
  photo_url?: string | null;
  photo_consent?: boolean | null;
  status?: string | null;
  membership_status?: string | null;
  is_junior?: boolean;
  team_name?: string | null;
}

export interface BirthdayPostData {
  memberId: string;
  /** Public-safe display name (shortened for juniors) */
  displayName: string;
  /** Photo URL (stripped for juniors without photo consent) */
  photoUrl?: string;
  jerseyNumber?: number;
  position?: string;
  teamName?: string;
  /** Age turning on this birthday (never shown on junior cards) */
  turningAge?: number;
  /** Formatted birthday label e.g. "24 November" */
  dateLabel: string;
  /** Short date label e.g. "24 NOV" */
  dateShort: string;
  isJunior: boolean;
  year: number;
}

export interface SocialPost {
  /** Stable id for marks: "fixture:<match id>", "event:<event id>", "birthday:<member id>:<year>" */
  key: string;
  trigger: SocialTrigger;
  title: string;
  /** When it became (or becomes) worth posting, ms */
  readyAt: number;
  /** Ready now, or still to come */
  ready: boolean;
  match?: Match;
  event?: ClubEvent;
  birthday?: BirthdayPostData;
  caption: string;
}

/** posting: the site is posting it now; failed: posting didn't work, so it's still to do */
export type SocialMark = { status: 'shared' | 'skipped' | 'posting' | 'failed'; caption?: string | null; by_name?: string | null; at: string };

export interface QueueInput {
  matches: Match[];
  events: ClubEvent[];
  members?: BirthdayMember[];
  settings: SocialSettings;
  club: { slug: string; name: string; custom_domain?: string | null };
  timeZone: string;
  /** Match ids whose score stays off the public site (junior grassroots rules) */
  hideScore: (m: Match) => boolean;
  /** The Player of the Match by match id, as the public site names them */
  motm: (m: Match) => string | undefined;
  /** Whether the club's side has a saved lineup */
  hasLineup: (m: Match) => boolean;
  now: number;
}

const HOUR = 36e5;
const DAY = 24 * HOUR;
/** A finished game's posts stay in the list this long */
const AFTER_MATCH = 3 * DAY;
/** A game still "live" this long after kick-off was never ended in Match Centre: no live posts */
const LIVE_FOR = 5 * HOUR;
/** Upcoming birthdays shown in "Coming up" */
const BIRTHDAY_LOOKAHEAD_DAYS = 14;

/** The club's public address for a path on its site ("/slug/match/x"), its own domain when it has one */
export function clubUrl(club: { slug: string; custom_domain?: string | null }, path: string): string {
  if (!club.custom_domain) return `${SITE_URL}${path}`;
  const rest = path.replace(new RegExp(`^/${club.slug}(?=/|$)`), '');
  return `https://${club.custom_domain}${rest || '/'}`;
}

const sides = (m: Match) => {
  const home = m.is_club_home ?? true;
  return { us: home ? m.home_team_name : m.away_team_name, them: home ? m.away_team_name : m.home_team_name };
};

function when(m: Match, tz: string): { day: string; time: string } {
  const d = new Date(m.match_date);
  const day = Number.isNaN(d.getTime()) ? ''
    : d.toLocaleDateString(DATE_LOCALE, { weekday: 'short', day: 'numeric', month: 'short', timeZone: hasKickoffTime(m) ? tz : 'UTC' }).replace(',', '');
  const time = m.match_time ? formatClock(m.match_time)
    : hasKickoffTime(m) ? d.toLocaleTimeString(DATE_LOCALE, { hour: 'numeric', minute: '2-digit', timeZone: tz }) : '';
  return { day, time };
}

/** "Craik Park FC 3–1 Liverpool Rangers", home side first as the scoreboard reads */
const scoreLine = (m: Match) => `${m.home_team_name} ${m.home_score}–${m.away_score} ${m.away_team_name}`;

const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function isLeapYear(y: number) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** Local calendar date (year, month 1..12, day 1..31) in `timeZone` */
function localYmd(ms: number, timeZone: string): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(ms));
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value || 0);
  return { y: get('year'), m: get('month'), d: get('day') };
}

/** Build a BirthdayPostData for any member (for the queue or on-demand birthday card maker) */
export function buildBirthdayPostData(m: BirthdayMember, year: number): BirthdayPostData | null {
  const dob = (m.date_of_birth || '').slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  const isJunior = !!m.is_junior;
  const displayName = isJunior ? juniorPublicName(m.full_name) : m.full_name.trim();
  if (!displayName) return null;
  const photoUrl = isJunior ? (m.photo_consent === true && m.photo_url ? m.photo_url : undefined) : (m.photo_url || undefined);
  let dateLabel = 'Club Birthday';
  let dateShort = 'BIRTHDAY';
  let turningAge: number | undefined;
  if (match) {
    const birthYear = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const clampedDay = month === 2 && day === 29 && !isLeapYear(year) ? 28 : day;
      dateLabel = `${clampedDay} ${MONTHS_LONG[month - 1]}`;
      dateShort = `${String(clampedDay).padStart(2, '0')} ${MONTHS_SHORT[month - 1]}`;
      const age = year - birthYear;
      if (!isJunior && age > 0 && age < 120) turningAge = age;
    }
  }
  return {
    memberId: m.id,
    displayName,
    photoUrl,
    jerseyNumber: typeof m.jersey_number === 'number' && Number.isFinite(m.jersey_number) ? m.jersey_number : undefined,
    position: m.player_position || undefined,
    teamName: m.team_name || undefined,
    turningAge,
    dateLabel,
    dateShort,
    isJunior,
    year,
  };
}

/** The caption for one post, from the data only. Hashtags go on their own last line. */
export function socialCaption(
  trigger: SocialTrigger,
  input: Pick<QueueInput, 'club' | 'settings' | 'timeZone'>,
  x: { match?: Match; event?: ClubEvent; birthday?: BirthdayPostData; hideScore?: boolean; motm?: string },
): string {
  const { club, timeZone } = input;
  const lines: string[] = [];
  const m = x.match;
  if (m) {
    const { us, them } = sides(m);
    const { day, time } = when(m, timeZone);
    // Tagged so visits from posts show under Social in Analytics; kept short, it's read in the caption
    const link = tagLink(clubUrl(club, matchPath(club.slug, m)), 'social', 'social', '');
    const at = m.venue ? ` at ${m.venue}` : '';
    if (trigger === 'fixture') lines.push(`Matchday${day ? ` ${day}` : ''}: ${us} vs ${them}${time ? `, kick-off ${time}` : ''}${at}. Come down and support!`, `Live scores: ${link}`);
    if (trigger === 'team') lines.push(`Team news: here's our matchday squad for ${us} vs ${them}${day ? ` on ${day}` : ''}.`, `Follow the game: ${link}`);
    if (trigger === 'kickoff') lines.push(`We're under way! ${us} vs ${them}.`, `Follow it live: ${link}`);
    if (trigger === 'halftime') lines.push(`Half time: ${scoreLine(m)}.`, `Follow the second half live: ${link}`);
    if (trigger === 'fulltime') lines.push(x.hideScore ? `That's full time: ${us} vs ${them}.` : `Full time: ${scoreLine(m)}.`, `Match report: ${link}`);
    if (trigger === 'motm' && x.motm) lines.push(`Player of the Match for ${us} vs ${them}: ${x.motm}. Well played!`, link);
  }
  const e = x.event;
  if (e && trigger === 'event') {
    const start = new Date(e.start_time);
    const day = start.toLocaleDateString(DATE_LOCALE, { weekday: 'long', day: 'numeric', month: 'long', timeZone }).replace(',', '');
    const time = start.toLocaleTimeString(DATE_LOCALE, { hour: 'numeric', minute: '2-digit', timeZone });
    const price = (e.ticket_price_cents || 0) > 0 ? ` Tickets $${((e.ticket_price_cents || 0) / 100).toFixed(2).replace(/\.00$/, '')}.` : '';
    lines.push(`${e.title}: ${day}, ${time}${e.location ? ` at ${e.location}` : ''}.${price}`,
      `Details: ${tagLink(clubUrl(club, `/${club.slug}/events/${e.id}`), 'social', 'social', '')}`);
  }
  const b = x.birthday;
  if (b && trigger === 'birthday') {
    const roleBits = [b.jerseyNumber != null ? `#${b.jerseyNumber}` : '', b.position || ''].filter(Boolean).join(' ');
    const teamBit = b.teamName ? ` (${b.teamName})` : '';
    const detail = roleBits ? ` Wishing our ${roleBits}${teamBit}` : ` Wishing ${b.displayName.split(/\s+/)[0]}`;
    lines.push(`Happy Birthday ${b.displayName}!${detail} a brilliant day from everyone at ${club.name}. Drop your birthday wishes below!`);
  }
  const tags = input.settings.hashtags.trim();
  if (tags) lines.push('', tags);
  return lines.join('\n');
}

/** Everything worth posting now or soon, newest need first. Done ones (shared or skipped) are left in
 *  with ready=true so the screen can list them under "Done"; the caller splits by its marks. */
export function socialQueue(input: QueueInput): SocialPost[] {
  const { settings: { rules }, now, timeZone } = input;
  const out: SocialPost[] = [];
  const add = (
    trigger: SocialTrigger,
    readyAt: number,
    title: string,
    x: { match?: Match; event?: ClubEvent; birthday?: BirthdayPostData; motm?: string },
    customKey?: string,
  ) => {
    if (!rules[trigger].on) return;
    const id = x.match?.id || x.event?.id || x.birthday?.memberId;
    out.push({
      key: customKey || `${trigger}:${id}`, trigger, title, readyAt, ready: readyAt <= now, ...x,
      caption: socialCaption(trigger, input, { ...x, hideScore: x.match ? input.hideScore(x.match) : false }),
    });
  };

  for (const m of input.matches) {
    // The club's own team games only: not in-house games, not tournament brackets
    if (m.tournament_id || (m.match_type || 'friendly') === 'internal') continue;
    const ko = kickoff(m);
    if (!ko) continue;
    const { us, them } = sides(m);
    const vs = `${us} vs ${them}`;
    const before = (t: SocialTiming | undefined) => (t === 'now' || !t ? (Date.parse(m.created_at || '') || 0) : ko - TIMING_MS[t]);
    if (m.status === 'upcoming' && ko > now - 2 * HOUR) {
      add('fixture', before(rules.fixture.when), `Matchday: ${vs}`, { match: m });
      if (input.hasLineup(m)) add('team', ko - 3 * DAY, `Team announced: ${vs}`, { match: m });
    }
    const liveLong = now - ko > LIVE_FOR;
    if ((m.status === 'live' || m.status === 'halftime') && !liveLong) add('kickoff', Math.min(now, ko), `Kick-off: ${vs}`, { match: m });
    if (m.status === 'halftime' && !liveLong && !input.hideScore(m)) add('halftime', Math.min(now, ko), `Half time: ${vs}`, { match: m });
    if (m.status === 'completed' && now - ko < AFTER_MATCH) {
      add('fulltime', ko, `Full time: ${vs}`, { match: m });
      const motm = input.motm(m);
      if (motm) add('motm', ko + 1, `Player of the Match: ${vs}`, { match: m, motm });
    }
  }

  for (const e of input.events) {
    if (!e.is_public || e.category === 'training' || e.category === 'match' || e.completed_at) continue;
    const start = Date.parse(e.start_time);
    if (!start || start < now) continue;
    const t = rules.event.when;
    const readyAt = t === 'now' || !t ? (Date.parse(e.created_at || '') || 0) : start - TIMING_MS[t];
    add('event', readyAt, `Event: ${e.title}`, { event: e });
  }

  if (rules.birthday.on && input.members?.length) {
    const today = localYmd(now, timeZone);
    const todayDayNum = Math.floor(Date.UTC(today.y, today.m - 1, today.d) / DAY);
    for (const member of input.members) {
      if (member.status === 'alumni') continue;
      if (member.membership_status && member.membership_status !== 'approved') continue;
      const dob = (member.date_of_birth || '').slice(0, 10);
      const parsed = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
      if (!parsed) continue;
      const month = Number(parsed[2]);
      const day = Number(parsed[3]);
      if (month < 1 || month > 12 || day < 1 || day > 31) continue;

      // Check current year and next year (covers Dec -> Jan rollover)
      let matchedYear: number | null = null;
      let diffDays = Infinity;
      for (const yr of [today.y, today.y + 1]) {
        const clampedDay = month === 2 && day === 29 && !isLeapYear(yr) ? 28 : day;
        const bdayNum = Math.floor(Date.UTC(yr, month - 1, clampedDay) / DAY);
        const diff = bdayNum - todayDayNum;
        if (diff >= -1 && diff <= BIRTHDAY_LOOKAHEAD_DAYS) {
          matchedYear = yr;
          diffDays = diff;
          break;
        }
      }
      if (matchedYear === null) continue;
      const data = buildBirthdayPostData(member, matchedYear);
      if (!data) continue;
      const readyAt = diffDays <= 0 ? now + diffDays * DAY : now + diffDays * DAY;
      add(
        'birthday',
        readyAt,
        `Happy Birthday: ${data.displayName}`,
        { birthday: data },
        `birthday:${member.id}:${matchedYear}`,
      );
    }
  }

  return out.sort((a, b) => b.readyAt - a.readyAt);
}

/** Ready posts split by what the admin has done with them; posts still to come, soonest first */
export function splitQueue(posts: SocialPost[], marks: Record<string, SocialMark>) {
  const isDone = (p: SocialPost) => marks[p.key]?.status === 'shared' || marks[p.key]?.status === 'skipped';
  return {
    todo: posts.filter(p => p.ready && !isDone(p)),
    later: posts.filter(p => !p.ready).sort((a, b) => a.readyAt - b.readyAt),
    done: posts.filter(p => p.ready && isDone(p)),
  };
}
