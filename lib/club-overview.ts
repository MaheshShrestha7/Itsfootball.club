// The club admin Dashboard's "Club at a glance" cards (app/[clubSlug]/admin/page.tsx).
// Pure helpers: the time range, the bar buckets, and the counts made from data the admin already
// loads (members, fixtures, sponsors). Money, replies, sponsor clicks and visits come from
// get_club_overview (supabase/migrations/20261150_club_overview.sql).

import { countsTowardClubRecord, isPlayerMember, type ClubMember, type ClubSeason, type ClubTeam, type Match, type MatchEvent, type Sponsor } from './supabase/types';
import { clubResult } from './fixtures';
import { isCountedMember } from './people';
import { isEndingSoon, isSponsorOnSite, daysUntilEnd } from './sponsors';
import { teamOfMatch } from './teams';
import { defaultSeasonLabel } from './season';
import { DATE_LOCALE } from './dates';

export type OverviewPeriod = 'season' | 30 | 90;

export const PERIOD_OPTIONS: { id: OverviewPeriod; label: string }[] = [
  { id: 'season', label: 'Season' },
  { id: 30, label: '30 days' },
  { id: 90, label: '90 days' },
];

export interface OverviewRange {
  period: OverviewPeriod;
  /** The season name payments and fixtures are filed under (season view only) */
  season: string | null;
  from: Date;
  to: Date;
  /** "Season 2026/27", "Last 30 days" */
  label: string;
}

const DAY = 24 * 3600 * 1000;

/** A YYYY-MM-DD date as local midnight */
export function localDay(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** The local calendar date of a time, as YYYY-MM-DD */
export function dayKey(t: Date | number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * The range the cards count over. A season runs from its start date to the day after its end
 * date; with no season set up, the default season label from 1 August (as lib/season.ts assumes).
 * The day views end now.
 */
export function overviewRange(
  period: OverviewPeriod,
  season: Pick<ClubSeason, 'name' | 'start_date' | 'end_date'> | null | undefined,
  now = Date.now(),
): OverviewRange {
  const to = new Date(now);
  if (period !== 'season') {
    const from = new Date(to.getFullYear(), to.getMonth(), to.getDate() - (period - 1));
    return { period, season: null, from, to, label: `Last ${period} days` };
  }
  if (season?.start_date && season?.end_date) {
    const from = localDay(season.start_date);
    const end = localDay(season.end_date);
    return { period, season: season.name, from, to: new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1), label: `Season ${season.name}` };
  }
  const name = season?.name || defaultSeasonLabel(to);
  const startYear = Number(name.slice(0, 4)) || to.getFullYear();
  return { period, season: name, from: new Date(startYear, 7, 1), to: new Date(startYear + 1, 7, 1), label: `Season ${name}` };
}

export interface Bucket { label: string; short: string; start: number; end: number; now: boolean }

/** Bars for a range: one a month for a season, one a week for 90 days, one a day for 30 */
export function overviewBuckets(range: Pick<OverviewRange, 'period' | 'from' | 'to'>, now = Date.now()): Bucket[] {
  const out: Bucket[] = [];
  const f = range.from;
  if (range.period === 'season') {
    for (let i = 0; ; i++) {
      const s = new Date(f.getFullYear(), f.getMonth() + i, 1);
      const start = i === 0 ? f.getTime() : s.getTime();
      if (start >= range.to.getTime() || i > 13) break;
      const end = Math.min(new Date(f.getFullYear(), f.getMonth() + i + 1, 1).getTime(), range.to.getTime());
      const label = s.toLocaleDateString(DATE_LOCALE, { month: 'short' });
      out.push({ label, short: label.charAt(0), start, end, now: now >= start && now < end });
    }
    return out;
  }
  const step = range.period === 90 ? 7 : 1;
  for (let i = 0; i < range.period; i += step) {
    const s = new Date(f.getFullYear(), f.getMonth(), f.getDate() + i);
    const start = s.getTime();
    const end = Math.min(new Date(f.getFullYear(), f.getMonth(), f.getDate() + i + step).getTime(), range.to.getTime() + 1);
    if (start > range.to.getTime()) break;
    const label = s.toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short' });
    out.push({ label: step === 7 ? `Week of ${label}` : label, short: '', start, end, now: now >= start && now < end });
  }
  return out;
}

/** Sum dated values into the buckets (each value at local midnight of its day, or at its time) */
export function fillBuckets(buckets: Bucket[], rows: { at: Date | number | string; n: number }[]): number[] {
  const sums = buckets.map(() => 0);
  for (const r of rows) {
    const t = typeof r.at === 'string' ? (r.at.length === 10 ? localDay(r.at).getTime() : new Date(r.at).getTime()) : new Date(r.at).getTime();
    const i = buckets.findIndex(b => t >= b.start && t < b.end);
    if (i >= 0) sums[i] += Number(r.n) || 0;
  }
  return sums;
}

/** Bar heights as percentages of the tallest (a 0 stays a stub) */
export function barHeights(values: number[]): number[] {
  const max = Math.max(0, ...values);
  return values.map(v => (max > 0 ? Math.round((v / max) * 100) : 0));
}

const inRange = (iso: string | null | undefined, range: Pick<OverviewRange, 'from' | 'to'>) => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= range.from.getTime() && t < range.to.getTime();
};

