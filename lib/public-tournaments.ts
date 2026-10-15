// Free public tournament pages (/tools/tournament-maker -> /tournaments/{slug}).
// Each public tournament lives in a small hidden club of its own, marked with config.kind = 'event',
// so the tournament engine, admin screens, permissions (is_club_admin) and live updates all work
// unchanged. Those clubs are left out of club lists, and their club pages send people to the tournament.

export const TOURNAMENTS_PATH = '/tournaments';
export const MAKER_PATH = '/tools/tournament-maker';

/** Public tournaments one account can publish in 30 days (a speed bump against spam) */
export const MONTHLY_LIMIT = 5;

/** A page is listed for search engines once it has this many teams */
export const MIN_INDEXABLE_TEAMS = 4;

export const TEAM_SIZES = ['5-a-side', '6-a-side', '7-a-side', '9-a-side', '11-a-side'];

type WithConfig = { config?: unknown } | null | undefined;

/** A tournament-only club behind a public tournament page */
export function isEventClub(club: WithConfig): boolean {
  const config = club?.config;
  return !!config && typeof config === 'object' && (config as { kind?: unknown }).kind === 'event';
}

/** Clubs shown in directories, menus and the sitemap */
export const isListedClub = (club: WithConfig) => !isEventClub(club);

export const tournamentPagePath = (slug: string) => `${TOURNAMENTS_PATH}/${slug}`;
export const tournamentManagePath = (slug: string) => `${TOURNAMENTS_PATH}/${slug}/manage`;

/** The public tournament a path shows ('/tournaments/dashain-cup/manage' -> 'dashain-cup'), or '' */
export function tournamentSlugFromPath(pathname: string | null | undefined): string {
  const parts = (pathname || '').split('/');
  if (parts[1]?.toLowerCase() !== TOURNAMENTS_PATH.slice(1)) return '';
  try {
    return decodeURIComponent(parts[2] || '').toLowerCase();
  } catch {
    return '';
  }
}

// Words that stop a name being published (checked as whole words, ignoring case). Kept short on
// purpose: it catches the obvious, and the Report link covers the rest.
const BLOCKED = ['fuck', 'fucking', 'shit', 'cunt', 'bitch', 'nigger', 'nigga', 'faggot', 'fag', 'retard', 'whore', 'slut', 'porn', 'nazi'];
const BLOCKED_RE = new RegExp(`\\b(${BLOCKED.join('|')})\\b`, 'i');

/** Whether a tournament or team name can go on a public page */
export function isCleanName(name: string): boolean {
  return !BLOCKED_RE.test(name.replace(/[^a-z0-9\s]/gi, ' '));
}

/** Team names from the maker's text box: one per line, trimmed, de-duplicated, at most 64 */
export function parseTeamNames(text: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const name = raw.replace(/\s+/g, ' ').trim().slice(0, 60);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
    if (names.length === 64) break;
  }
  return names;
}

