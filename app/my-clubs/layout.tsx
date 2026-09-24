import type { Metadata } from 'next';
import { fitDescription, pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'My Clubs | itsfootball.club',
  description: fitDescription(
    'See every football club you manage or belong to on itsfootball.club and jump straight into its admin console or member area.',
    'Sign in to continue.'
  ),
  path: '/my-clubs',
  noIndex: true,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
