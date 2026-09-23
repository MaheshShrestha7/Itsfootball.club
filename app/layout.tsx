import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ClubProvider } from '@/lib/club-context';
import { AuthProvider } from '@/lib/auth-context';
import SyncStatusBanner from '@/components/SyncStatusBanner';

export const metadata: Metadata = {
  title: 'itsfootball.club - The Premier Digital Platform for Football Clubs',
  description: 'Launch, brand, and manage your football club with live pitchside reporting, digital member passes, official club website, and stadium-grade match centers.',
  keywords: ['football club platform', 'soccer management', 'live match center', 'digital member pass', 'club website builder'],
  authors: [{ name: 'itsfootball.club team' }],
};

export const viewport: Viewport = {
  themeColor: '#070A0F',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <ClubProvider>
            <SyncStatusBanner />
            {children}
          </ClubProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
