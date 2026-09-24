import { adminMetadata } from '@/lib/seo';

export const generateMetadata = adminMetadata('Fixtures', 'matches', 'Manage fixtures, results and match details');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
