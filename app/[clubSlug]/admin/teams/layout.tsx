import { adminMetadata } from '@/lib/seo';

export const generateMetadata = adminMetadata('Internal Teams', 'teams', 'Set up the club\'s internal teams and squads');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
