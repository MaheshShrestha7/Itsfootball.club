import { adminMetadata } from '@/lib/seo';

export const generateMetadata = adminMetadata('Activity Log', 'activity', 'See who approved, removed, waived or verified what in the admin area');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
