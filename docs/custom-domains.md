# Club custom domains

A club owner types their domain (e.g. `www.yourclub.com`) in **Admin -> Branding** and clicks
**Connect domain**. From there it sets itself up: the page shows the one DNS record to add, and goes
to **Live** by itself once that record is in place. Nobody on our side has to do anything per club.

## How it works

1. **Connect** (`app/api/custom-domain`, owner only) registers the hostname with Cloudflare for SaaS
   through the API (`lib/cloudflare.ts`), then saves it in `clubs.custom_domain`. Changing or
   disconnecting removes the old hostname from Cloudflare.
2. The club adds `CNAME www -> cname.itsfootball.club`. Cloudflare sees it, validates over HTTP and
   issues the certificate, usually within minutes. The Branding page re-checks every 30 seconds.
3. Requests arrive at our Worker through the `*/*` route. `middleware.ts` looks up the domain (cached
   60s) and rewrites `www.yourclub.com/member` -> `/{slug}/member`. Paths that already start with the
   slug (every link the app renders), `/api` and `/auth` pass through. Platform pages
   (`/my-clubs`, ...) and unknown domains redirect to itsfootball.club.
4. **Sign-in**: Supabase only returns people to allowlisted URLs, so club-domain pages ask for
   `itsfootball.club/auth/confirm?to=<page>` (`authReturnUrl`). The email hook checks `to` is a
   registered club domain and emails a link to `<club domain>/auth/confirm`, which verifies the token
   on that domain and signs the member in there.

## One-time setup

1. **Cloudflare -> SSL/TLS -> Custom Hostnames**: enable Cloudflare for SaaS (the first 100
   hostnames are free, then $0.10 each per month).
2. **DNS**: add `cname` as a proxied `AAAA` record for `100::`. The Worker answers, so the address
   is never used. Set `cname.itsfootball.club` as the **Fallback Origin**.
3. **Workers Routes**: add the route `*/*` on the `itsfootball.club` zone -> `itsfootball-club` Worker.
   It catches every proxied hostname on the zone, so give any other one (e.g. `media.itsfootball.club`
   for R2 images) its own route `media.itsfootball.club/*` with Worker **None**.
4. **API token**: My Profile -> API Tokens -> Create, permission *Zone > SSL and Certificates > Edit*,
   limited to the `itsfootball.club` zone. Set both as Worker **secrets** (plain variables added in the
   dashboard are wiped by the next `wrangler deploy`):
   `CF_HOSTNAMES_TOKEN`, and `CF_ZONE_ID` (Zone ID from the zone's Overview page).
5. **Supabase -> Authentication -> URL Configuration -> Redirect URLs**: `https://itsfootball.club/**`
   (the Send Email hook must be on, see [email.md](email.md)).

## Club-facing notes

- Use a subdomain like `www`: most registrars can't put a CNAME on the bare `yourclub.com`, so they
  forward that to `www` instead.
- Links inside the site keep the slug (`www.yourclub.com/{slug}/member`); only the home page and
  typed-in paths are slug-free.
