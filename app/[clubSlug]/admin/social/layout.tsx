import { adminMetadata } from '@/lib/seo';

export const generateMetadata = adminMetadata('Social Media', 'social', 'Posts for Facebook, Instagram, TikTok and WhatsApp from your fixtures and events');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
