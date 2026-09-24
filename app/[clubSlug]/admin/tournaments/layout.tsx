import { adminMetadata } from '@/lib/seo';

export const generateMetadata = adminMetadata('Tournaments', 'tournaments', 'Create and run tournaments and cups');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
