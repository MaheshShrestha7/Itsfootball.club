// ==============================================================================
// Friendly match invitations (migration 20261157)
//
// Someone from another club invites one of our teams to a friendly. The invitation is a contact
// enquiry of type 'Friendly Match' whose `details` hold what the fixture needs, so the admin never
// retypes it. Pure helpers shared by the form, /api/contact, the Inbox card and the fixture form.
// ==============================================================================
import type { ClubEvent, ClubTeam, ClubTeamFormat, ContactInquiry, Match } from './supabase/types';
import { buildCalendarItems, filterItems, itemsOnDay, localDate, CALENDAR_KINDS, type CalendarItem } from './admin-calendar';
import { formatClock, formatShortDay } from './dates';
import { DEFAULT_HALF_MINUTES, MAX_HALF_MINUTES, MIN_HALF_MINUTES } from './match-length';

export const FRIENDLY_TYPE = 'Friendly Match' as const;
export const MAX_FRIENDLY_DATES = 3;
export const FRIENDLY_FORMATS: ClubTeamFormat[] = ['5v5', '7v7', '9v9', '11v11'];
export const FORMAT_LABEL: Record<ClubTeamFormat, string> = { '5v5': '5-a-side', '7v7': '7-a-side', '9v9': '9-a-side', '11v11': '11-a-side' };

/** Who hosts, from our side: 'us' = at our ground, 'them' = at theirs */
export type FriendlyHost = 'us' | 'them' | 'either';

export interface FriendlyDate {
  /** 'YYYY-MM-DD' */
  date: string;
  /** 'HH:MM' (24 hour), or '' when they didn't say */
  time: string;
}

export interface FriendlyDetails {
  their_club: string;
  their_team: string;
  format: ClubTeamFormat;
  /** Minutes each half; null = the format's usual length */
  half_minutes: number | null;
  dates: FriendlyDate[];
  host: FriendlyHost;
  /** Their ground, when they host (free text: a ground name or address) */
  their_ground?: string;
  /** Our team's name when they sent it, in case the team is renamed or deleted */
  team_name?: string;
  /** Their crest, shrunk on their device to a small PNG/WebP/JPEG data URL (migration 20261158) */
  crest?: string;
  /** Dates the club suggested instead (set by the server when the club sends them) */
  suggested?: FriendlyDate[];
  /** The suggested date the visitor picked, from their private link */
  picked?: FriendlyDate;
  /** Sent for a club on itsfootball.club: its logo (set by the server, migration 20261159) */
  crest_url?: string;
}

export const MAX_CREST_LENGTH = 16000;
const CREST_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;
/** A crest the form made: a small inline image, nothing else */
export const okCrest = (v: unknown): v is string => typeof v === 'string' && v.length <= MAX_CREST_LENGTH && CREST_RE.test(v);

