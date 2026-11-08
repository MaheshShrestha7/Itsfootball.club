// Server side of friendly invitations (migration 20261158): what goes in the emails to the person
// who invited one of our teams, and the checks shared by /api/admin/friendlies and /api/friendly.
// Uses the service client; never import from client code.
import type { SupabaseClient } from '@supabase/supabase-js';
import { clubBaseUrl, type ClubBrandRow } from './email/club-brand';
import { formatMatchWhen } from './email/format';
import type { FriendlyFacts } from './email/templates';
import { directionsUrl, groundForMatch, groundPath, pitchAnchor, type GroundRow } from './grounds';
import { FORMAT_LABEL, halfLabel, opponentName, ourSide, type FriendlyDetails } from './friendlies';
import { SITE_URL } from './seo';
import type { ClubTeamFormat } from './supabase/types';

export const FRIENDLY_INQUIRY_COLUMNS =
  'id, club_id, sender_name, sender_email, inquiry_type, message, status, details, team_id, match_id, response_token';

export const FRIENDLY_MATCH_COLUMNS =
  'id, club_id, slug, team_id, opponent_name, home_team_name, away_team_name, is_club_home, match_date, match_time, venue, status, ground_id, pitch_label, half_minutes, match_format, match_type';

export interface FriendlyMatchRow {
  id: string;
  club_id: string;
  slug?: string | null;
  team_id?: string | null;
  opponent_name?: string | null;
  home_team_name: string;
  away_team_name: string;
  is_club_home: boolean;
  match_date: string;
  match_time?: string | null;
  venue?: string | null;
  status: string;
  ground_id?: string | null;
  pitch_label?: string | null;
  half_minutes?: number | null;
  match_format?: ClubTeamFormat | null;
  match_type?: string | null;
}

export type FriendlyClubRow = ClubBrandRow & { contact_email?: string | null; contact_phone?: string | null; home_ground_id?: string | null };

const GROUND_COLUMNS = 'id, name, slug, suburb, suburb_slug, state, address, lat, lng, pitches, is_published';

/** The ground guide the match page would show: the linked ground, else the club's home ground */
async function groundFor(db: SupabaseClient, club: FriendlyClubRow, match: FriendlyMatchRow): Promise<GroundRow | null> {
  try {
    if (match.ground_id) {
      const { data } = await db.from('grounds').select(GROUND_COLUMNS).eq('id', match.ground_id).maybeSingle();
      return groundForMatch(match, (data as GroundRow | null) || null, null);
    }
    if (match.is_club_home && club.home_ground_id) {
      const { data } = await db.from('grounds').select(GROUND_COLUMNS).eq('id', club.home_ground_id).maybeSingle();
      return groundForMatch(match, null, (data as GroundRow | null) || null);
    }
  } catch {
    // No grounds tables yet: the email just goes without the guide
  }
  return null;
}

export const matchUrlOf = (club: FriendlyClubRow, match: Pick<FriendlyMatchRow, 'id' | 'slug'>) => `${clubBaseUrl(club)}/match/${match.slug || match.id}`;

/** When, where and what, as the visitor reads it, plus the match page, calendar, directions and guide links */
export async function matchdayPack(db: SupabaseClient, club: FriendlyClubRow, match: FriendlyMatchRow, details: FriendlyDetails, teamName: string) {
  const ours = ourSide(club.name, teamName);
  const theirs = match.opponent_name || opponentName(details);
  const venue = (match.venue || '').trim();
  const format = (match.match_format || details.format) as ClubTeamFormat;
  const facts: FriendlyFacts = {
    title: match.is_club_home ? `${ours} v ${theirs}` : `${theirs} v ${ours}`,
    when: formatMatchWhen(match.match_date, match.match_time).replace(/, (\d{1,2}:\d{2})/, ', kick-off $1'),
    where: match.is_club_home ? `${venue || 'Our ground'} (we host)` : `${venue || 'Your ground'} (you host)`,
    game: `${FORMAT_LABEL[format] || FORMAT_LABEL['11v11']}, ${halfLabel(match.half_minutes ?? details.half_minutes, format)}`,
    contact: [club.contact_email, club.contact_phone].map(v => (v || '').trim()).filter(Boolean).join(', ') || null,
  };

  const matchUrl = matchUrlOf(club, match);
  const links: { label: string; url: string }[] = [
    { label: 'Add to calendar', url: `${SITE_URL}/${club.slug}/calendar.ics?match=${encodeURIComponent(match.id)}` },
  ];
  const ground = await groundFor(db, club, match);
  if (ground) {
    links.push({ label: 'Directions', url: directionsUrl(ground) });
    const pitch = match.pitch_label && (ground.pitches || []).some(p => p.label === match.pitch_label) ? match.pitch_label : null;
    links.push({ label: 'Ground guide', url: `${SITE_URL}${groundPath(ground)}${pitch ? `#${pitchAnchor(pitch)}` : ''}` });
  } else if (venue) {
    links.push({ label: 'Directions', url: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(venue)}` });
  }
  return { facts, matchUrl, links };
}

/** What changed on a fixture that the visitor needs to hear about, or null */
export function friendlyChange(
  before: Pick<FriendlyMatchRow, 'match_date' | 'match_time' | 'venue' | 'status'>,
  after: Pick<FriendlyMatchRow, 'match_date' | 'match_time' | 'venue' | 'status'>,
): 'changed' | 'postponed' | 'cancelled' | null {
  if (after.status === 'cancelled' && before.status !== 'cancelled') return 'cancelled';
  if (after.status === 'postponed' && before.status !== 'postponed') return 'postponed';
  if (after.status === 'cancelled' || after.status === 'postponed') return null;
  const when = (m: typeof before) => formatMatchWhen(m.match_date, m.match_time);
  if (when(before) !== when(after) || (before.venue || '').trim() !== (after.venue || '').trim()) return 'changed';
  return null;
}
