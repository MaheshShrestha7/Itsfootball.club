import { adminMetadata } from '@/lib/seo';

export const generateMetadata = adminMetadata('Lineup Workbench', 'lineup/draft', 'Draft and publish the matchday lineup');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
