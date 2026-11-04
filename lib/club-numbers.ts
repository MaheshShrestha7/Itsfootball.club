import { isPlayerMember, toClubRole, countsTowardClubRecord } from './supabase/types';
import type { ClubEvent, ClubMember, EventCategory, Match, Sponsor, SponsorTier } from './supabase/types';
import { clubResult, latestFirst, type ClubOutcome } from './fixtures';

/**
 * The club home page's "Club's Impact in Numbers" section (components/ClubIdentitySection.tsx).
 * One rule set for both the server route (app/api/clubs/[clubSlug]/identity-stats) and the
 * page's own data, so the two can never disagree.
 */

type NumbersMatch = Pick<
  Match,
  'status' | 'season' | 'match_date' | 'home_score' | 'away_score' | 'home_penalty_score' | 'away_penalty_score' |
  'is_club_home' | 'match_type' | 'tournament_id'
>;

export interface ClubNumbersInput<M extends NumbersMatch> {
  /** Counted members only (no waiting or rejected applications) */
  members: Pick<ClubMember, 'role' | 'roles'>[];
  /** The club's own matches (any status) */
  matches: M[];
  /** Teams that hide their scores publicly (junior rules): their games add no goals or results */
  scoreHidden: (m: M) => boolean;
  currentSeason: string;
  events: Pick<ClubEvent, 'start_time' | 'category' | 'rsvp_count'>[];
  /** Sponsors shown on the site, club-wide only */
  sponsors: Pick<Sponsor, 'tier'>[];
  /** Active teams */
  teams: number;
  now?: number;
}

export interface ClubNumbers {
  players: number;
  /** Members who don't play and aren't staff */
  supporters: number;
  season: string;
  /** Played (finished or live) this season */
  games: number;
  won: number;
  drawn: number;
  lost: number;
  goals: number;
  cleanSheets: number;
  /** Up to the last 5 finished results with public scores, oldest first */
  form: ClubOutcome[];
  allTimeGames: number;
  allTimeGoals: number;
  events: number;
  upcomingEvents: number;
  /** Sign-ups across all events */
  eventSignups: number;
  eventTypes: { label: string; count: number }[];
  sponsors: number;
  sponsorTiers: { label: string; count: number }[];
  teams: number;
}

const PLAYED = new Set(['completed', 'full_time', 'live', 'halftime']);
const FINISHED = new Set(['completed', 'full_time']);

export const EVENT_TYPE_LABEL: Record<EventCategory, string> = {
  match: 'Match day', training: 'Training', social: 'Social', agm: 'AGM', trial: 'Trial', tournament: 'Tournament',
};
const TIER_ORDER: SponsorTier[] = ['platinum', 'gold', 'silver', 'bronze', 'grassroots'];
const TIER_NAME: Record<SponsorTier, string> = {
  platinum: 'Platinum', gold: 'Gold', silver: 'Silver', bronze: 'Bronze', grassroots: 'Grassroots',
};

function tally<K extends string>(keys: (K | null | undefined)[], order: readonly K[], label: (k: K) => string) {
  const counts = new Map<K, number>();
  for (const k of keys) if (k) counts.set(k, (counts.get(k) || 0) + 1);
  return order.filter(k => counts.has(k)).map(k => ({ label: label(k), count: counts.get(k)! }));
}

export function clubNumbers<M extends NumbersMatch>(input: ClubNumbersInput<M>): ClubNumbers {
  const now = input.now ?? Date.now();
  const players = input.members.filter(isPlayerMember).length;
  const supporters = input.members.filter(m => {
    if (isPlayerMember(m)) return false;
    const role = toClubRole(m.role, m.roles);
    return role === 'supporter' || role === 'member';
  }).length;

  const played = input.matches.filter(m => countsTowardClubRecord(m) && PLAYED.has(m.status));
  // A game saved without a season is counted in the current one, as before
  const inSeason = played.filter(m => !m.season || m.season === input.currentSeason);
  const goalsOf = (list: M[]) =>
    list.filter(m => !input.scoreHidden(m)).reduce((sum, m) => sum + clubResult(m).us, 0);

  const results = (list: M[]) =>
    list.filter(m => FINISHED.has(m.status) && !input.scoreHidden(m)).map(m => ({ m, r: clubResult(m) }));
  const seasonResults = results(inSeason);
  const count = (o: ClubOutcome) => seasonResults.filter(x => x.r.outcome === o).length;

  const form = results(played)
    .sort((a, b) => latestFirst(a.m, b.m))
    .slice(0, 5)
    .map(x => x.r.outcome)
    .filter((o): o is ClubOutcome => !!o)
    .reverse();

  const upcomingEvents = input.events.filter(e => {
    const t = new Date(e.start_time).getTime();
    return Number.isFinite(t) && t > now;
  }).length;

  return {
    players,
    supporters,
    season: input.currentSeason,
    games: inSeason.length,
    won: count('W'),
    drawn: count('D'),
    lost: count('L'),
    goals: goalsOf(inSeason),
    cleanSheets: seasonResults.filter(x => x.r.them === 0).length,
    form,
    allTimeGames: played.length,
    allTimeGoals: goalsOf(played),
    events: input.events.length,
    upcomingEvents,
    eventSignups: input.events.reduce((sum, e) => sum + Math.max(0, Number(e.rsvp_count) || 0), 0),
    eventTypes: tally(input.events.map(e => e.category), Object.keys(EVENT_TYPE_LABEL) as EventCategory[], k => EVENT_TYPE_LABEL[k]),
    sponsors: input.sponsors.length,
    sponsorTiers: tally(input.sponsors.map(s => s.tier), TIER_ORDER, k => TIER_NAME[k]),
    teams: input.teams,
  };
}

/** Nothing worth showing yet (a brand-new club): the section hides */
export function hasClubNumbers(n: ClubNumbers): boolean {
  return n.players + n.supporters + n.allTimeGames + n.events + n.sponsors > 0;
}
