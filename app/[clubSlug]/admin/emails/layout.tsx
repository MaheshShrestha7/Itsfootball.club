import { adminMetadata } from '@/lib/seo';

export const generateMetadata = adminMetadata('Email Notifications', 'emails', 'Manage reminder emails and send notices to members');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
