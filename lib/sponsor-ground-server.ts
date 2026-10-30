import type { SupabaseClient } from '@supabase/supabase-js';
import { groundSponsorList, type GroundPlace } from '@/lib/sponsors';
import type { Sponsor, SponsorshipPackage } from '@/lib/supabase/types';

/** What a poster, ticket or check-in screen shows of a sponsor: nothing from the deal itself */
export interface GroundSponsor {
  id: string;
  name: string;
  logo_url: string;
  website_url: string | null;
  tier: string;
}

const COLUMNS = 'id, event_id, name, logo_url, website_url, tier, display_order, is_active, package_status, package_value, ends_on';

/** The sponsors for a place at the ground (groundSponsorList), read with the service role: the
 *  public sponsors_public view leaves out package_id and package_value, which decide who goes on.
 *  An empty list while the package migrations haven't run. */
export async function loadGroundSponsors(db: SupabaseClient, clubId: string, place: GroundPlace, eventId?: string | null): Promise<GroundSponsor[]> {
  // package_id arrives with migration 20261137; before that, every sponsor is matched by tier and price
  const withPackage = await db.from('sponsors').select(`${COLUMNS}, package_id`).eq('club_id', clubId).eq('is_active', true);
  const sponsors = withPackage.error
    ? (await db.from('sponsors').select(COLUMNS).eq('club_id', clubId).eq('is_active', true)).data
    : withPackage.data;
  const { data: packages } = await db.from('sponsorship_packages').select('id, tier, price_cents, includes').eq('club_id', clubId);
  if (!sponsors?.length || !packages?.length) return [];
  return groundSponsorList(sponsors as unknown as Sponsor[], packages as SponsorshipPackage[], place, { eventId })
    .map(s => ({ id: s.id, name: s.name, logo_url: s.logo_url, website_url: s.website_url || null, tier: s.tier }));
}