/** Whole days from now until a membership end date (negative once it has passed) */
export function daysLeft(expiresAt: string, now = Date.now()): number {
  return Math.ceil((new Date(expiresAt).getTime() - now) / DAY);
}

export interface MembersSummary {
  counted: number;
  players: number;
  others: number;
  added: number;
  waiting: ClubMember[];
  renewSoon: (ClubMember & { days: number })[];
  expired: (ClubMember & { days: number })[];
  joins: { at: string; n: number }[];
}

/** Members as People counts them; renewals as Finance's Overview lists them, split into due and expired */
export function membersSummary(members: ClubMember[], range: Pick<OverviewRange, 'from' | 'to'>, now = Date.now()): MembersSummary {
  const counted = members.filter(m => isCountedMember(m));
  const players = counted.filter(m => isPlayerMember(m)).length;
  const dated = members
    .filter(m => m.membership_status === 'approved' && m.membership_expires_at)
    .map(m => ({ ...m, days: daysLeft(m.membership_expires_at, now) }));
  return {
    counted: counted.length,
    players,
    others: counted.length - players,
    added: counted.filter(m => inRange(m.created_at, range)).length,
    waiting: members.filter(m => m.membership_status === 'pending'),
    renewSoon: dated.filter(m => m.days >= 0 && m.days <= 30).sort((a, b) => a.days - b.days),
    expired: dated.filter(m => m.days < 0).sort((a, b) => b.days - a.days),
    joins: counted.filter(m => m.created_at).map(m => ({ at: m.created_at as string, n: 1 })),
  };
}

/** The team filter: every club game, or one team's */
export function matchesForTeam<M extends Match>(matches: M[], teams: ClubTeam[], teamId: string | null): M[] {
  const games = matches.filter(m => countsTowardClubRecord(m));
  if (!teamId) return games;
  return games.filter(m => teamOfMatch(m, teams)?.id === teamId);
}

export interface RecordSummary { played: number; won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number }

/** Finished club games in the range (filed under the season, or played in the last days) */
export function seasonRecord(games: Match[], range: Pick<OverviewRange, 'season' | 'from' | 'to'>): RecordSummary {
  const r: RecordSummary = { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 };
  for (const m of games) {
    if (m.status !== 'completed') continue;
    if (range.season ? m.season !== range.season : !inRange(m.match_date, range)) continue;
    const res = clubResult(m);
    if (!res.outcome) continue;
    r.played += 1;
    r.goalsFor += res.us;
    r.goalsAgainst += res.them;
    if (res.outcome === 'W') r.won += 1; else if (res.outcome === 'D') r.drawn += 1; else r.lost += 1;
  }
  return r;
}

