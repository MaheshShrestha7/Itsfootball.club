import { adminMetadata } from '@/lib/seo';

export const generateMetadata = adminMetadata('Teams', 'teams', 'Set up the club\'s teams, squads and tournament sides');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
