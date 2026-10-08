import { adminMetadata } from '@/lib/seo';

export const generateMetadata = adminMetadata('Photo Gallery', 'gallery', 'Upload photos and organise them into albums');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
