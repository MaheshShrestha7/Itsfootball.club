import type { Metadata } from 'next';
import { fitDescription, pageMetadata } from '@/lib/seo';
import { homeSchema } from '@/lib/schema';
import JsonLd from '@/components/JsonLd';
import HomeClient from './HomeClient';

export const metadata: Metadata = pageMetadata({
  title: 'Football Club Website & Live Match Center | itsfootball.club',
  description: fitDescription(
    'Launch your football club website with live match centers, digital member passes, squad lineups and sponsor showcases.',
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