/** Three-letter code for a team: initials of a multi-word name, else its first letters */
export function teamCode(name: string): string {
  const words = name.toUpperCase().replace(/[^A-Z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  const code = words.length >= 2 ? words.map(w => w[0]).join('') : (words[0] || 'TBD');
  return code.slice(0, 3).padEnd(3, (words[0] || 'X').slice(1, 2) || 'X');
}

/** How each format reads in a sentence ("an 8-team group stage and knockout cup") */
export const FORMAT_PHRASES: Record<string, string> = {
  knockout: 'knockout cup',
  league: 'league',
  group_knockout: 'group stage and knockout cup',
};

/** The match fields the summary needs; matches from the page data and from the server lookup both fit */
export interface SummaryMatch {
  home_team_name: string;
  away_team_name: string;
  match_date?: string | null;
  status: string;
  home_score?: number | null;
  away_score?: number | null;
  home_penalty_score?: number | null;
  away_penalty_score?: number | null;
  winner_side?: string | null;
  tournament_stage?: string | null;
}

const PLAYED = ['completed', 'full_time'];
export const isPlayed = (m: SummaryMatch) => PLAYED.includes(m.status);

export interface TournamentProgress {
  played: number;
  /** Matches that will be played (cancelled ones left out) */
  total: number;
  champion?: string;
  runnerUp?: string;
  /** The final's score from the champion's side, e.g. "2-1", and the shoot-out's if it went to one, e.g. "4-3" */
  finalScore?: string;
  finalPenalties?: string;
  /** The next match still to kick off with both teams known */
  next?: SummaryMatch;
}

/** Where a tournament is up to: matches played, the next match, and the winner once the final is played */
export function tournamentProgress(matches: SummaryMatch[]): TournamentProgress {
  const counted = matches.filter(m => m.status !== 'cancelled');
  const progress: TournamentProgress = { played: counted.filter(isPlayed).length, total: counted.length };

  const final = counted.find(m => m.tournament_stage === 'final');
  if (final && isPlayed(final)) {
    const [h, a] = [final.home_score ?? 0, final.away_score ?? 0];
    const [hp, ap] = [final.home_penalty_score, final.away_penalty_score];
    const side = final.winner_side === 'home' || final.winner_side === 'away' ? final.winner_side
      : h !== a ? (h > a ? 'home' : 'away')
      : hp != null && ap != null && hp !== ap ? (hp > ap ? 'home' : 'away') : null;
    if (side) {
      const home = side === 'home';
      progress.champion = home ? final.home_team_name : final.away_team_name;
      progress.runnerUp = home ? final.away_team_name : final.home_team_name;
      progress.finalScore = home ? `${h}-${a}` : `${a}-${h}`;
      if (h === a && hp != null && ap != null) progress.finalPenalties = home ? `${hp}-${ap}` : `${ap}-${hp}`;
    }
  }

  progress.next = counted
    .filter(m => !isPlayed(m) && m.status !== 'live' && m.status !== 'halftime' && m.match_date)
    .filter(m => m.home_team_name !== 'TBD' && m.away_team_name !== 'TBD')
    .sort((x, y) => Date.parse(x.match_date!) - Date.parse(y.match_date!))[0];
  return progress;
}

interface SummaryInput {
  name: string;
  format?: string | null;
  teamSize?: string | null;
  teamCount: number;
  venue?: string | null;
  organiser?: string | null;
  progress: TournamentProgress;
}

/** The pieces of the summary: what it is ("an 8-team 6-a-side soccer league") and where it's up to */
export function tournamentSummaryParts({ format, teamSize, teamCount, progress }: SummaryInput) {
  const what = [teamCount > 0 ? `${teamCount}-team` : '', teamSize || '', 'soccer', FORMAT_PHRASES[format || ''] || 'tournament']
    .filter(Boolean).join(' ');
  const article = /^(8|11-|18-)/.test(what) ? 'an' : 'a';
  const result = progress.champion
    ? `${progress.champion} won the final against ${progress.runnerUp}, ${progress.finalScore}${progress.finalPenalties ? ` (${progress.finalPenalties} on penalties)` : ''}.`
    : progress.total > 0
      ? `${progress.played} of ${progress.total} matches played.`
      : '';
  return { what: `${article} ${what}`, result };
}

/**
 * The answer-first sentence about a tournament, for the page and its structured data:
 * "Dashain Cup 2026 is an 8-team 6-a-side soccer group stage and knockout cup at Parramatta Park, organised by ..."
 */
export function tournamentSummary(input: SummaryInput): string {
  const { what, result } = tournamentSummaryParts(input);
  const first = `${input.name} is ${what}${input.venue ? ` at ${input.venue}` : ''}${input.organiser ? `, organised by ${input.organiser}` : ''}.`;
  return [first, result].filter(Boolean).join(' ');
}
