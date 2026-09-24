import { adminMetadata } from '@/lib/seo';

export const generateMetadata = adminMetadata('Events', 'events', 'Schedule events, RSVPs and door check-in');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
