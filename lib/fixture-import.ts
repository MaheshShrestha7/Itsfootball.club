// Reading a season's draw (from the league's website or a spreadsheet) into fixtures: pasted text
// or a CSV file with a header row, checked row by row before anything is added (FixtureImportModal).
import { parseCsvRows } from './csv';

export type DrawField = 'round' | 'date' | 'time' | 'home' | 'away' | 'venue' | 'competition';

// Header names leagues and spreadsheets use for each column, compared lower-case without punctuation
const HEADERS: Record<DrawField, string[]> = {
  round: ['round', 'rd', 'rnd', 'week', 'wk', 'game week', 'matchday'],
  date: ['date', 'match date', 'game date', 'day', 'fixture date'],
  time: ['time', 'kick off', 'kickoff', 'ko', 'start', 'start time', 'kick off time'],
  home: ['home', 'home team', 'home club', 'team a', 'home side'],
  away: ['away', 'away team', 'away club', 'team b', 'visitor', 'visitors', 'away side', 'opponent'],
  venue: ['venue', 'ground', 'field', 'location', 'pitch', 'oval', 'park'],
  competition: ['competition', 'comp', 'division', 'div', 'grade', 'league', 'age group'],
};

const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** The column of each field in a header row; unknown columns are ignored */
export function detectColumns(header: string[]): Partial<Record<DrawField, number>> {
  const out: Partial<Record<DrawField, number>> = {};
  header.forEach((h, i) => {
    const name = clean(h);
    for (const field of Object.keys(HEADERS) as DrawField[]) {
      if (out[field] === undefined && HEADERS[field].includes(name)) out[field] = i;
    }
  });
  return out;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const pad = (n: number) => String(n).padStart(2, '0');

function validDay(y: number, m: number, d: number): string | null {
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/**
 * A draw date as YYYY-MM-DD. Day first, as Australian leagues write it: 14/03/2026, 14-3-26,
 * 14.03.2026, "Sat 14 Mar 2026", "14 March", and 2026-03-14. A date without a year takes `year`.
 */
export function parseDrawDate(raw: string, year = new Date().getFullYear()): string | null {
  const s = raw.trim().toLowerCase().replace(/(\d)(st|nd|rd|th)\b/g, '$1');
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[t ].*)?$/);
  if (m) return validDay(+m[1], +m[2], +m[3]);
  m = s.match(/^(?:[a-z]+,?\s+)?(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?$/);
  if (m) return validDay(m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : year, +m[2], +m[1]);
  m = s.match(/^(?:[a-z]+,?\s+)?(\d{1,2})\s+([a-z]+)\.?,?(?:\s+(\d{4}))?$/);
  if (m) {
    const month = MONTHS.indexOf(m[2].slice(0, 3));
    return month < 0 ? null : validDay(m[3] ? +m[3] : year, month + 1, +m[1]);
  }
  return null;
}

/** A kick-off as HH:MM (24 hour): 15:00, 3:00pm, 3pm, 3.30 pm, 1500. Empty or "TBC" is null. */
export function parseDrawTime(raw: string): string | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, '');
  const m = s.match(/^(\d{1,2})(?:[:.]?(\d{2}))?(am|pm)?$/);
  if (!m) return null;
  let h = +m[1];
  const min = m[2] ? +m[2] : 0;
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  if (h > 23 || min > 59 || (!m[2] && !m[3] && m[1].length < 3 && h < 7)) return null;
  return `${pad(h)}:${pad(min)}`;
}

export interface DrawRow {
  /** Line in the pasted text or file, for messages */
  line: number;
  round?: string;
  /** As written, and as YYYY-MM-DD when it could be read */
  dateText: string;
  date: string | null;
  timeText: string;
  time: string | null;
  home: string;
  away: string;
  venue?: string;
  competition?: string;
}

export interface ReadDraw {
  rows: DrawRow[];
  /** Fields the header row is missing that every fixture needs */
  missing: DrawField[];
}

