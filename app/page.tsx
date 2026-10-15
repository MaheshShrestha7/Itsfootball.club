import type { Metadata } from 'next';
import { fitDescription, pageMetadata } from '@/lib/seo';
import { homeSchema } from '@/lib/schema';
import JsonLd from '@/components/JsonLd';
import HomeClient from './HomeClient';

export const metadata: Metadata = pageMetadata({
  title: 'Free Football & Soccer Club Websites | itsfootball.club',
  description: fitDescription(
    'Free websites for football and soccer clubs, with a live match centre, digital member passes, squad lineups, a club shop and sponsor showcases.',
    'Create your club free today.'
  ),
  path: '/',
});

export default function Page() {
  return (
    <>
      <JsonLd data={homeSchema()} />
      <HomeClient />
    </>
  );
}
