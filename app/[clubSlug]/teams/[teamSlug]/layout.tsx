import type { Metadata } from 'next';
import { findTeamBySlug } from '@/lib/supabase/club-lookup';
import { SITE_NAME, clubImage, clubName, clubPageMetadata, fitDescription, fitTitle, pageMetadata } from '@/lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ clubSlug: string; teamSlug: string }>;
}): Promise<Metadata> {
  const { clubSlug, teamSlug } = await params;
  return clubPageMetadata(clubSlug, async club => {
    const team = await findTeamBySlug(club.id, decodeURIComponent(teamSlug));
    const path = `/${club.slug}/teams/${teamSlug}`;
    if (!team) {
      return pageMetadata({
        title: fitTitle('Team not found', clubName(club)),
        description: fitDescription(`This team could not be found. See all ${club.name} teams.`, 'See all teams.'),
        path,
        ...clubImage(club),
        noIndex: true,
      });
    }
    return pageMetadata({
      title: fitTitle(team.name, clubName(club), SITE_NAME),
      description: fitDescription(
        team.description || `${club.name} ${team.name}: squad, coaches, fixtures and results.`,
        'Follow every game live on the club match center.'
      ),
      path,
      ...(team.logo_url ? { image: team.logo_url, imageIsSquare: true } : clubImage(club)),
    });
  });
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
