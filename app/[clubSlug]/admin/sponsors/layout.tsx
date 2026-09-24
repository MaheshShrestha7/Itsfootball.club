import { adminMetadata } from '@/lib/seo';

export const generateMetadata = adminMetadata('Sponsors', 'sponsors', 'Manage sponsors and sponsorship packages');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
