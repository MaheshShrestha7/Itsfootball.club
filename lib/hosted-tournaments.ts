// Hosted tournaments with guest clubs (plan 18 Nov 2026): the timetable, guest team lists, kit
// clashes, each team's summary and the fair play table. Pure functions, checked in
// hosted-tournaments.check.ts.

import { compareTournamentMatches, STAGE_TITLES } from './tournament-engine';
import { goalScoringSide } from './teams';
import type { Match, MatchEvent, Tournament, TournamentParticipant } from './supabase/types';

const pad = (n: number) => String(n).padStart(2, '0');
const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
};
export const minutesToTime = (min: number) => `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`;
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export interface PackResult {
  /** Days used, counting the first */
  days: number;
  /** The last game finishes after the tournament's end date */
  overflow: boolean;
  /** "16:40": when the last game of the last day ends */
  finish: string | null;
}

/**
 * The day's timetable: games fill the pitches slot by slot (a slot is one game plus changeover), a
 * new round starts in a fresh slot so nobody plays twice at once, and when a slot would finish after
 * the day's finish time the games carry on the next day from the same start time. Changes the
 * matches in place.
 */
export function packKickoffs(
  matches: Match[],
  { start, end, matchMinutes, pitches = 1, dayEnd }: { start: Date; end?: Date | null; matchMinutes: number; pitches?: number; dayEnd?: string | null },
): PackResult {
  if (!(matchMinutes > 0) || !matches.length) return { days: 0, overflow: false, finish: null };
  const lanes = Math.max(1, Math.floor(pitches));
  const startMin = start.getHours() * 60 + start.getMinutes();
  const endMin = dayEnd && /^\d{2}:\d{2}$/.test(dayEnd) ? toMinutes(dayEnd) : 24 * 60;
  let day = 0;
  let cursor = startMin;
  let key: string | null = null;
  let inSlot = 0;
  for (const m of [...matches].sort(compareTournamentMatches)) {
    const k = `${m.tournament_stage || 'group'}-${m.tournament_round ?? 0}`;
    if (k !== key || inSlot === lanes) {
      if (key !== null && inSlot > 0) cursor += matchMinutes;
      key = k;
      inSlot = 0;
      // The slot would run past the day's finish: start the next day (a day always gets one slot)
      if (cursor + matchMinutes > endMin && cursor > startMin) {
        day++;
        cursor = startMin;
      }
    }
    const d = new Date(start);
    d.setDate(d.getDate() + day);
    m.match_date = localDate(d);
    m.match_time = minutesToTime(Math.min(cursor, 23 * 60 + 59));
    m.pitch_label = lanes > 1 ? `Pitch ${inSlot + 1}` : m.pitch_label ?? null;
    inSlot++;
  }
  const last = new Date(start);
  last.setDate(last.getDate() + day);
  const overflow = !!end && localDate(last) > localDate(end);
  return { days: day + 1, overflow, finish: minutesToTime(cursor + matchMinutes) };
}

/** "Bayside FC, sam@bayside.com" per line (or a tab, from a spreadsheet) -> name and email */
export function parseTeamList(text: string): { name: string; email: string | null }[] {
  const out: { name: string; email: string | null }[] = [];
  const seen = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const parts = line.split(/[,\t;]/).map(s => s.trim()).filter(Boolean);
    if (!parts.length) continue;
    const email = parts.find(p => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p)) || null;
    const name = parts.filter(p => p !== email).join(' ').replace(/\s+/g, ' ').slice(0, 128);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push({ name, email: email?.toLowerCase() ?? null });
  }
  return out;
}

/** A short code from a club name: "Bayside United FC" -> "BUF", "Rovers" -> "ROV" */
export function shortCode(name: string): string {
  const words = name.trim().split(/\s+/).filter(w => /[a-z0-9]/i.test(w));
  const code = words.length > 1 ? words.map(w => w[0]).join('') : (words[0] || '');
  return code.replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase() || 'TBC';
}

