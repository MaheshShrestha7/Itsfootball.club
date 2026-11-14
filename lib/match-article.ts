// Gathers what the match report needs from the club's own data: the logged events, the season's record,
// the last meeting and the next fixture. Everything here is already public on the site.
import type { GamificationActivityLog, Club, ClubMember, ClubTeam, ClubTeamMember, Match, MatchEvent, PlayerStats } from './supabase/types';
import { matchArticle, plainText, reportReady, type ArticleInput, type MatchArticle } from './match-report';
import { clubTimeZone, DATE_LOCALE } from './dates';
import { hasKickoffTime, kickoff, teamRecord } from './fixtures';
import { halfMinutes } from './match-length';
import { subDetail, subPlayers } from './match-subs';
import { matchPath } from './slugs';
import { GOAL_EVENT_TYPES, isJuniorFixture, isTeamFixture, juniorMemberIds, juniorPublicName, publicMember, publicScoreHidden, teamOfMatch, withTeamSide } from './teams';
import { tournamentMatchLabel } from './tournament-engine';

const norm = (s?: string | null) => (s || '').trim().toLowerCase();
/** The old placeholder default isn't a competition (the match page hides it too) */
const competitionOf = (m: Pick<Match, 'competition'>) => (m.competition && m.competition !== 'Premier Regional League' ? m.competition : undefined);

const CUP_WORD = /^(cup|league|tournament|shield|trophy|championship|premiership|division|series|festival|carnival|challenge|classic|memorial)$/i;
/** A competition's name as a report can say it ("in the MNFC Cup 2026"). A club event's title is often a
 *  sentence ("ANCC joins MNFC Cup 2026"): the cup's own name is kept when one is in there, else nothing. */
