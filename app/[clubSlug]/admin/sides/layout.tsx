import { adminMetadata } from '@/lib/seo';

export const generateMetadata = adminMetadata('In-house Sides', 'sides', 'Split your members into sides for club cups and fun days');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
