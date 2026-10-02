import { adminMetadata } from '@/lib/seo';

export const generateMetadata = adminMetadata('Club Shop', 'shop', 'Manage merchandise and shop orders');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
