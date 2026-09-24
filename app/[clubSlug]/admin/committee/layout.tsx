import { adminMetadata } from '@/lib/seo';

export const generateMetadata = adminMetadata('Committee', 'committee', 'Manage the committee and executive profiles');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
