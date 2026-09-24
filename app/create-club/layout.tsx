import type { Metadata } from 'next';
import { fitDescription, pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Create a Football Club Website | itsfootball.club',
  description: fitDescription(
    'Set up your football club website in minutes: club branding, fixtures, live match center, squad and member passes.',
    'Register your club today.'
  ),
  path: '/create-club',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
