import { NextRequest, NextResponse } from 'next/server';

// Content-Security-Policy with a fresh nonce per request. Next.js reads the nonce from the request's
// CSP header and puts it on the scripts it renders, which is why every page renders dynamically
// (see `dynamic` in app/layout.tsx): a cached page would carry a stale nonce.
export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = (process.env.CSP_TEMPLATE || '').replaceAll('__NONCE__', nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages and API routes; static files and prefetches don't need a policy of their own
      source: '/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|txt|xml)$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