const clean = (v: unknown, max: number) =>
  (typeof v === 'string' ? v.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max) : '');

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** A real calendar date, from today up to a year ahead ('YYYY-MM-DD' in the club's local time) */
function okDate(value: string, today: string): boolean {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (d.getUTCMonth() !== Number(m[2]) - 1) return false;
  const t = DATE_RE.exec(today);
  if (!t) return true;
  const from = Date.UTC(Number(t[1]), Number(t[2]) - 1, Number(t[3]));
  return d.getTime() >= from && d.getTime() <= from + 366 * 86400000;
}

/**
 * Checks what the form (or anyone posting to /api/contact) sent. `today` is 'YYYY-MM-DD'; dates
 * before it, or more than a year after, are refused. Duplicate dates are dropped.
 */
export function parseFriendly(raw: unknown, today: string): { ok: true; details: FriendlyDetails } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Tell us about the game you have in mind.' };
  const r = raw as Record<string, unknown>;
  const their_club = clean(r.their_club, 120);
  const their_team = clean(r.their_team, 80);
  if (!their_club) return { ok: false, error: 'Add your club’s name.' };
  if (!their_team) return { ok: false, error: 'Add which of your teams would play.' };
  const format = FRIENDLY_FORMATS.includes(r.format as ClubTeamFormat) ? (r.format as ClubTeamFormat) : null;
  if (!format) return { ok: false, error: 'Pick a format.' };
  const halfRaw = r.half_minutes;
  const half = halfRaw === null || halfRaw === undefined || halfRaw === '' ? null : Number(halfRaw);
  if (half !== null && !(Number.isInteger(half) && half >= MIN_HALF_MINUTES && half <= MAX_HALF_MINUTES)) {
    return { ok: false, error: `A half can be ${MIN_HALF_MINUTES} to ${MAX_HALF_MINUTES} minutes.` };
  }
  const list = Array.isArray(r.dates) ? r.dates : [];
  const dates: FriendlyDate[] = [];
  for (const d of list) {
    if (!d || typeof d !== 'object') continue;
    const date = clean((d as Record<string, unknown>).date, 10);
    const time = clean((d as Record<string, unknown>).time, 5);
    if (!date) continue;
    if (!okDate(date, today)) return { ok: false, error: 'Pick dates from today up to a year ahead.' };
    if (time && !TIME_RE.test(time)) return { ok: false, error: 'Check the kick-off times.' };
    if (!dates.some(x => x.date === date && x.time === time)) dates.push({ date, time });
  }
  if (dates.length === 0) return { ok: false, error: 'Add at least one date that suits you.' };
  if (dates.length > MAX_FRIENDLY_DATES) return { ok: false, error: `Up to ${MAX_FRIENDLY_DATES} dates, please.` };
  const host: FriendlyHost = r.host === 'us' || r.host === 'them' ? r.host : 'either';
  const their_ground = host === 'us' ? '' : clean(r.their_ground, 200);
  if (r.crest !== undefined && r.crest !== null && r.crest !== '' && !okCrest(r.crest)) {
    return { ok: false, error: 'The crest couldn’t be used. Try a smaller PNG or JPG.' };
  }
  return {
    ok: true,
    details: {
      their_club, their_team, format, half_minutes: half, dates, host,
      ...(their_ground ? { their_ground } : {}),
      ...(clean(r.team_name, 128) ? { team_name: clean(r.team_name, 128) } : {}),
      ...(okCrest(r.crest) ? { crest: r.crest } : {}),
    },
  };
}

/** Saved dates read back (no date window: they may be in the past by now) */
function savedDates(raw: unknown): FriendlyDate[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap(d => {
    if (!d || typeof d !== 'object') return [];
    const date = clean((d as Record<string, unknown>).date, 10);
    const time = clean((d as Record<string, unknown>).time, 5);
    return DATE_RE.test(date) && (!time || TIME_RE.test(time)) ? [{ date, time }] : [];
  }).slice(0, MAX_FRIENDLY_DATES);
}

/** Dates the club suggests: from today up to a year ahead, up to three, no repeats */
export function parseSuggested(raw: unknown, today: string): { ok: true; dates: FriendlyDate[] } | { ok: false; error: string } {
  const list = Array.isArray(raw) ? raw : [];
  const dates: FriendlyDate[] = [];
  for (const d of list) {
    if (!d || typeof d !== 'object') continue;
    const date = clean((d as Record<string, unknown>).date, 10);
    const time = clean((d as Record<string, unknown>).time, 5);
    if (!date) continue;
    if (!okDate(date, today)) return { ok: false, error: 'Pick dates from today up to a year ahead.' };
    if (time && !TIME_RE.test(time)) return { ok: false, error: 'Check the kick-off times.' };
    if (!dates.some(x => x.date === date && x.time === time)) dates.push({ date, time });
  }
  if (dates.length === 0) return { ok: false, error: 'Pick at least one date to suggest.' };
  if (dates.length > MAX_FRIENDLY_DATES) return { ok: false, error: `Up to ${MAX_FRIENDLY_DATES} dates, please.` };
  return { ok: true, dates };
}

