import { adminMetadata } from '@/lib/seo';

export const generateMetadata = adminMetadata('Hero Slider', 'hero-slider', 'Curate the homepage hero slider');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
