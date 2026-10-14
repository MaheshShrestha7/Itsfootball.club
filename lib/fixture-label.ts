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
