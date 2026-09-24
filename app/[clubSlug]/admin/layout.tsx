import React from 'react';
import { adminMetadata } from '@/lib/seo';
import AdminLayoutClient from './AdminLayoutClient';

// Admin dashboard; each admin screen below sets its own title the same way
export const generateMetadata = adminMetadata('Admin Dashboard', '', 'Run fixtures, squad, members, sponsors and branding');

export default function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clubSlug: string }>;
}) {
  return <AdminLayoutClient params={params}>{children}</AdminLayoutClient>;
}
