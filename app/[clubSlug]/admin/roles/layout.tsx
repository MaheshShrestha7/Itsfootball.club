import { adminMetadata } from '@/lib/seo';

export const generateMetadata = adminMetadata('Roles & Permissions', 'roles', 'Decide what each club role can do in the admin area');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
