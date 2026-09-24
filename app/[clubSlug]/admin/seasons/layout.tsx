import { adminMetadata } from '@/lib/seo';

export const generateMetadata = adminMetadata('Seasons', 'seasons', 'Manage club seasons and season archives');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