/** The details saved on an enquiry, or null when it isn't a usable invitation */
export function friendlyOf(inquiry: Pick<ContactInquiry, 'inquiry_type' | 'details'>): FriendlyDetails | null {
  if (inquiry.inquiry_type !== FRIENDLY_TYPE || !inquiry.details) return null;
  const parsed = parseFriendly(inquiry.details, '');
  if (!parsed.ok) return null;
  const raw = inquiry.details as Record<string, unknown>;
  const suggested = savedDates(raw.suggested);
  const picked = savedDates(raw.picked ? [raw.picked] : [])[0];
  const crestUrl = typeof raw.crest_url === 'string' && /^https?:\/\/\S+$/.test(raw.crest_url) ? raw.crest_url : null;
  return {
    ...parsed.details,
    ...(suggested.length ? { suggested } : {}),
    ...(picked ? { picked } : {}),
    ...(crestUrl ? { crest_url: crestUrl } : {}),
  };
}

/** "Sat 21 Nov, 3:00 pm" */
export function dateLabel(d: FriendlyDate): string {
  const day = formatShortDay(d.date);
  return d.time ? `${day}, ${formatClock(d.time)}` : day;
}

/** "Leppington Rovers Reserves", or just the club when the team is their first team */
export function opponentName(details: Pick<FriendlyDetails, 'their_club' | 'their_team'>): string {
  const team = details.their_team.trim();
  if (!team || /^(first|1st)\s*(team|xi|grade)?$|^seniors?$|^men'?s$|^women'?s$/i.test(team)) return details.their_club;
  return details.their_club.toLowerCase().includes(team.toLowerCase()) ? details.their_club : `${details.their_club} ${team}`;
}

/** Our side as the other club reads it: "Riverside Rovers FC" for a first team, "Riverside Rovers Seniors", "Riverside Rovers FC U12 Girls" */
export function ourSide(clubName: string, teamName: string | null | undefined): string {
  const team = (teamName || '').trim();
  if (!team || opponentName({ their_club: clubName, their_team: team }) === clubName) return clubName;
  const first = clubName.trim().split(/\s+/)[0]?.toLowerCase() || '';
  return first && team.toLowerCase().includes(first) ? team : `${clubName} ${team}`;
}

export function halfLabel(half: number | null, format: ClubTeamFormat): string {
  return `2 × ${half ?? DEFAULT_HALF_MINUTES[format] ?? 45} min`;
}

export function hostLabel(host: FriendlyHost, side: 'ours' | 'theirs'): string {
  if (host === 'either') return 'Either ground';
  if (side === 'ours') return host === 'us' ? 'At our ground' : 'At their ground';
  return host === 'us' ? 'At your ground' : 'At our ground';
}

/** The plain-text message saved with the enquiry, so older screens and emails still read well */
export function friendlyMessage(details: FriendlyDetails, teamName: string, note: string): string {
  const lines = [
    `Friendly invitation for ${teamName} from ${details.their_club} (${details.their_team}).`,
    `${FORMAT_LABEL[details.format]}, ${halfLabel(details.half_minutes, details.format)}. ${hostLabel(details.host, 'ours')}${details.their_ground ? `: ${details.their_ground}` : ''}.`,
    `Dates that suit them: ${details.dates.map(dateLabel).join('; ')}.`,
  ];
  return note.trim() ? `${lines.join('\n')}\n\n${note.trim()}` : lines.join('\n');
}

/** What they wrote themselves, without the summary friendlyMessage() put in front */
export function friendlyNote(message: string): string {
  const parts = message.split(/\n\n/);
  return parts.length > 1 && parts[0].startsWith('Friendly invitation for ') ? parts.slice(1).join('\n\n').trim() : '';
}

// ------------------------------------------------------------------------------
// Is the team free?
// ------------------------------------------------------------------------------

export type DayCheck =
  | { kind: 'free'; text: string }
  | { kind: 'clash'; text: string }
  | { kind: 'busy'; text: string };

