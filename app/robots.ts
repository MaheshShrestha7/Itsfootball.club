import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

// noindex pages that aren't admin (check-in, availability, pass verification, My Clubs) are left
// crawlable on purpose: a crawler has to fetch a page to see its noindex tag.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin$',   // platform admin
          '/admin/',
          '/*/admin$', // each club's admin console, e.g. /ancc/admin/...
          '/*/admin/',
          '/api/',     // internal API endpoints
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
