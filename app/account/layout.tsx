import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Account settings | itsfootball.club',
  description: 'Your itsfootball.club account: name, photo, email, password, two-step sign-in, club emails and notifications.',
  path: '/account',
  noIndex: true,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
