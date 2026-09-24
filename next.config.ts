import type { NextConfig } from "next";

// Derive the Supabase host from the configured project URL so CSP connect-src/frame
// stays scoped to this project's own Supabase instance rather than a bare wildcard.
function supabaseHost(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

const SUPABASE_HOST = supabaseHost();

// R2_PUBLIC_DOMAIN is the custom domain club photos/logos are actually served from
// (see lib/storage/r2.ts) - separate from the *.r2.cloudflarestorage.com API host.
function r2PublicOrigin(): string | null {
  const domain = process.env.R2_PUBLIC_DOMAIN;
  if (!domain) return null;
  try {
    return new URL(domain).origin;
  } catch {
    // Tolerate a bare hostname (no scheme) in the env var
    return `https://${domain}`;
  }
}

const R2_PUBLIC_ORIGIN = r2PublicOrigin();

// `next dev` evaluates its hot-reload bundles with eval(); without this the dev app never hydrates.
// Production builds don't use eval, so it stays blocked there.
const IS_DEV = process.env.NODE_ENV === 'development';

const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'" + (IS_DEV ? " 'unsafe-eval'" : ''),
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://images.unsplash.com https://api.dicebear.com https://*.r2.cloudflarestorage.com https://*.cloudflare.com" +
    (SUPABASE_HOST ? ` https://${SUPABASE_HOST}` : '') +
    (R2_PUBLIC_ORIGIN ? ` ${R2_PUBLIC_ORIGIN}` : ''),
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self'" +
    (SUPABASE_HOST ? ` https://${SUPABASE_HOST} wss://${SUPABASE_HOST}` : ' https://*.supabase.co wss://*.supabase.co') +
    " https://*.r2.cloudflarestorage.com",
  "frame-src https://www.openstreetmap.org https://www.youtube.com https://www.youtube-nocookie.com",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join('; ');

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CSP_DIRECTIVES },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=(), usb=()' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: SECURITY_HEADERS,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "api.dicebear.com",
      },
      {
        protocol: "https",
        hostname: "*.r2.cloudflarestorage.com",
      },
      {
        protocol: "https",
        hostname: "*.cloudflare.com",
      }
    ],
  },
};

export default nextConfig;
