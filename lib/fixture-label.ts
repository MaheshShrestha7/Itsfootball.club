import type { Match } from './supabase/types';
import { DATE_LOCALE } from '@/lib/dates';

/**
 * Short name for a fixture in a drop-down: the opponent comes first ("vs Granville Rage · 17 Oct",
 * "at Auburn Warriors · 31 Oct"), so it still reads on a phone where the start of the text is all
 * that shows. Matches between two other sides (e.g. a cup the club hosts) keep both names.
 */
export function fixtureLabel(match: Pick<Match, 'home_team_name' | 'away_team_name' | 'match_date'>, clubName: string): string {
  const name = (s: string) => s.trim().toLowerCase();
  const club = name(clubName || '');
  const teams =
    club && name(match.home_team_name || '') === club ? `vs ${match.away_team_name}`
    : club && name(match.away_team_name || '') === club ? `at ${match.home_team_name}`
    : `${match.home_team_name} vs ${match.away_team_name}`;
  const date = new Date(match.match_date);
  return Number.isNaN(date.getTime())
    ? teams
    : `${teams} · ${date.toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short', year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' })}`;
}

/**
 * The match-type word to show beside a fixture, or null when it would mislead: "friendly" is the
 * type for any game against another club, so a league game ("Sydney Metro League") shows no
 * "Friendly" tag. Also null when the competition name already says it.
 */
export function matchTypeTag(match: Pick<Match, 'match_type' | 'competition'>): string | null {
  const type = match.match_type;
  if (!type) return null;
  const comp = (match.competition || '').toLowerCase();
  if (type === 'friendly' && comp && !comp.includes('friendly') && comp !== 'premier regional league') return null;
  const word = type === 'internal' ? 'internal' : type === 'tournament' ? 'tournament' : 'friendly';
  return comp.includes(word) ? null : word;
}
