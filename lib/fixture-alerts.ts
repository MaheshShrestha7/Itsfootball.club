// When saving a fixture should tell its team (F27-2): it was cancelled or postponed, or an
// upcoming game's day, kick-off or ground changed. Past games and score updates stay quiet.
import type { Match } from './supabase/types';

export type FixtureChange = 'cancelled' | 'postponed' | 'moved';
type Shape = Pick<Match, 'status' | 'match_date' | 'match_time' | 'venue'>;

const AHEAD = ['upcoming', 'postponed'];
const sameVenue = (a?: string | null, b?: string | null) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();

export function fixtureChangeOf(before: Shape, after: Shape, now = Date.now()): FixtureChange | null {
  // A game that was due more than six hours ago is being tidied up, not changed
  if ((Date.parse(before.match_date) || 0) < now - 6 * 3600000 && (Date.parse(after.match_date) || 0) < now) return null;
  if (after.status === 'cancelled' && before.status !== 'cancelled') return AHEAD.includes(before.status) ? 'cancelled' : null;
  if (after.status === 'postponed' && before.status !== 'postponed') return before.status === 'upcoming' ? 'postponed' : null;
  if (!AHEAD.includes(before.status) || !AHEAD.includes(after.status)) return null;
  const movedTime = Math.abs((Date.parse(after.match_date) || 0) - (Date.parse(before.match_date) || 0)) >= 60000
    || (before.match_time || '') !== (after.match_time || '');
  return movedTime || !sameVenue(before.venue, after.venue) ? 'moved' : null;
}