/** The next club games still to play, soonest first (a game stays "next" until 3 hours after kick-off) */
export function upcomingGames<M extends Match>(games: M[], limit = 2, now = Date.now()): M[] {
  return games
    .filter(m => m.status === 'upcoming' && new Date(m.match_date).getTime() >= now - 3 * 3600 * 1000)
    .sort((a, b) => a.match_date.localeCompare(b.match_date))
    .slice(0, limit);
}

/** The club's side of a fixture's names: "vs Eastside" at home, "at Eastside" away */
export function opponentLine(m: Pick<Match, 'is_club_home' | 'home_team_name' | 'away_team_name' | 'opponent_name'>): string {
  const home = m.is_club_home !== false;
  const other = m.opponent_name || (home ? m.away_team_name : m.home_team_name);
  return `${home ? 'vs' : 'at'} ${other}`;
}

export interface SponsorsSummary { onSite: number; endingSoon: (Sponsor & { days: number | null })[] }

export function sponsorsSummary(sponsors: Sponsor[], now = Date.now()): SponsorsSummary {
  return {
    onSite: sponsors.filter(s => isSponsorOnSite(s, now)).length,
    endingSoon: sponsors.filter(s => isEndingSoon(s, now)).map(s => ({ ...s, days: daysUntilEnd(s, now) })).sort((a, b) => (a.days ?? 0) - (b.days ?? 0)),
  };
}