export function competitionName(raw?: string | null): string | undefined {
  const words = (raw || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return undefined;
  const named = (w: string) => /^[A-Z0-9(]/.test(w);
  if (words.length <= 4 || words.every(w => named(w) || /^(of|the|and|&|for|-)$/i.test(w))) return words.join(' ');
  const runs: string[][] = [[]];
  for (const w of words) { if (named(w)) runs.at(-1)!.push(w); else runs.push([]); }
  return runs.filter(run => run.length > 1 && run.some(w => CUP_WORD.test(w.replace(/[^a-z]/gi, '')))).at(-1)?.join(' ');
}
/** The competition a match report names: the fixture's own, else the cup event it is linked to */
export const reportCompetition = (m: Pick<Match, 'competition'>, cupTitle?: string) => competitionName(competitionOf(m)) || competitionName(cupTitle);

export interface ArticleSource {
  club: Pick<Club, 'id' | 'slug' | 'config'>;
  /** The match as the public page shows it (our side named after its team) */
  match: Match;
  /** Its public events (junior names already shortened) */
  events: MatchEvent[];
  /** All the club's matches */
  matches: Match[];
  clubTeams: ClubTeam[];
  /** Public members (junior names already shortened) */
  members: Pick<ClubMember, 'id' | 'club_id' | 'full_name'>[];
  playerStats: PlayerStats[];
  playerOfTheMatch?: string;
  /** A junior team's game: no season goal tallies for individual children */
  juniorFixture?: boolean;
  /** The cup this game belongs to, when it is linked to a club event */
  cup?: { id: string; title: string };
  /** The ground guide's page, when the fixture has one */
  groundHref?: string;
}

export function articleInput(s: ArticleSource): ArticleInput {
  const { club, match, matches } = s;
  const zone = clubTimeZone(club);
  const teamGame = isTeamFixture(match);
  const ourSide = teamGame ? (match.is_club_home !== false ? 'home' : 'away') : undefined;
  const date = match.match_date ? new Date(match.match_date) : null;
  const valid = !!date && !isNaN(date.getTime());
  const hour = valid && hasKickoffTime(match) ? Number(date!.toLocaleString('en-AU', { timeZone: zone, hour: 'numeric', hour12: false })) % 24 : null;
  const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString(DATE_LOCALE, { timeZone: zone, ...o });

  // The team's own games against other clubs, scores public
  const team = teamOfMatch(match, s.clubTeams);
  const teamGames = matches.filter(m => m.club_id === club.id && isTeamFixture(m) && teamOfMatch(m, s.clubTeams)?.id === team?.id && !publicScoreHidden(m, s.clubTeams));
  const opponent = (m: Match) => (m.is_club_home !== false ? m.away_team_name : m.home_team_name);
  const earlier = teamGames.filter(m => m.id !== match.id && m.status === 'completed' && kickoff(m) < kickoff(match));
  const last = teamGame ? earlier.filter(m => norm(opponent(m)) === norm(opponent(match))).sort((a, b) => kickoff(b) - kickoff(a))[0] : undefined;
  const next = teamGame
    ? teamGames.filter(m => m.id !== match.id && kickoff(m) > kickoff(match) && !['cancelled', 'postponed', 'completed'].includes(m.status)).sort((a, b) => kickoff(a) - kickoff(b))[0]
    : undefined;
  const record = teamGame && match.season ? teamRecord([...earlier, match], match.season) : undefined;
  // Goals for and against, over the same games the record counts
  const counted = [...earlier, match].filter(m => (m.season || match.season) === match.season && m.home_score != null && m.away_score != null);
  const ourGoals = (m: Match) => (m.is_club_home !== false ? m.home_score : m.away_score) ?? 0;
  const theirGoals = (m: Match) => (m.is_club_home !== false ? m.away_score : m.home_score) ?? 0;
  const sum = (f: (m: Match) => number) => counted.reduce((n, m) => n + f(m), 0);
  const versus = teamGame ? earlier.filter(m => norm(opponent(m)) === norm(opponent(match)) && m.home_score != null && m.away_score != null) : [];
  // The team's other games on the same calendar day
  const dayOf = (m: Match) => { const d = new Date(m.match_date); return isNaN(d.getTime()) ? '' : fmt(d, { day: 'numeric', month: 'numeric', year: 'numeric' }); };
  const dayGames = teamGame && valid && hasKickoffTime(match)
    ? teamGames.filter(m => dayOf(m) === dayOf(match) && hasKickoffTime(m) && !['cancelled', 'postponed'].includes(m.status)).sort((a, b) => kickoff(a) - kickoff(b))
    : [];
  // Our starters, as the line-ups tab shows them
  const coords = (ourSide && !match.tournament_id && match.match_type !== 'internal' && (ourSide === 'home' ? match.home_lineup_coords : match.away_lineup_coords)) || [];
  const shown = (n: string) => (s.juniorFixture ? juniorPublicName(n) : n).trim();

  // Season goals, once this match's stats are saved (before that the totals don't include it)
  const stats = match.is_audited && !s.juniorFixture && match.season ? s.playerStats.filter(p => p.club_id === club.id && p.season === match.season) : [];
  const clubMembers = s.members.filter(m => m.club_id === club.id);
  const nameOf = (memberId: string) => clubMembers.find(m => m.id === memberId)?.full_name.trim();
  // A typed name only counts when exactly one member has it
  const seasonGoals: Record<string, number> = {};
  for (const p of stats) {
    const name = nameOf(p.member_id);
    if (name && p.goals > 0 && clubMembers.filter(m => norm(m.full_name) === norm(name)).length === 1) seasonGoals[name] = p.goals;
  }
  const best = Math.max(0, ...stats.map(p => p.goals));
  const leaders = stats.filter(p => p.goals === best && best > 0);

  const when = (m: Match) => {
    const d = new Date(m.match_date);
    if (isNaN(d.getTime())) return '';
    const day = fmt(d, { weekday: 'long', day: 'numeric', month: 'long' }).replace(',', '');
    return hasKickoffTime(m) ? `at ${d.toLocaleTimeString(DATE_LOCALE, { timeZone: zone, hour: 'numeric', minute: '2-digit' })} on ${day}` : `on ${day}`;
  };

  const events = s.events.filter(e => e.match_id === match.id);
  return {
    id: match.id,
    home: match.home_team_name,
    away: match.away_team_name,
    homeScore: match.home_score ?? 0,
    awayScore: match.away_score ?? 0,
    ourSide,
    competition: reportCompetition(match, s.cup?.title),
    stage: tournamentMatchLabel(match) || undefined,
    venue: match.venue || undefined,
    day: valid ? fmt(date!, { weekday: 'long' }) : undefined,
    partOfDay: hour === null ? undefined : hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening',
    halfMinutes: halfMinutes(match),
    goals: events.filter(e => GOAL_EVENT_TYPES.includes(e.event_type)).map(e => ({
      minute: e.minute, added: e.added_minute || 0, side: e.team_side, player: e.player_name, assist: e.assist_player_name || undefined,
      penalty: e.event_type === 'penalty', ownGoal: e.event_type === 'own_goal',
    })),
    subs: events.filter(e => e.event_type === 'sub').map(e => ({ side: e.team_side, on: subPlayers(e)?.on || e.player_name, off: subPlayers(e)?.off, minute: e.minute })),
    yellows: events.filter(e => e.event_type === 'yellow_card').map(e => ({ side: e.team_side, player: e.player_name })),
    reds: events.filter(e => e.event_type === 'red_card').map(e => ({ side: e.team_side, player: e.player_name, minute: e.minute, added: e.added_minute || 0 })),
    playerOfTheMatch: s.playerOfTheMatch,
    seasonGoals,
    topScorer: leaders.length === 1 ? nameOf(leaders[0].member_id) : undefined,
    kickoff: valid && hasKickoffTime(match) ? date!.toLocaleTimeString(DATE_LOCALE, { timeZone: zone, hour: 'numeric', minute: '2-digit' }) : undefined,
    aSide: Number(match.match_format?.match(/^(\d+)v/)?.[1]) !== 11 ? Number(match.match_format?.match(/^(\d+)v/)?.[1]) || undefined : undefined,
    lineup: coords.length ? { starters: coords.map(p => shown(p.name)), captain: coords.find(p => p.is_captain) && shown(coords.find(p => p.is_captain)!.name), keeper: coords.find(p => p.position === 'GK') && shown(coords.find(p => p.position === 'GK')!.name) } : undefined,
    gameOfDay: dayGames.length > 1 ? [dayGames.findIndex(m => m.id === match.id) + 1, dayGames.length] : undefined,
    sameDay: dayGames.filter(m => m.id !== match.id && m.status === 'completed' && m.home_score != null && m.away_score != null)
      .map(m => ({ opponent: opponent(m), ourScore: ourGoals(m), theirScore: theirGoals(m), href: matchPath(club.slug, m), later: kickoff(m) > kickoff(match) })),
    record: record && { ...record, ...(counted.length === record.played ? { goalsFor: sum(ourGoals), goalsAgainst: sum(theirGoals) } : {}) },
    meetings: versus.length ? { played: versus.length, won: versus.filter(m => ourGoals(m) > theirGoals(m)).length, drawn: versus.filter(m => ourGoals(m) === theirGoals(m)).length, lost: versus.filter(m => ourGoals(m) < theirGoals(m)).length } : undefined,
    lastMeeting: last && {
      home: last.home_team_name, away: last.away_team_name, homeScore: last.home_score ?? 0, awayScore: last.away_score ?? 0,
      date: fmt(new Date(last.match_date), { day: 'numeric', month: 'long', ...(valid && new Date(last.match_date).getFullYear() !== date!.getFullYear() ? { year: 'numeric' } : {}) }),
      href: matchPath(club.slug, last),
    },
    next: next && when(next) ? { opponent: opponent(next), competition: competitionName(competitionOf(next)), when: when(next), venue: next.venue || undefined, href: matchPath(club.slug, next) } : undefined,
    shootout: match.home_penalty_score != null && match.away_penalty_score != null ? { home: match.home_penalty_score, away: match.away_penalty_score } : undefined,
    links: {
      competition: s.cup ? `/${club.slug}/events/${s.cup.id}` : match.tournament_id ? `/${club.slug}/tournaments/${match.tournament_id}` : undefined,
      venue: s.groundHref,
    },
  };
}

/** The report for a finished match whose score is public; null otherwise */
export function articleFor(s: ArticleSource): MatchArticle | null {
  if (s.match.status !== 'completed' || publicScoreHidden(s.match, s.clubTeams)) return null;
  return matchArticle(articleInput(s));
}

/** A match's events as the public sees them: every name shortened ("Sam T.") in a junior team's fixture */
export function publicEvents<E extends MatchEvent>(events: E[], juniorFixture: boolean): E[] {
  if (!juniorFixture) return events;
  return events.map(e => ({
    ...e, player_name: juniorPublicName(e.player_name), assist_player_name: e.assist_player_name ? juniorPublicName(e.assist_player_name) : e.assist_player_name,
    // A substitution's sentence names both players in full: shortened like every other name here
    ...(subPlayers(e) ? { detail_text: subDetail(juniorPublicName(subPlayers(e)!.on), juniorPublicName(subPlayers(e)!.off)) } : {}),
  }));
}

/** Whether a finished match has more to report than its score (see reportReady) */
export function matchReportReady(match: Match, events: MatchEvent[], hasPlayerOfTheMatch: boolean): boolean {
  return reportReady({
    goalsLogged: events.filter(e => e.match_id === match.id && GOAL_EVENT_TYPES.includes(e.event_type)).length,
    hasLineup: !!(match.home_lineup_coords?.length || match.away_lineup_coords?.length),
    hasPlayerOfTheMatch,
  });
}

export interface ReportCard { id: string; href: string; title: string; summary: string; published_at: string; cover?: string }

/** The club's match reports as news cards (each opens its match page), for the News list */
export function matchReportCards(s: {
  club: Pick<Club, 'id' | 'slug' | 'name' | 'short_name' | 'config' | 'junior_includes_u18'>;
  matches: Match[]; matchEvents: MatchEvent[]; members: ClubMember[]; clubTeams: ClubTeam[]; clubTeamMembers: ClubTeamMember[];
  playerStats: PlayerStats[]; activityLogs: Pick<GamificationActivityLog, 'event_type' | 'reference_id' | 'member_id'>[];
  events: { id: string; club_id: string; title: string }[];
}): ReportCard[] {
  const { club } = s;
  const juniorIds = juniorMemberIds(s.members, s.clubTeams, s.clubTeamMembers, { includeU18: club.junior_includes_u18 !== false });
  const members = s.members.filter(m => m.club_id === club.id).map(m => publicMember(m, juniorIds));
  const clubMatches = s.matches.filter(m => m.club_id === club.id);
  const cards: ReportCard[] = [];
  for (const stored of clubMatches) {
    if (stored.status !== 'completed') continue;
    const juniorFixture = isJuniorFixture(stored, s.clubTeams);
    const events = publicEvents(s.matchEvents.filter(e => e.match_id === stored.id), juniorFixture);
    const potmId = s.activityLogs.find(l => l.event_type === 'match_motm' && l.reference_id === stored.id)?.member_id;
    const potm = potmId ? members.find(m => m.id === potmId)?.full_name : undefined;
    if (!matchReportReady(stored, events, !!potm)) continue;
    const cup = stored.event_id ? s.events.find(e => e.id === stored.event_id && e.club_id === club.id) : undefined;
    const article = articleFor({
      club, match: withTeamSide(stored, club, s.clubTeams), events, matches: clubMatches, clubTeams: s.clubTeams, members,
      playerStats: s.playerStats, playerOfTheMatch: potm, juniorFixture, cup: cup && { id: cup.id, title: cup.title },
    });
    if (!article) continue;
    cards.push({
      id: stored.id, href: matchPath(club.slug, stored), title: article.headline, summary: plainText(article.lead),
      published_at: stored.match_date, cover: stored.match_flyer_url || undefined,
    });
  }
  return cards;
}
