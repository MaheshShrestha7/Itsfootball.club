# Email setup (Resend)

All email goes out through [Resend](https://resend.com) from `notifications@itsfootball.club`:

| Email | Sent by | Branding |
| --- | --- | --- |
| Club owner sign-up confirmation | Supabase Auth, via the send-email hook | itsfootball.club |
| Member one-time sign-in link | Supabase Auth, via the send-email hook | The member's club (name, crest, colour) |
| Match availability reminder (48 h before, unanswered only) | Daily cron | Club |
| Event reminder (30 h before, registered attendees) | Daily cron | Club |
| Membership renewal (14 days before expiry, and once after it lapses; clubs with paid plans only) | Daily cron | Club |

Code: `lib/email/` (templates, sender, signature check), `app/api/auth/email-hook`, `app/api/cron/reminders`, `worker.ts` (cron trigger).

## 1. Verify the domain in Resend

Resend -> **Domains** -> **Add domain** -> `itsfootball.club` (region closest to your users).
Add the DNS records it shows at your DNS provider (Cloudflare):

- **MX** and **TXT (SPF)** on the `send` subdomain: lets Resend send for you
- **TXT (DKIM)** `resend._domainkey`: signs every email
- **TXT (DMARC)** `_dmarc`, e.g. `v=DMARC1; p=none; rua=mailto:you@itsfootball.club` (tighten to `p=quarantine` once reports look clean)

In Cloudflare set these records to **DNS only** (grey cloud). Wait until Resend shows the domain as **Verified**.
SPF + DKIM + DMARC are what stop Gmail/Outlook treating the mail as spam; the template alone can't.

## 2. Create an API key

Resend -> **API Keys** -> **Create** with **Sending access**, restricted to `itsfootball.club`.

## 3. Secrets

Set these in Cloudflare (`npx wrangler secret put NAME`) and in `.env.local` for local testing:

| Name | Value |
| --- | --- |
| `RESEND_API_KEY` | the key from step 2 |
| `SEND_EMAIL_HOOK_SECRET` | from step 4 (`v1,whsec_...`) |
| `CRON_SECRET` | any long random string, e.g. `openssl rand -hex 32` |
| `EMAIL_FROM_ADDRESS` | optional, defaults to `notifications@itsfootball.club` |
| `EMAIL_TIMEZONE` | optional, defaults to `Australia/Sydney` (times in reminders) |

## 4. Point Supabase Auth at the hook

Supabase -> **Authentication** -> **Hooks** -> **Send Email hook** -> **Enable**:

- Type: **HTTPS**
- URL: `https://itsfootball.club/api/auth/email-hook`
- **Generate secret**, copy it into `SEND_EMAIL_HOOK_SECRET`, deploy, then save the hook.

From then on Supabase stops sending its own emails and calls the hook instead. If the hook fails,
the person signing in sees "We could not send the email right now" and nothing is sent, so deploy
the secrets before enabling it.

Also check **Authentication** -> **URL Configuration**: Site URL `https://itsfootball.club`, and every
club custom domain in **Redirect URLs** (e.g. `https://yourclub.com/**`), or their sign-in links fall
back to the Site URL.

Rate limits: **Authentication** -> **Rate Limits** -> "emails sent" applies to the hook too; raise it
from the default if members sign in in bursts (e.g. matchday).

## 5. Database

Run `supabase/migrations/20261014_email_log.sql` (SQL editor). The reminder job refuses to send
without it, so a reminder can never go out twice.

## 6. Deploy

`npm run build:cloudflare` then deploy as usual. `wrangler.json` now uses `worker.ts` as the entry
(the OpenNext app plus a `scheduled` handler) and a cron trigger `0 22 * * *` = 8 am AEST / 9 am AEDT.

## Testing

- Sign in on a club's member page: the email should arrive from the club's name with its crest.
- List what the reminder job would send, without sending:
  `curl -X POST "https://itsfootball.club/api/cron/reminders?dry=1" -H "Authorization: Bearer $CRON_SECRET"`
- Run it for real: the same without `?dry=1`. Each reminder is logged in `email_log` and never repeats.
- Resend -> **Emails** shows every message, its delivery status, and bounces.
- `npm run check` covers the signature check and template escaping.

Before enabling reminders, tell clubs: players with a pending availability for a match in the next
48 hours get an email on the first run.