/** "/riverside/fixtures" -> "Fixtures"; the club home page -> "Home page" */
export function pageName(path: string, clubSlug: string): string {
  const clean = path.split('?')[0].replace(/\/+$/, '');
  const rest = clean.startsWith(`/${clubSlug}`) ? clean.slice(clubSlug.length + 1) : clean;
  if (!rest || rest === '/') return 'Home page';
  const first = rest.replace(/^\//, '').split('/')[0];
  const label = first.replace(/[-_]+/g, ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Share of a total, as a whole percent */
export const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

// ---------------- Games and availability detail screen ----------------

export type Outcome = 'W' | 'D' | 'L';
export interface PlayedGame<M extends Match = Match> { match: M; us: number; them: number; outcome: Outcome; home: boolean }

/** Finished club games in the range, oldest first, each from the club's side */
export function playedGames<M extends Match>(games: M[], range: Pick<OverviewRange, 'season' | 'from' | 'to'>): PlayedGame<M>[] {
  const out: PlayedGame<M>[] = [];
  for (const m of games) {
    if (m.status !== 'completed') continue;
    if (range.season ? m.season !== range.season : !inRange(m.match_date, range)) continue;
    const res = clubResult(m);
    if (!res.outcome) continue;
    out.push({ match: m, us: res.us, them: res.them, outcome: res.outcome, home: m.is_club_home !== false });
  }
  return out.sort((a, b) => a.match.match_date.localeCompare(b.match.match_date));
}

export interface SideRecord { played: number; won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number }
export interface FormSummary extends SideRecord {
  winRate: number;
  cleanSheets: number;
  /** Up to the last five outcomes, oldest first (so the newest sits on the right) */
  last5: Outcome[];
  home: SideRecord;
  away: SideRecord;
}

const emptySide = (): SideRecord => ({ played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 });
const addTo = (r: SideRecord, g: PlayedGame) => {
  r.played += 1; r.goalsFor += g.us; r.goalsAgainst += g.them;
  if (g.outcome === 'W') r.won += 1; else if (g.outcome === 'D') r.drawn += 1; else r.lost += 1;
};

export function formSummary(played: PlayedGame[]): FormSummary {
  const all = emptySide(), home = emptySide(), away = emptySide();
  let cleanSheets = 0;
  for (const g of played) {
    addTo(all, g);
    addTo(g.home ? home : away, g);
    if (g.them === 0) cleanSheets += 1;
  }
  return { ...all, winRate: pct(all.won, all.played), cleanSheets, last5: played.slice(-5).map(g => g.outcome), home, away };
}

/** Players a side fields for the game's format ('9v9' -> 9); 11 when it isn't set */
export function playersNeeded(format: string | null | undefined): number {
  const n = Number(/^(\d+)v\d+$/.exec(format || '')?.[1]);
  return n > 0 && n <= 11 ? n : 11;
}

export interface Scorer { name: string; goals: number; assists: number }

/** Goals and assists for the club's side, from the events logged in Match Centre. Own goals
 *  count for the score, not for a scorer. Names as logged (events store the player's name). */
export function topScorers(events: Pick<MatchEvent, 'match_id' | 'event_type' | 'team_side' | 'player_name' | 'assist_player_name'>[], played: PlayedGame[]): Scorer[] {
  const sideOf = new Map(played.map(g => [g.match.id, g.home ? 'home' : 'away']));
  const by = new Map<string, Scorer>();
  const bump = (raw: string | undefined, key: 'goals' | 'assists') => {
    const name = (raw || '').trim();
    if (!name) return;
    const id = name.toLowerCase();
    const s = by.get(id) || { name, goals: 0, assists: 0 };
    s[key] += 1;
    by.set(id, s);
  };
  for (const e of events) {
    const side = sideOf.get(e.match_id);
    if (!side || e.team_side !== side) continue;
    if (e.event_type !== 'goal' && e.event_type !== 'penalty') continue;
    bump(e.player_name, 'goals');
    bump(e.assist_player_name, 'assists');
  }
  return [...by.values()];
}

/** Results grouped by the local day they were played, newest day first */
export function byDay<T extends { match: Pick<Match, 'match_date'> }>(rows: T[]): { key: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const r of [...rows].sort((a, b) => b.match.match_date.localeCompare(a.match.match_date))) {
    const key = dayKey(new Date(r.match.match_date));
    groups.set(key, [...(groups.get(key) || []), r]);
  }
  return [...groups].map(([key, items]) => ({ key, items }));
}

/** Goalkeepers and the defenders the Save Player Stats screen offers a clean sheet to */
export const KEEPER_POSITIONS = ['GK'] as const;
export const DEFENDER_POSITIONS = ['CB', 'LB', 'RB'] as const;
export type CleanSheetGroup = 'all' | 'keepers' | 'defenders';
const inGroup = (pos: string | undefined, group: CleanSheetGroup) =>
  group === 'all' || (group === 'keepers' ? (KEEPER_POSITIONS as readonly string[]) : (DEFENDER_POSITIONS as readonly string[])).includes(pos || '');

export interface CleanSheetLeader<P extends Pick<ClubMember, 'id' | 'full_name' | 'player_position'>> { member: P; n: number }

/** Clean sheets per player from the saved player stats (match_player_stats rows with clean_sheet),
 *  only for games in `played`. Members no longer in the club are left out. */
export function topCleanSheets<P extends Pick<ClubMember, 'id' | 'full_name' | 'player_position'>>(
  rows: { match_id: string; member_id: string }[], played: PlayedGame[], byMember: Map<string, P>, group: CleanSheetGroup = 'all',
): CleanSheetLeader<P>[] {
  const ids = new Set(played.map(g => g.match.id));
  const seen = new Set<string>();
  const by = new Map<string, number>();
  for (const r of rows) {
    const k = `${r.match_id}:${r.member_id}`;
    if (!ids.has(r.match_id) || seen.has(k)) continue;
    seen.add(k);
    by.set(r.member_id, (by.get(r.member_id) || 0) + 1);
  }
  const out: CleanSheetLeader<P>[] = [];
  for (const [id, n] of by) {
    const member = byMember.get(id);
    if (member && inGroup(member.player_position, group)) out.push({ member, n });
  }
  return out.sort((a, b) => b.n - a.n || a.member.full_name.localeCompare(b.member.full_name));
}

/** Games kept clean whose player stats haven't been saved yet, so nobody has been credited */
export const unsavedCleanSheets = (played: PlayedGame[]) => played.filter(g => g.them === 0 && !g.match.is_audited).length;