const rgb = (c: string | null | undefined): [number, number, number] | null => {
  const m = /^#([0-9a-f]{6})$/i.exec((c || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Main colours close enough that the referee couldn't tell the teams apart */
export function colorsClash(a?: string | null, b?: string | null): boolean {
  const x = rgb(a);
  const y = rgb(b);
  if (!x || !y) return false;
  // Weighted RGB distance: about 0..765; under 90 reads as the same kit on a pitch
  const [dr, dg, db] = [x[0] - y[0], x[1] - y[1], x[2] - y[2]];
  return Math.sqrt(2 * dr * dr + 4 * dg * dg + 3 * db * db) < 90;
}

/** Upcoming games where both teams wear nearly the same main colour */
export function kitClashes(matches: Match[], participants: TournamentParticipant[]): { match: Match; home: TournamentParticipant; away: TournamentParticipant }[] {
  const byName = new Map(participants.map(p => [p.name, p]));
  return matches
    .filter(m => m.status === 'upcoming')
    .flatMap(m => {
      const home = byName.get(m.home_team_name);
      const away = byName.get(m.away_team_name);
      return home && away && colorsClash(home.color, away.color) ? [{ match: m, home, away }] : [];
    })
    .sort((a, b) => compareTournamentMatches(a.match, b.match));
}

/** The age groups of one hosted event, the first one first: the tournament and its children */
export function ageGroupFamily(tournaments: Tournament[], t: Tournament): Tournament[] {
  const rootId = t.parent_id || t.id;
  const root = tournaments.find(x => x.id === rootId);
  const kids = tournaments.filter(x => x.parent_id === rootId)
    .sort((a, b) => (a.age_group || a.name).localeCompare(b.age_group || b.name, undefined, { numeric: true }));
  return root ? [root, ...kids] : kids;
}

/** What a team is called in the age group switch ("Under 11s", or the tournament name) */
export const ageGroupLabel = (t: Tournament) => t.age_group?.trim() || t.name;

// ------------------------------------------------------------------------------
// A team's tournament, from the results and the events Match Centre logged
// ------------------------------------------------------------------------------

const sideOf = (m: Match, team: string): 'home' | 'away' | null =>
  m.home_team_name === team ? 'home' : m.away_team_name === team ? 'away' : null;

/** 'W' | 'D' | 'L' for one finished game, penalties deciding a knockout draw */
export function gameOutcome(m: Match, side: 'home' | 'away'): 'W' | 'D' | 'L' | null {
  if (m.status !== 'completed') return null;
  const us = side === 'home' ? m.home_score : m.away_score;
  const them = side === 'home' ? m.away_score : m.home_score;
  if (us > them) return 'W';
  if (us < them) return 'L';
  if (m.winner_side) return m.winner_side === side ? 'W' : 'L';
  return 'D';
}

export interface TeamSummary {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  /** Most goals first */
  scorers: { name: string; goals: number }[];
  yellow: number;
  red: number;
  /** "Winners", "Runners-up", "Semi-Finals", "Group stage" ... once the team is out or the cup is over */
  finish: string | null;
  games: Match[];
}

export function teamSummary(team: string, matches: Match[], events: MatchEvent[]): TeamSummary {
  const games = matches.filter(m => sideOf(m, team)).sort(compareTournamentMatches);
  const done = games.filter(m => m.status === 'completed');
  const s: TeamSummary = { played: done.length, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, scorers: [], yellow: 0, red: 0, finish: null, games };
  const goals = new Map<string, number>();
  for (const m of done) {
    const side = sideOf(m, team)!;
    const o = gameOutcome(m, side);
    if (o === 'W') s.won++; else if (o === 'L') s.lost++; else s.drawn++;
    s.goalsFor += side === 'home' ? m.home_score : m.away_score;
    s.goalsAgainst += side === 'home' ? m.away_score : m.home_score;
  }
  for (const e of events) {
    // Live games count too: their goals are already on the board
    const m = games.find(g => g.id === e.match_id && g.status !== 'upcoming');
    if (!m) continue;
    const side = sideOf(m, team)!;
    if (goalScoringSide(e) === side && e.event_type !== 'own_goal' && e.player_name?.trim()) {
      const n = e.player_name.trim();
      goals.set(n, (goals.get(n) || 0) + 1);
    }
    if (e.team_side === side && e.event_type === 'yellow_card') s.yellow++;
    if (e.team_side === side && e.event_type === 'red_card') s.red++;
  }
  s.scorers = [...goals].map(([name, n]) => ({ name, goals: n })).sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name));

  // How far they got: the last stage they played, once nothing is left for them
  const last = games[games.length - 1];
  if (last && games.every(g => g.status === 'completed')) {
    const side = sideOf(last, team)!;
    const won = gameOutcome(last, side) === 'W';
    const stage = last.tournament_stage || 'group';
    s.finish = stage === 'final' ? (won ? 'Winners' : 'Runners-up')
      : stage === 'third_place' ? (won ? 'Third place' : 'Fourth place')
      // Only once there's a knockout: a league, or groups before the knockout draw, has no "out" yet
      : stage === 'group' ? (matches.some(g => g.tournament_stage && g.tournament_stage !== 'group') ? 'Group stage' : null)
      : STAGE_TITLES[stage] || stage;
  }
  return s;
}

export interface FairPlayRow {
  team: string;
  yellow: number;
  red: number;
  /** 1 per yellow, 3 per red: fewest is fairest */
  points: number;
}

