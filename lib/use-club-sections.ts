'use client';

import { useClub } from '@/lib/club-context';
import { videoEmbed } from '@/lib/video';

/** Whether the club's Tournaments, Gallery and Leadership pages have anything on them yet: the menus
 *  only link to them from then on (like the Shop), so visitors don't land on an empty page */
export function useClubSections(clubId: string): { tournaments: boolean; gallery: boolean; leadership: boolean } {
  const { tournaments, gallery, news, members } = useClub();
  return {
    tournaments: tournaments.some(t => t.club_id === clubId),
    gallery: gallery.some(g => g.club_id === clubId) || news.some(n => n.club_id === clubId && !!videoEmbed(n.video_embed_url)),
    leadership: members.some(m => m.club_id === clubId && m.is_executive),
  };
}
