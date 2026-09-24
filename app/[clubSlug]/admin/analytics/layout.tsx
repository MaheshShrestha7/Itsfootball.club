import { adminMetadata } from '@/lib/seo';

export const generateMetadata = adminMetadata('Audience Analytics', 'analytics', 'Track website visitors and sponsor performance');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
