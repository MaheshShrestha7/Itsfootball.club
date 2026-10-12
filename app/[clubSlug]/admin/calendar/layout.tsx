import { adminMetadata } from '@/lib/seo';

export const generateMetadata = adminMetadata('Calendar', 'calendar', 'See fixtures, events, training and tournaments by month or week');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
