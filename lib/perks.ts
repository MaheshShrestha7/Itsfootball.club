import type { ClubPerk, Sponsor } from './supabase/types';
import { isPastEndDate, isSponsorOnSite } from './sponsors';

/** Why a perk isn't showing to members, or null when it is. The same rules as the
 *  club_perks_public view (migration 20261141), so the admin list can say why one disappeared */
export function perkHiddenReason(perk: ClubPerk, sponsors: Pick<Sponsor, 'id' | 'is_active' | 'package_status' | 'ends_on'>[], now = Date.now()): string | null {
  if (perk.is_active === false) return 'Hidden';
  if (isPastEndDate(perk, now)) return 'Ended';
  if (perk.sponsor_id) {
    const sponsor = sponsors.find(s => s.id === perk.sponsor_id);
    if (!sponsor || !isSponsorOnSite(sponsor, now)) return 'Hidden: the sponsor is off the site';
  }
  return null;
}

/** "Joe's Pizza", or the club's name when the admin left the business blank */
export function perkBusiness(perk: Pick<ClubPerk, 'business_name'>, clubName: string): string {
  return perk.business_name?.trim() || clubName;
}
