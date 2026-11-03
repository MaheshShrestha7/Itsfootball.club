import type { ClubEvent, ClubSeason, Match, Tournament } from './supabase/types';
import { DATE_LOCALE, SITE_TIME_ZONE } from './dates';
import { kickoff } from './fixtures';

/** The public list pages (fixtures, events, tournaments) split what's coming from what's done.
 *  A fixture or event counts as past a day after it starts: a game that kicked off this afternoon
 *  stays under "Upcoming" until the club enters the score, rather than vanishing mid-match. */
const DAY = 86400000;

/** A fixture whose kick-off is over a day gone but nobody entered the result */
export const isAwaitingResult = (m: Pick<Match, 'status' | 'match_date'>, now = Date.now()) =>
  m.status === 'upcoming' && kickoff(m) > 0 && kickoff(m) < now - DAY;

/** Played, called off, or scheduled in the past (result to come). Postponed games wait for a new date. */
export const isPastFixture = (m: Pick<Match, 'status' | 'match_date'>, now = Date.now()) =>
  m.status === 'completed' || m.status === 'cancelled' || isAwaitingResult(m, now);

/** Over once its end (or its start, with no end) is a day gone */
export const isPastEvent = (e: Pick<ClubEvent, 'start_time' | 'end_time'>, now = Date.now()) => {
  const t = Date.parse(e.end_time || e.start_time);
  return !Number.isNaN(t) && t < now - DAY;
};

/** Finished, or (never started) its last day is over. A live one is never past. */
export const isPastTournament = (t: Pick<Tournament, 'status' | 'start_date' | 'end_date'>, now = Date.now()) => {
  if (t.status === 'completed') return true;
  if (t.status === 'ongoing') return false;
  const last = Date.parse(((t.end_date || t.start_date) || '').slice(0, 10));
  return !Number.isNaN(last) && last < now - DAY;
};

/** The season a game belongs to: its own label, else the club season its date falls in, else '' */
export function seasonOfMatch(m: Pick<Match, 'season' | 'match_date'>, seasons: Pick<ClubSeason, 'name' | 'start_date' | 'end_date'>[]): string {
  if (m.season) return m.season;
  const day = (m.match_date || '').slice(0, 10);
  return seasons.find(s => s.start_date && s.end_date && day >= s.start_date && day <= s.end_date)?.name || '';
}

/** Seasons that have games in `games`, newest first ('' = games with no season, always last).
 *  A club season's start date orders it; a label the club never set up as a season goes by its name. */
export function seasonOptions(seasonOf: string[], seasons: Pick<ClubSeason, 'name' | 'start_date'>[]): string[] {
  const start = new Map(seasons.map(s => [s.name, s.start_date || '']));
  const names = [...new Set(seasonOf)];
  return names.sort((a, b) => {
    if (!a || !b) return a ? -1 : b ? 1 : 0;
    const sa = start.get(a), sb = start.get(b);
    if (sa && sb) return sb.localeCompare(sa);
    return b.localeCompare(a, undefined, { numeric: true });
  });
}

const monthKey = (iso: string) => {
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return { key: '', label: 'Date to be confirmed' };
  const opts = { timeZone: SITE_TIME_ZONE } as const;
  const parts = new Intl.DateTimeFormat('en-CA', { ...opts, year: 'numeric', month: '2-digit' }).format(d);
  return { key: parts, label: d.toLocaleDateString(DATE_LOCALE, { ...opts, month: 'long', year: 'numeric' }) };
};

/** Items in month groups ("November 2026"), keeping the order they came in.
 *  Months read in the site's zone, as LocalTime's first draw, so a game late on the 31st stays in its month. */
export function groupByMonth<T>(items: T[], dateOf: (item: T) => string): { key: string; label: string; items: T[] }[] {
  const groups: { key: string; label: string; items: T[] }[] = [];
  for (const item of items) {
    const { key, label } = monthKey(dateOf(item) || '');
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(item);
    else groups.push({ key, label, items: [item] });
  }
  return groups;
}
