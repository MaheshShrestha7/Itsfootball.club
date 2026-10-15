import type { Metadata } from 'next';
import JsonLd from '@/components/JsonLd';
import { fitDescription, pageMetadata } from '@/lib/seo';
import { howToSchema } from '@/lib/schema';
import { CREATE_CLUB_STEPS } from '@/lib/faq';

export const metadata: Metadata = pageMetadata({
  title: 'Create a Football Club Website | itsfootball.club',
  description: fitDescription(
    'Set up your football club website in minutes: club branding, fixtures, live match centre, squad and member passes.',
    'Register your club today.'
  ),
  path: '/create-club',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={howToSchema('How to create a football club website', '/create-club', CREATE_CLUB_STEPS)} />
      {children}
    </>
  );
}
