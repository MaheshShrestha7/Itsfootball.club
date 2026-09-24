import { adminMetadata } from '@/lib/seo';

export const generateMetadata = adminMetadata('Inquiries', 'inquiries', 'Read and answer contact inquiries');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
