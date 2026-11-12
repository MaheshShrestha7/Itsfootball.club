import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { preload } from 'react-dom';
import { fitDescription, pageMetadata } from '@/lib/seo';
import { homeSchema } from '@/lib/schema';
import JsonLd from '@/components/JsonLd';
import HomeClient from './HomeClient';
import { findHomeDemoClub, listLatestClubContent, listLatestResults, listUpcoming } from '@/lib/supabase/club-lookup';

export const metadata: Metadata = pageMetadata({
  title: 'Free Football & Soccer Club Websites | itsfootball.club',
  description: fitDescription(
    'Free websites for football and soccer clubs, with a live match centre, digital member passes, squad lineups, a club shop and sponsor showcases.',
    'Create your club free today.'
  ),
  path: '/',
});

export default async function Page() {
  // The hero background is the page's largest paint; fetch the one for the current theme early (same cookie as the root layout)
  const light = (await cookies()).get('theme')?.value === 'light';
  preload(light ? '/images/stadium_hero_daytime.webp' : '/images/stadium_hero_bg.webp', { as: 'image', fetchPriority: 'high' });
  const [latest, demoClub, results, upcoming] = await Promise.all([listLatestClubContent(), findHomeDemoClub(), listLatestResults(), listUpcoming()]);
  return (
    <>
      <JsonLd data={homeSchema()} />
      <HomeClient latestNews={latest.news} latestPhotos={latest.photos} results={results} upcoming={upcoming} demoClub={demoClub} />
    </>
  );
}
