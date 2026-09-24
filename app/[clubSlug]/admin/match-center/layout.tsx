import { adminMetadata } from '@/lib/seo';

export const generateMetadata = adminMetadata('Match Center', 'match-center', 'Run live match reporting and the match clock');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
