# Next Steps: Feature Roadmap & Competitor Comparison

_Written 2026-10-03. Competitor details come from general product knowledge, not a live check: confirm current features and pricing before quoting them publicly._

## Where we stand

| | **itsfootball.club** | **Spond** | **TeamApp** | **Pitchero** | **TeamSnap** | **PlayHQ / Dribl** |
|---|---|---|---|---|---|---|
| Business model | Free, booking fee on payments | Free, fee on payments | Free, ad-funded | Free tier + paid plans | Subscription | Paid by associations |
| Real club website + own domain | ✅ strong | ❌ | ⚠️ basic | ✅ main product | ❌ | ❌ |
| Public live match centre | ✅ | ❌ | ⚠️ | ✅ | ⚠️ | ⚠️ scores only |
| Availability + lineups | ✅ | ✅ main product | ✅ | ⚠️ | ✅ | ❌ |
| Membership payments | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ registration |
| Sponsor tracking + reports | ✅ **unusual** | ❌ | ❌ | ⚠️ | ❌ | ❌ |
| Tournament engine | ✅ | ❌ | ❌ | ⚠️ | ⚠️ | ✅ league level |
| QR passes / gate check-in | ✅ **unusual** | ❌ | ❌ | ❌ | ❌ | ❌ |
| Merch shop | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| Gamification (ClubScore) | ✅ **unusual** | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Multiple teams / junior age groups** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Parent/guardian accounts** | ❌ | ✅ | ⚠️ | ⚠️ | ✅ | ✅ |
| **Recurring training + attendance** | ⚠️ events only | ✅ | ✅ | ⚠️ | ✅ | ❌ |
| **Calendar sync (.ics)** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Paid tickets** | ❌ (check-in only) | ⚠️ | ⚠️ | ⚠️ | ❌ | ❌ |
| Native app + chat | PWA + push | ✅ | ✅ | ✅ | ✅ | ✅ |

**Where we're ahead:** we're the only one that combines a public club website, sponsor reporting, QR gate entry and gamification, and does it for free.

**Where we're behind:** running a club with several teams. Most grassroots clubs have juniors, and that's exactly where Spond and TeamSnap are strongest.

## What to add, in order

### Tier 1: high value, mostly built from parts we already have

1. **Paid event & match-day tickets.** Events, `PaymentStep`, QR codes and the gate scanner already exist, so selling tickets mostly connects them. Every ticket sold earns the booking fee, so it pays for itself. _Effort: small._
2. **Calendar subscription (.ics feed)** for fixtures, events and training. Every competitor has it and it's often what makes people come back each week. One route handler, roughly 50 lines. _Effort: tiny._
3. **Auto-generated share graphics.** Fixture, result, lineup and player-of-the-match cards sized for Instagram and WhatsApp, made with Next's built-in `ImageResponse` (no new dependency). Every post shows our branding to the next club, which makes it the cheapest way to grow. _Effort: small–medium._
4. **Recurring training sessions with attendance.** We already have the `training` event category, availability, door QR check-in and `points_training_checkin`. What's missing is "every Tuesday 6pm" recurrence and an attendance report. That puts us level with Spond's core feature. _Effort: medium._

### Tier 2: the big strategic one

5. **Multiple teams and junior age groups (U8–U17, Women's, Seniors, Masters), with linked parent/guardian accounts.** This is the largest share of the grassroots market and Spond's biggest advantage over us. A parent registers and pays for two kids and replies to availability for them. It touches the squad, availability, lineups, the member pass and payments, so it's the largest piece of work on the list. It also opens up junior clubs, which are probably most of our potential customers. _Effort: large. Design before building._

### Tier 3: more revenue and fewer volunteer headaches

6. **Fundraising campaigns.** For example a "New kit fund" page with a progress bar toward a goal. Reuses the payment flow and earns booking fees. _Effort: small._
7. **Membership instalments and automatic renewal** using Stripe subscriptions. Treasurers' biggest complaint is chasing fees, and this removes the chasing. _Effort: medium._
8. **Volunteer duty roster** for canteen, line flags, kit washing and the BBQ. Every club runs one, usually on paper. Fits naturally with ClubScore points. _Effort: medium._
9. **Multilingual interface.** Our own example club is a Nepalese community club, and diaspora and community clubs are a niche nobody else serves. _Effort: medium._

## What to skip

- **Building group chat:** WhatsApp has already won. Make things easy to share into WhatsApp instead (item 3).
- **Native apps for now:** we already have a PWA with push notifications, so the remaining gains are small. Revisit when app-store visibility matters.
- **Livestreaming and video analysis:** Veo and Hudl own that space. Let clubs embed their links.
- **Governing-body registration integration:** those systems don't have open APIs. CSV import and export would cover most of the need.

## Recommended start

1. Ship items 1 and 2 first: together they're about a day of work, and tickets add revenue.
2. Then start designing item 5, the move into junior clubs, which is the biggest opportunity on the list.