const ALL_KINDS = new Set(CALENDAR_KINDS.map(k => k.key));

/** The club's dated items for the checks below (built once per screen) */
export function calendarFor(p: { clubId: string; matches: Match[]; events: ClubEvent[]; clubTeams: ClubTeam[] }): CalendarItem[] {
  return buildCalendarItems({ ...p, tournaments: [], seasons: [] });
}

const timeOf = (d: Date) => formatClock(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);

/**
 * A day against the team's calendar: another game for the team (or a club tournament) is a clash;
 * training or a club event that day is worth knowing; otherwise it's free. `ignoreMatchId` leaves
 * out the fixture being edited.
 */
export function checkDay(items: CalendarItem[], teamId: string | null, date: string, teamName: string, ignoreMatchId?: string): DayCheck {
  const day = localDate(date);
  if (!day) return { kind: 'free', text: 'Free' };
  const onDay = itemsOnDay(filterItems(items, ALL_KINDS, teamId || 'ALL'), day)
    .filter(i => !i.off && i.kind !== 'season' && !(i.source === 'matches' && i.id === ignoreMatchId));
  const game = onDay.find(i => i.source === 'matches' && (!teamId || i.teamId === teamId || !i.teamId));
  if (game) return { kind: 'clash', text: `${teamName} already plays ${game.title.replace(/^(vs|@) /, '')} that day` };
  const cup = onDay.find(i => i.kind === 'tournament');
  if (cup) return { kind: 'clash', text: `${cup.title} is on that day` };
  const other = onDay.find(i => i.source === 'events');
  if (other) return { kind: 'busy', text: other.allDay ? `Free, but ${other.title} is on that day` : `Free, but ${other.title} is at ${timeOf(other.start)}` };
  return { kind: 'free', text: 'Free' };
}

// ------------------------------------------------------------------------------
// The fixture made from an invitation
// ------------------------------------------------------------------------------

export interface FixturePrefill {
  match_type: 'friendly';
  competition: string;
  team_id: string;
  opponent_name: string;
  opponent_short_name: string;
  is_club_home: boolean;
  match_date: string;
  match_time: string;
  venue: string;
  /** The game's own half length as typed ('' = the team's usual one) */
  half_text: string;
  half_custom: boolean;
}

/** "LRR" for Leppington Rovers Reserves */
export function shortName(name: string): string {
  return (name.split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 4) || name.slice(0, 3)).toUpperCase();
}

/**
 * The fixture form, filled in from the invitation and the date the admin accepted. 'Either' starts
 * as a home game. A half length that differs from the team's usual one is set for this game only.
 */
export function fixtureFromInvitation(details: FriendlyDetails, date: FriendlyDate, team: Pick<ClubTeam, 'id' | 'half_minutes' | 'match_format'> | undefined, homeVenue: string): FixturePrefill {
  const opponent = opponentName(details);
  const home = details.host !== 'them';
  const teamHalf = team?.half_minutes ?? DEFAULT_HALF_MINUTES[team?.match_format || '11v11'] ?? 45;
  const wanted = details.half_minutes ?? DEFAULT_HALF_MINUTES[details.format] ?? 45;
  const custom = wanted !== teamHalf;
  return {
    match_type: 'friendly',
    competition: 'Club Friendly',
    team_id: team?.id || '',
    opponent_name: opponent,
    opponent_short_name: shortName(opponent),
    is_club_home: home,
    match_date: date.date,
    match_time: date.time || '15:00',
    venue: home ? homeVenue : details.their_ground || '',
    half_text: custom ? String(wanted) : '',
    half_custom: custom,
  };
}

/** Teams a visitor can invite: active, and open to friendlies (only true once the migration has run) */
export function invitableTeams(teams: ClubTeam[], clubId: string): ClubTeam[] {
  return teams
    .filter(t => t.club_id === clubId && t.is_active && t.open_to_friendlies === true)
    .sort((a, b) => (a.sort_order ?? 100) - (b.sort_order ?? 100) || a.name.localeCompare(b.name));
}
