import { adminMetadata } from '@/lib/seo';

export const generateMetadata = adminMetadata('News & Content', 'content', 'Publish news articles and media');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
