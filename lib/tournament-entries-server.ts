// Server side of the team entry link (hosted tournaments, migration 20261180). Service role only:
// the key is the guest's only credential, so every read is narrowed to that one team.
import type { SupabaseClient } from '@supabase/supabase-js';
import { ENTRY_KEY_RE, entryOpen, teamSummary, type TeamSummary } from './hosted-tournaments';
import { CLUB_BRAND_COLUMNS, clubBaseUrl, type ClubBrandRow } from './email/club-brand';
import { fixtureWhenLabel, compareTournamentMatches, parseTournamentDate } from './tournament-engine';
import type { Match, MatchEvent, Tournament, TournamentEntry, TournamentParticipant, TournamentSquadPlayer } from './supabase/types';

export const newEntryKey = () => `te-${crypto.randomUUID().replace(/-/g, '')}`;

export interface FoundEntry {
  entry: TournamentEntry;
  team: TournamentParticipant;
  tournament: Tournament;
  club: ClubBrandRow & { contact_email?: string | null };
}

export async function findEntryByKey(db: SupabaseClient, key: unknown): Promise<FoundEntry | null> {
  if (typeof key !== 'string' || !ENTRY_KEY_RE.test(key)) return null;
  const { data: entry } = await db.from('tournament_entries').select('*').eq('entry_key', key).maybeSingle();
  if (!entry) return null;
  const [{ data: team }, { data: tournament }, { data: club }] = await Promise.all([
    db.from('tournament_participants').select('*').eq('id', entry.participant_id).maybeSingle(),
    db.from('tournaments').select('*').eq('id', entry.tournament_id).maybeSingle(),
    db.from('clubs').select(`${CLUB_BRAND_COLUMNS}, contact_email`).eq('id', entry.club_id).maybeSingle(),
  ]);
  if (!team || !tournament || !club) return null;
  return { entry: entry as TournamentEntry, team: team as TournamentParticipant, tournament: tournament as Tournament, club: club as FoundEntry['club'] };
}

/** "Sat, 24 Oct · 9:00 am · Pitch 2 · v Bayside FC" for a team's game */
export function gameLine(m: Match, team: string): string {
  const opp = m.home_team_name === team ? m.away_team_name : m.home_team_name;
  const score = m.status === 'completed'
    ? ` (${m.home_team_name === team ? `${m.home_score}-${m.away_score}` : `${m.away_score}-${m.home_score}`})`
    : '';
  return [fixtureWhenLabel(m), m.pitch_label, `v ${opp}${score}`].filter(Boolean).join(' · ');
}

export const tournamentWhen = (t: Tournament) => {
  const start = parseTournamentDate(t.start_date);
  const end = parseTournamentDate(t.end_date);
  if (!start) return 'Date to be confirmed';
  const day = (d: Date) => d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: process.env.EMAIL_TIMEZONE || 'Australia/Sydney' });
  return end && day(end) !== day(start) ? `${day(start)} to ${day(end)}` : day(start);
};

export const tournamentTitle = (t: Tournament) => (t.age_group ? `${t.name} (${t.age_group})` : t.name);

/** The team's games, soonest first */
export async function teamGames(db: SupabaseClient, tournamentId: string, team: string): Promise<Match[]> {
  const { data } = await db.from('matches').select('*').eq('tournament_id', tournamentId);
  return ((data || []) as Match[]).filter(m => m.home_team_name === team || m.away_team_name === team).sort(compareTournamentMatches);
}

export interface EntryView {
  club: { name: string; slug: string; logo_url: string | null; color: string | null };
  tournament: {
    name: string; age_group: string | null; when: string; venue: string | null; deadline: string | null;
    open: boolean; max_squad: number | null; team_info: string | null; is_junior: boolean; status: string; publicPath: string;
  };
  team: { name: string; short_name: string; logo_url: string | null; color: string | null; secondary_color: string | null; manager_name: string | null; coach_name: string | null };
  entry: { contact_name: string | null; contact_email: string | null; contact_phone: string | null; assistant_name: string | null; first_aid_name: string | null; status: string; submitted_at: string | null };
  players: Pick<TournamentSquadPlayer, 'name' | 'shirt_number' | 'position' | 'is_junior' | 'hide_public'>[];
  fee: { amount_cents: number; currency: string; status: string; payPath: string | null } | null;
  games: { line: string; status: string }[];
  /** Once their last game is done (TX-11) */
  report: TeamSummary | null;
}

export async function loadEntryView(db: SupabaseClient, f: FoundEntry): Promise<EntryView> {
  const { entry, team, tournament: t, club } = f;
  const [{ data: players }, games, payment] = await Promise.all([
    db.from('tournament_squads').select('name, shirt_number, position, is_junior, hide_public, sort_order').eq('participant_id', team.id).order('sort_order'),
    teamGames(db, t.id, team.name),
    entry.payment_id ? db.from('payments').select('id, amount_cents, currency, status').eq('id', entry.payment_id).maybeSingle().then(r => r.data) : Promise.resolve(null),
  ]);
  const done = games.length > 0 && games.every(g => g.status === 'completed');
  let report: TeamSummary | null = null;
  if (done) {
    const { data: events } = await db.from('match_events').select('*').in('match_id', games.map(g => g.id));
    report = teamSummary(team.name, games, (events || []) as MatchEvent[]);
    report.games = [];
  }
  const deadline = t.entry_deadline ? new Date(t.entry_deadline) : null;
  return {
    club: { name: club.name, slug: club.slug, logo_url: club.logo_url ?? null, color: club.primary_color ?? null },
    tournament: {
      name: t.name, age_group: t.age_group ?? null, when: tournamentWhen(t), venue: t.venue ?? null,
      deadline: deadline && !isNaN(deadline.getTime()) ? deadline.toISOString() : null,
      open: entryOpen(t), max_squad: t.max_squad ?? null, team_info: t.team_info ?? null, is_junior: !!t.is_junior, status: t.status,
      publicPath: `/${club.slug}/tournaments/${t.id}?team=${team.id}`,
    },
    team: {
      name: team.name, short_name: team.short_name, logo_url: team.logo_url || null, color: team.color || null,
      secondary_color: team.secondary_color ?? null, manager_name: team.manager_name ?? null, coach_name: team.coach_name ?? null,
    },
    entry: {
      contact_name: entry.contact_name, contact_email: entry.contact_email, contact_phone: entry.contact_phone,
      assistant_name: entry.assistant_name, first_aid_name: entry.first_aid_name, status: entry.status, submitted_at: entry.submitted_at,
    },
    players: (players || []).map(({ sort_order: _s, ...p }) => p),
    fee: payment && t.entry_fee_cents ? {
      amount_cents: payment.amount_cents, currency: payment.currency, status: payment.status,
      payPath: payment.status === 'pending' || payment.status === 'awaiting_review' ? `/${club.slug}/pay/${payment.id}` : null,
    } : null,
    games: games.map(g => ({ line: gameLine(g, team.name), status: g.status })),
    report,
  };
}

/** The entry link to a team's page */
export const entryLink = (club: Pick<ClubBrandRow, 'slug' | 'custom_domain'>, key: string) => `${clubBaseUrl(club)}/tournament-entry/${key}`;
