// Social media posts (Admin > Social media, migration 20261187): what the club could post right now,
// worked out from its fixtures and events, with a caption written only from what the data says.
// Nothing here posts anywhere: the admin shares each one from their phone (Phase 1). Pure, no browser.
import { DATE_LOCALE, formatClock } from '@/lib/dates';
import { hasKickoffTime, kickoff } from '@/lib/fixtures';
import { SITE_URL, matchPath } from '@/lib/slugs';
import { tagLink } from '@/lib/visit-source';
import type { ClubEvent, Match } from '@/lib/supabase/types';

export type SocialTrigger = 'fixture' | 'team' | 'kickoff' | 'halftime' | 'fulltime' | 'motm' | 'event';
/** When a fixture or event post becomes ready: as soon as it's on the site, or a set time before it starts */
export type SocialTiming = 'now' | 'day' | 'two_days' | 'week';

export interface SocialRule { on: boolean; when?: SocialTiming }
export interface SocialSettings { rules: Record<SocialTrigger, SocialRule>; hashtags: string }

export const SOCIAL_TRIGGERS: { key: SocialTrigger; label: string; what: string; timings?: SocialTiming[] }[] = [
  { key: 'fixture', label: 'Matchday', what: 'Matchday graphic with the date, kick-off and ground', timings: ['day', 'two_days', 'now'] },
  { key: 'team', label: 'Team announced', what: 'Matchday squad graphic once the lineup is saved' },
  { key: 'kickoff', label: 'Kick-off', what: 'Graphic and live score link while the game is on' },
  { key: 'halftime', label: 'Half time', what: 'Score at the break (not for teams that hide scores)' },
  { key: 'fulltime', label: 'Full time', what: 'Result graphic with the scorers' },
  { key: 'motm', label: 'Player of the Match', what: 'Player of the Match card once it is in the stats' },
  { key: 'event', label: 'Events', what: 'Public events, with the flyer if there is one', timings: ['now', 'week', 'two_days', 'day'] },
];

export const TIMING_LABEL: Record<SocialTiming, string> = {
  now: 'As soon as it is added', day: 'A day before', two_days: 'Two days before', week: 'A week before',
};
const TIMING_MS: Record<SocialTiming, number> = { now: Infinity, day: 864e5, two_days: 2 * 864e5, week: 7 * 864e5 };

export const DEFAULT_SOCIAL: SocialSettings = {
  rules: {
    fixture: { on: true, when: 'day' }, team: { on: true }, kickoff: { on: true }, halftime: { on: false },
    fulltime: { on: true }, motm: { on: false }, event: { on: true, when: 'now' },
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
    };
  }
  return { rules, hashtags: typeof r.hashtags === 'string' ? r.hashtags.slice(0, 300) : '' };
}

export interface SocialPost {
  /** Stable id for marks: "fixture:<match id>", "event:<event id>" */
  key: string;
  trigger: SocialTrigger;
  title: string;
  /** When it became (or becomes) worth posting, ms */
  readyAt: number;
  /** Ready now, or still to come */
  ready: boolean;
  match?: Match;
  event?: ClubEvent;
  caption: string;
}

export type SocialMark = { status: 'shared' | 'skipped'; caption?: string | null; by_name?: string | null; at: string };

export interface QueueInput {
  matches: Match[];
  events: ClubEvent[];
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
/** A finished game's posts stay in the list this long */
const AFTER_MATCH = 3 * 24 * HOUR;
/** A game still "live" this long after kick-off was never ended in Match Centre: no live posts */
const LIVE_FOR = 5 * HOUR;

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

/** The caption for one post, from the data only. Hashtags go on their own last line. */
export function socialCaption(trigger: SocialTrigger, input: Pick<QueueInput, 'club' | 'settings' | 'timeZone'>, x: { match?: Match; event?: ClubEvent; hideScore?: boolean; motm?: string }): string {
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
  const tags = input.settings.hashtags.trim();
  if (tags) lines.push('', tags);
  return lines.join('\n');
}

/** Everything worth posting now or soon, newest need first. Done ones (shared or skipped) are left in
 *  with ready=true so the screen can list them under "Done"; the caller splits by its marks. */
export function socialQueue(input: QueueInput): SocialPost[] {
  const { settings: { rules }, now } = input;
  const out: SocialPost[] = [];
  const add = (trigger: SocialTrigger, readyAt: number, title: string, x: { match?: Match; event?: ClubEvent; motm?: string }) => {
    if (!rules[trigger].on) return;
    const id = x.match?.id || x.event?.id;
    out.push({
      key: `${trigger}:${id}`, trigger, title, readyAt, ready: readyAt <= now, ...x,
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
      if (input.hasLineup(m)) add('team', ko - 3 * 24 * HOUR, `Team announced: ${vs}`, { match: m });
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

  return out.sort((a, b) => b.readyAt - a.readyAt);
}

/** Ready posts split by what the admin has done with them; posts still to come, soonest first */
export function splitQueue(posts: SocialPost[], marks: Record<string, SocialMark>) {
  return {
    todo: posts.filter(p => p.ready && !marks[p.key]),
    later: posts.filter(p => !p.ready).sort((a, b) => a.readyAt - b.readyAt),
    done: posts.filter(p => p.ready && marks[p.key]),
  };
}
