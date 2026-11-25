'use client';

import { useClub } from '@/lib/club-context';
import { videoEmbed } from '@/lib/video';
import { featureOn } from '@/lib/club-features';

/** Which of the club's public sections the menus link to. Tournaments, Gallery and Leadership only once
 *  they have something on them (like the Shop), so visitors don't land on an empty page; any section
 *  the club switched off (lib/club-features.ts) never */
export function useClubSections(clubId: string): { tournaments: boolean; gallery: boolean; leadership: boolean; events: boolean; news: boolean; sponsor: boolean } {
  const { clubs, tournaments, gallery, news, members } = useClub();
  const club = clubs.find(c => c.id === clubId);
  return {
    tournaments: featureOn(club, 'tournaments') && tournaments.some(t => t.club_id === clubId),
    gallery: featureOn(club, 'gallery') && (gallery.some(g => g.club_id === clubId) || news.some(n => n.club_id === clubId && !!videoEmbed(n.video_embed_url))),
    leadership: members.some(m => m.club_id === clubId && m.is_executive),
    events: featureOn(club, 'events'),
    news: featureOn(club, 'news'),
    sponsor: featureOn(club, 'sponsor_page'),
  };
}