/** Rows of a pasted draw or CSV file. Spreadsheet copies are tab-separated, files comma-separated. */
export function readDraw(text: string, year?: number): ReadDraw {
  const lines = text.replace(/^﻿/, '').trim();
  if (!lines) return { rows: [], missing: ['date', 'home', 'away'] };
  const firstLine = lines.split(/\r?\n/, 1)[0];
  const table = firstLine.includes('\t')
    ? lines.split(/\r?\n/).filter(l => l.trim()).map(l => l.split('\t').map(c => c.trim()))
    : parseCsvRows(lines);
  const cols = detectColumns(table[0] || []);
  const missing = (['date', 'home', 'away'] as DrawField[]).filter(f => cols[f] === undefined);
  if (missing.length) return { rows: [], missing };
  const cell = (r: string[], f: DrawField) => (cols[f] === undefined ? '' : (r[cols[f]!] || '').replace(/[<>]/g, '').trim());
  const rows = table.slice(1)
    .map((r, i): DrawRow => ({
      line: i + 2,
      round: cell(r, 'round') || undefined,
      dateText: cell(r, 'date'),
      date: parseDrawDate(cell(r, 'date'), year),
      timeText: cell(r, 'time'),
      time: parseDrawTime(cell(r, 'time')),
      home: cell(r, 'home').slice(0, 120),
      away: cell(r, 'away').slice(0, 120),
      venue: cell(r, 'venue').slice(0, 200) || undefined,
      competition: cell(r, 'competition').slice(0, 120) || undefined,
    }))
    .filter(r => r.home || r.away || r.dateText);
  return { rows, missing: [] };
}

/** Does a team name in the draw ("Riverside FC U12 Blue") belong to the club ("Riverside FC")? */
export function isOurTeam(name: string, ourName: string): boolean {
  const n = clean(name), o = clean(ourName);
  return !!o && (n === o || n.startsWith(`${o} `) || n.includes(` ${o} `) || n.endsWith(` ${o}`));
}

/** The club's name as the draw writes it: the club name if it's there, else the name in the most rows */
export function guessOurName(rows: DrawRow[], clubNames: string[]): string {
  const names = rows.flatMap(r => [r.home, r.away]).filter(Boolean);
  for (const club of clubNames.filter(Boolean)) {
    if (names.some(n => isOurTeam(n, club))) return club;
  }
  const count = new Map<string, number>();
  for (const n of names) count.set(n, (count.get(n) || 0) + 1);
  return [...count].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
}

export type RowVerdict =
  | { kind: 'new'; isHome: boolean; opponent: string }
  | { kind: 'duplicate'; isHome: boolean; opponent: string }
  | { kind: 'skip'; reason: string }
  | { kind: 'problem'; reason: string };

const isBye = (name: string) => /^(bye|tbc|tba|-|)$/i.test(name.trim());

/**
 * What happens to one row: added, already on the fixture list (same day and opponent),
 * skipped (a bye, or a game between two other clubs) or a problem to fix in the file.
 */
export function judgeRow(row: DrawRow, ourName: string, existing: { date: string; opponent: string }[]): RowVerdict {
  if (isBye(row.home) || isBye(row.away)) return { kind: 'skip', reason: 'Bye' };
  const home = isOurTeam(row.home, ourName), away = isOurTeam(row.away, ourName);
  if (!home && !away) return { kind: 'skip', reason: 'Not our game' };
  if (home && away) return { kind: 'problem', reason: 'Both teams look like ours' };
  if (!row.date) return { kind: 'problem', reason: row.dateText ? `Can't read the date "${row.dateText}"` : 'No date' };
  if (row.timeText && !row.time && !/^(tbc|tba|-)$/i.test(row.timeText)) return { kind: 'problem', reason: `Can't read the time "${row.timeText}"` };
  const opponent = home ? row.away : row.home;
  const dup = existing.some(e => e.date === row.date && clean(e.opponent) === clean(opponent));
  return { kind: dup ? 'duplicate' : 'new', isHome: home, opponent };
}

/** A one-row example to start from */
export const DRAW_TEMPLATE = 'Round,Date,Time,Home,Away,Venue\n1,14/03/2027,9:00am,Riverside FC,Hills United,Riverside Oval\n';
