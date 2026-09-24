import { adminMetadata } from '@/lib/seo';

export const generateMetadata = adminMetadata('Tournament', 'tournaments/[tournamentId]', 'Run fixtures, tables and the bracket');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
