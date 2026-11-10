// The substitutes for one side's published line-up, as the match page lists them under the starters:
// the bench the coach named (league and friendly fixtures), else the other players who said they're in.
// The match page's Matchday Squad and the share graphic's Team list both read it, so they agree.
import type { Match } from './supabase/types';

export function lineupBench<P extends { id: string }>(match: Match, side: 'home' | 'away', squad: P[], available: P[]): P[] {
  const coords = (side === 'home' ? match.home_lineup_coords : match.away_lineup_coords) || [];
  const starterIds = new Set(coords.map(c => c.member_id).filter((id): id is string => !!id));
  const byId = new Map(squad.map(p => [p.id, p]));
  const named = !match.tournament_id && match.bench_member_ids?.length
    ? match.bench_member_ids.map(id => byId.get(id)).filter((p): p is P => !!p)
    : null;
  return (named || available).filter(p => !starterIds.has(p.id));
}