/** The fair play table, fairest first, and players sitting out their team's next game after a red */
export function fairPlay(matches: Match[], events: MatchEvent[], participants: TournamentParticipant[]): { table: FairPlayRow[]; suspended: { player: string; team: string; match: Match }[] } {
  const rows = new Map(participants.map(p => [p.name, { team: p.name, yellow: 0, red: 0, points: 0 }]));
  const byId = new Map(matches.map(m => [m.id, m]));
  const suspended: { player: string; team: string; match: Match }[] = [];
  for (const e of events) {
    const m = byId.get(e.match_id);
    if (!m || (e.event_type !== 'yellow_card' && e.event_type !== 'red_card')) continue;
    const team = e.team_side === 'home' ? m.home_team_name : m.away_team_name;
    const row = rows.get(team);
    if (!row) continue;
    if (e.event_type === 'yellow_card') row.yellow++; else row.red++;
    if (e.event_type === 'red_card' && e.player_name?.trim()) {
      // Their team's next game after this one
      const next = matches.filter(g => sideOf(g, team) && compareTournamentMatches(g, m) > 0).sort(compareTournamentMatches)[0];
      if (next && next.status === 'upcoming') suspended.push({ player: e.player_name.trim(), team, match: next });
    }
  }
  const table = [...rows.values()].map(r => ({ ...r, points: r.yellow + 3 * r.red }))
    .sort((a, b) => a.points - b.points || a.team.localeCompare(b.team));
  return { table, suspended };
}

// ------------------------------------------------------------------------------
// The team entry link
// ------------------------------------------------------------------------------

export const ENTRY_KEY_RE = /^te-[0-9a-f]{32}$/;
export const ENTRY_POSITIONS = ['GK', 'DEF', 'MID', 'FWD'] as const;

export interface EntryPlayer {
  name: string;
  shirt_number: number | null;
  position: string | null;
  is_junior: boolean;
  hide_public: boolean;
}

export interface EntryInput {
  manager_name: string | null;
  coach_name: string | null;
  assistant_name: string | null;
  first_aid_name: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  color: string | null;
  secondary_color: string | null;
  players: EntryPlayer[];
  submit: boolean;
}

const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().replace(/\s+/g, ' ').slice(0, max) : null);
const colour = (v: unknown) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim().toUpperCase() : null);

/** What a guest club sent from its entry page, checked: never trusted as it arrives */
export function parseEntry(body: unknown, maxSquad: number | null | undefined): { ok: true; value: EntryInput } | { ok: false; error: string } {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const raw = Array.isArray(b.players) ? b.players : [];
  const max = maxSquad && maxSquad > 0 ? maxSquad : 40;
  const players: EntryPlayer[] = [];
  const numbers = new Set<number>();
  for (const r of raw.slice(0, 80)) {
    const p = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
    const name = text(p.name, 80);
    if (!name) continue;
    const n = p.shirt_number === '' || p.shirt_number == null ? null : Number(p.shirt_number);
    if (n !== null && (!Number.isInteger(n) || n < 0 || n > 99)) return { ok: false, error: `${name}'s shirt number must be 0 to 99.` };
    if (n !== null && numbers.has(n)) return { ok: false, error: `Two players wear number ${n}.` };
    if (n !== null) numbers.add(n);
    const position = typeof p.position === 'string' && (ENTRY_POSITIONS as readonly string[]).includes(p.position) ? p.position : null;
    players.push({ name, shirt_number: n, position, is_junior: p.is_junior === true, hide_public: p.hide_public === true });
  }
  if (players.length > max) return { ok: false, error: `Up to ${max} players can be entered.` };
  const submit = b.submit === true;
  const value: EntryInput = {
    manager_name: text(b.manager_name, 128),
    coach_name: text(b.coach_name, 128),
    assistant_name: text(b.assistant_name, 128),
    first_aid_name: text(b.first_aid_name, 128),
    contact_name: text(b.contact_name, 128),
    contact_phone: text(b.contact_phone, 40),
    color: colour(b.color),
    secondary_color: colour(b.secondary_color),
    players,
    submit,
  };
  if (submit && !value.manager_name) return { ok: false, error: 'Add your team manager before you send the entry.' };
  if (submit && !players.length) return { ok: false, error: 'Add at least one player before you send the entry.' };
  return { ok: true, value };
}

/** Whether the entry can still be changed: before the deadline (none set: until the first game) */
export function entryOpen(t: Pick<Tournament, 'entry_deadline' | 'start_date'>, now = new Date()): boolean {
  const close = t.entry_deadline ? new Date(t.entry_deadline) : t.start_date ? new Date(t.start_date) : null;
  return !close || isNaN(close.getTime()) || now < close;
}

/** "$45.00" for an entry fee in cents */
export const money = (cents: number, currency = 'AUD') =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency }).format(cents / 100);
