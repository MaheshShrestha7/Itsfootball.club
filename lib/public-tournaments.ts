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
