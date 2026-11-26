import { adminMetadata } from '@/lib/seo';

export const generateMetadata = adminMetadata('Features', 'features', 'Switch parts of the club site on or off');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
