import { adminMetadata } from '@/lib/seo';

export const generateMetadata = adminMetadata('Pass Scanner', 'scanner', 'Scan member passes and tickets at the gate');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
