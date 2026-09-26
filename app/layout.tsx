import type { Metadata, Viewport } from 'next';
import { Outfit, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { ClubProvider } from '@/lib/club-context';
import { AuthProvider } from '@/lib/auth-context';
import SyncStatusBanner from '@/components/SyncStatusBanner';
import { SITE_NAME, SITE_URL, DEFAULT_OG_IMAGE } from '@/lib/seo';

// Site-wide defaults only. Every route sets its own title, description, canonical URL and social
// tags (see lib/seo.ts), so nothing here should be page-specific - a canonical here would leak
// into every route that forgot to set one.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: SITE_NAME,
  keywords: ['football club platform', 'soccer management', 'live match center', 'digital member pass', 'club website builder'],
  authors: [{ name: 'itsfootball.club team' }],
  openGraph: { siteName: SITE_NAME, type: 'website', images: [DEFAULT_OG_IMAGE] },
  twitter: { card: 'summary_large_image', images: [DEFAULT_OG_IMAGE] },
};

// Self-hosted at build time by next/font: no render-blocking request to fonts.googleapis.com, and each
// family gets a size-adjusted local fallback so text doesn't reflow (CLS) when the webfont arrives.
const headingFont = Outfit({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800', '900'], display: 'swap', variable: '--font-outfit' });
const bodyFont = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'], display: 'swap', variable: '--font-jakarta' });
// Only used for small numeric labels, so it isn't preloaded
const monoFont = JetBrains_Mono({ subsets: ['latin'], weight: ['500', '700'], display: 'swap', variable: '--font-jetbrains', preload: false });

// Every page carries a per-request CSP nonce (middleware.ts), so none can be served prerendered
export const dynamic = 'force-dynamic';

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
    <html lang="en" className={`${headingFont.variable} ${bodyFont.variable} ${monoFont.variable}`}>
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
