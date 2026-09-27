import { adminMetadata } from '@/lib/seo';

export const generateMetadata = adminMetadata('Finance', 'finance', 'Track club income, expenses, payments and receipts');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
