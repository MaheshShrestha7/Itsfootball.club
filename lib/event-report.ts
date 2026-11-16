// The summary of one event once it's over: who came (door and scanner check-ins), the games
// linked to it, and the committee's own notes. Counted from what the club logged and copied from
// what the committee wrote, so nothing is guessed. No ticket sales or money: the club asked for
// those to stay out.
// The report is plain data, so the shared version can be saved as it is and shown from a link.
import type { ClubOutcome } from './fixtures';
import { gameResult, opponentName, reviewPoints } from './match-review';
import type { ClubEvent, GateScanRecord, Match } from './supabase/types';

export const EVENT_NOTE_MAX = 2000;

/** The event types, as the admin form and filters name them */
export const EVENT_TYPES: [ClubEvent['category'], string][] = [
  ['training', 'Training Session'], ['match', 'Official Match'], ['social', 'Social & Gala'],
  ['trial', 'Player Trials'], ['agm', 'Club AGM'], ['tournament', 'Tournament'],
];

export interface EventNotes { went_well: string; next_time: string }

export interface EventReport {
  v: 1;
  club: string;
  title: string;
  /** "Social · 2026 season · Fri 23 Oct 2026, 7:00 pm · Clubhouse" */
  meta: string;
  completed: boolean;
  opening: string;
  figures: { label: string; value: string }[];
  games: { id: string; outcome: ClubOutcome | null; score: string; opponent: string; when: string }[];
  wentWell: string[];
  /** Coaches and committee only, like the names below */
  nextTime?: string[];
  /** Who checked in, by name */
  names?: string[];
  /** Training only: players from the squad who didn't check in */
  missed?: string[];
}

export interface EventReportInput {
  club: string;
  event: Pick<ClubEvent, 'title' | 'category' | 'max_capacity' | 'rsvp_count' | 'completed_at'>;
  meta: string;
  scans: Pick<GateScanRecord, 'scan_type' | 'valid' | 'event_id' | 'member_id' | 'member_name'>[];
  eventId: string;
  /** The squad: who is expected at training */
  squad: { id: string; name: string }[];
  /** Names of the club's members, by id */
  nameOf: (memberId: string) => string | undefined;
  games: Match[];
  when: (m: Match) => string;
  notes: EventNotes;
  /** The full version, with names and the notes for next time */
  committee: boolean;
}

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const num = (n: number) => WORDS[n] ?? String(n);
const list = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);
const people = (n: number, one = 'person', many = 'people') => `${n} ${n === 1 ? one : many}`;

export function buildEventReport(input: EventReportInput): EventReport {
  const { event } = input;
  // One check-in per person: a member by id, anyone else by the name the door recorded
  const seen = new Map<string, { memberId?: string; name: string }>();
  for (const s of input.scans) {
    if (s.scan_type !== 'event_checkin' || !s.valid || s.event_id !== input.eventId) continue;
    const key = s.member_id || `name:${s.member_name.trim().toLowerCase()}`;
    if (!seen.has(key)) seen.set(key, { memberId: s.member_id, name: (s.member_id && input.nameOf(s.member_id)) || s.member_name.trim() });
  }
  const came = [...seen.values()];
  const members = came.filter(c => c.memberId).length;
  // The door count is kept on the event too; scans can be fewer (a count typed in, or older events)
  const total = Math.max(event.rsvp_count || 0, came.length);
  const training = event.category === 'training';
  const cameIds = new Set(came.map(c => c.memberId).filter(Boolean));
  const missed = training ? input.squad.filter(p => !cameIds.has(p.id)).map(p => p.name) : [];

  const played = input.games.filter(m => m.status === 'completed');
  const results = played.map(m => ({ m, r: gameResult(m) }));
  const decided = results.filter(x => x.r.outcome);
  const count = (o: ClubOutcome) => decided.filter(x => x.r.outcome === o).length;

  const opening: string[] = [];
  if (training) {
    opening.push(total ? `${people(total, 'player', 'players')} came to training.` : 'Nobody checked in at this session.');
    if (input.squad.length && cameIds.size) opening.push(`${cameIds.size} of the ${input.squad.length} in the squad checked in.`);
  } else {
    opening.push(total ? `${people(total)} came${event.max_capacity > 0 ? `, out of ${event.max_capacity} places` : ''}.` : 'Nobody was checked in at the door.');
    if (came.length && members) opening.push(`${members} of the ${came.length} checked in ${members === 1 ? 'was a club member' : 'were club members'}.`);
  }
  if (decided.length) {
    const record = list([count('W') && `won ${num(count('W'))}`, count('D') && `drew ${num(count('D'))}`, count('L') && `lost ${num(count('L'))}`].filter((x): x is string => !!x));
    opening.push(decided.length === 1 ? `We played one game and ${record}.` : `We played ${num(decided.length)} games: ${record}.`);
  }

  const figures = [
    { label: 'Checked in', value: String(total) },
    ...(event.max_capacity > 0 ? [{ label: 'Places', value: String(event.max_capacity) }] : []),
    ...(training && input.squad.length ? [{ label: 'Squad', value: String(input.squad.length) }] : [{ label: 'Members', value: String(members) }]),
    ...(decided.length ? [{ label: 'Won · Drew · Lost', value: `${count('W')} · ${count('D')} · ${count('L')}` }] : []),
  ];

  const report: EventReport = {
    v: 1,
    club: input.club,
    title: event.title,
    meta: input.meta,
    completed: !!event.completed_at,
    opening: opening.join(' '),
    figures,
    games: results.map(({ m, r }) => ({
      id: m.id,
      outcome: r.outcome,
      score: r.outcome ? `${r.us}-${r.them}` : `${m.home_score ?? 0}-${m.away_score ?? 0}`,
      opponent: opponentName(m),
      when: input.when(m),
    })),
    wentWell: reviewPoints(input.notes.went_well),
  };
  if (!input.committee) return report;
  return {
    ...report,
    nextTime: reviewPoints(input.notes.next_time),
    names: came.map(c => c.name).sort((a, b) => a.localeCompare(b)),
    ...(training ? { missed } : {}),
  };
}

/** A report read back from a share link is someone else's data: only a well-formed one is shown */
export function isEventReport(x: unknown): x is EventReport {
  const r = x as EventReport | null;
  return !!r && typeof r === 'object' && r.v === 1 && typeof r.title === 'string' && typeof r.opening === 'string'
    && Array.isArray(r.figures) && Array.isArray(r.games) && Array.isArray(r.wentWell);
}
