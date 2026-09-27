import { adminMetadata } from '@/lib/seo';

export const generateMetadata = adminMetadata('Player Availability', 'availability', 'Collect squad availability for upcoming fixtures');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
