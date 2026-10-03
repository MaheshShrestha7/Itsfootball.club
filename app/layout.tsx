import type { Metadata, Viewport } from 'next';
import { cookies, headers } from 'next/headers';
import { Outfit, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { ClubProvider } from '@/lib/club-context';
import { AuthProvider } from '@/lib/auth-context';
import SyncStatusBanner from '@/components/SyncStatusBanner';
import { ConfirmRoot } from '@/components/ConfirmDialog';
import ServiceWorker from '@/components/ServiceWorker';
import { SITE_NAME, SITE_URL, DEFAULT_OG_IMAGE } from '@/lib/seo';
import { loadInitialData } from '@/lib/supabase/server-data';

// Site-wide defaults only. Every route sets its own title, description, canonical URL and social
// tags (see lib/seo.ts), so nothing here should be page-specific - a canonical here would leak
// into every route that forgot to set one.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: SITE_NAME,
  keywords: ['football club platform', 'soccer management', 'live match center', 'digital member pass', 'club website builder', 'football club merch shop'],
  authors: [{ name: 'itsfootball.club team' }],
  openGraph: { siteName: SITE_NAME, type: 'website', images: [DEFAULT_OG_IMAGE] },
  twitter: { card: 'summary_large_image', images: [DEFAULT_OG_IMAGE] },
  // Home-screen app on iPhone (the web manifest is app/manifest.ts). 'default' keeps the status bar
  // above the page, so nothing slides under the notch.
  appleWebApp: { capable: true, title: 'itsfootball', statusBarStyle: 'default' },
};

// Self-hosted at build time by next/font: no render-blocking request to fonts.googleapis.com, and each
// family gets a size-adjusted local fallback so text doesn't reflow (CLS) when the webfont arrives.
const headingFont = Outfit({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800', '900'], display: 'swap', variable: '--font-outfit' });
const bodyFont = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'], display: 'swap', variable: '--font-jakarta' });
// Only used for small numeric labels, so it isn't preloaded
const monoFont = JetBrains_Mono({ subsets: ['latin'], weight: ['500', '700'], display: 'swap', variable: '--font-jetbrains', preload: false });

// Every page carries a per-request CSP nonce (middleware.ts), so none can be served prerendered
export const dynamic = 'force-dynamic';

/** 'light' or 'dark' (default), from the cookie ThemeToggle writes. Read on the server so the first paint is right. */
async function getTheme() {
  return (await cookies()).get('theme')?.value === 'light' ? 'light' : 'dark';
}

export async function generateViewport(): Promise<Viewport> {
  return {
    themeColor: (await getTheme()) === 'light' ? '#F3F5F9' : '#070A0F',
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    viewportFit: 'cover',
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-rendered pages start from real data (see ClubProvider's initialData)
  const requestHeaders = await headers();
  const initialData = await loadInitialData(requestHeaders.get('x-pathname') || '/');
  const theme = await getTheme();

  return (
    <html lang="en" data-theme={theme} className={`${headingFont.variable} ${bodyFont.variable} ${monoFont.variable}`}>
      <body>
        <AuthProvider>
          <ClubProvider initialData={initialData} hostSlug={requestHeaders.get('x-club-host-slug') || undefined}>
            <SyncStatusBanner />
            {children}
          </ClubProvider>
        </AuthProvider>
        <ConfirmRoot />
        <ServiceWorker />
      </body>
    </html>
  );
}
