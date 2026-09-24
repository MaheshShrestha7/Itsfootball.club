import { adminMetadata } from '@/lib/seo';

export const generateMetadata = adminMetadata('Members', 'members', 'Approve and manage club members');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
