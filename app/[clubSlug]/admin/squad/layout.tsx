import { adminMetadata } from '@/lib/seo';

export const generateMetadata = adminMetadata('Squad', 'squad', 'Manage the playing squad and player profiles');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
