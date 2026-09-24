import { adminMetadata } from '@/lib/seo';

export const generateMetadata = adminMetadata('Branding', 'branding', 'Customise the crest, colours, kit and domain');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
