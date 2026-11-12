import { checkClubSlug } from './slugs';
import { clubPrepare } from './supabase/sync';
import { DEFAULT_CREST } from './crest';

// Mission Control -> Clubs -> New club (/api/platform/clubs). Turns the form into a clubs row,
// filled the same way the public Create club wizard fills it (lib/club-context createClub).

export interface NewClubInput {
  name?: unknown; short_name?: unknown; slug?: unknown;
  primary_color?: unknown; secondary_color?: unknown; accent_color?: unknown; logo_url?: unknown;
  stadium_name?: unknown; stadium_address?: unknown; stadium_pitch_type?: unknown; stadium_parking_info?: unknown;
  contact_email?: unknown; contact_phone?: unknown; owner_email?: unknown;
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[<>]/g, '').trim().slice(0, max) : '');
const colour = (v: unknown, fallback: string) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim().toUpperCase() : fallback);
export const looksLikeEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export function newClubRow(input: NewClubInput, ids: { id: string; ownerId: string }):
  { row: Record<string, unknown>; ownerEmail: string } | { error: string } {
  const name = text(input.name, 80);
  if (name.length < 2) return { error: 'Type the club’s name.' };
  const { cleanSlug, error } = checkClubSlug(text(input.slug, 80) || name);
  if (error) return { error };
  const contactEmail = text(input.contact_email, 200).toLowerCase();
  if (contactEmail && !looksLikeEmail(contactEmail)) return { error: 'The club email doesn’t look right.' };
  const ownerEmail = text(input.owner_email, 200).toLowerCase();
  if (ownerEmail && !looksLikeEmail(ownerEmail)) return { error: 'The owner’s email doesn’t look right.' };
  const logo = text(input.logo_url, 1000);

  const row = clubPrepare({
    id: ids.id,
    owner_id: ids.ownerId,
    slug: cleanSlug,
    name,
    short_name: text(input.short_name, 12) || name.substring(0, 3).toUpperCase(),
    founded_year: new Date().getFullYear(),
    logo_url: /^https:\/\//.test(logo) ? logo : DEFAULT_CREST,
    primary_color: colour(input.primary_color, '#10B981'),
    secondary_color: colour(input.secondary_color, '#0F172A'),
    accent_color: colour(input.accent_color, '#F59E0B'),
    stadium_name: text(input.stadium_name, 120),
    stadium_address: text(input.stadium_address, 200),
    stadium_pitch_type: text(input.stadium_pitch_type, 60) || 'Natural Grass',
    stadium_parking_info: text(input.stadium_parking_info, 200),
    contact_email: contactEmail,
    contact_phone: text(input.contact_phone, 40),
    is_active: true,
  });
  return { row, ownerEmail };
}
