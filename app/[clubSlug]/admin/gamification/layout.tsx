import { adminMetadata } from '@/lib/seo';

export const generateMetadata = adminMetadata('ClubScore Rewards', 'gamification', 'Set up ClubScore points, badges and streaks');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
