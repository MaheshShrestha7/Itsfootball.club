// Self-check for sponsor link filtering and badge labels.
// Run: npx esbuild lib/sponsors.check.ts --bundle --platform=node --log-level=warning | node
import assert from 'node:assert/strict';
import { buildPackageIncludes, canPayRenewal, hasRecentlyLapsed, holdsPackageSpot, isOpenInvoice, packageSpotsLeft, sponsorClickHref, chartBuckets, daysUntilEnd, isSponsorKey, packageIncludeLines, packageIncludes, placementName, topTierSponsors, typedWebsite, sponsorPageUrl, summariseSponsorEvents, defaultSponsorEnd, defaultSponsorSeason, sponsorshipPaidFor, isEndingSoon, isPastEndDate, isStaleSignup, isSponsorOnSite, localDateISO, matchSponsorPackage, renewedEndDate, reorderSponsors, safeLinkHref, sponsorHref, sponsorLabel, sponsorSignupStage, sponsorTierLabel } from './sponsors';

assert.equal(sponsorHref('https://acme.com/x?y=1'), 'https://acme.com/x?y=1');
assert.equal(sponsorHref('http://acme.com'), 'http://acme.com/');
assert.equal(sponsorHref('javascript:alert(document.cookie)'), undefined);
assert.equal(sponsorHref(' JavaScript:alert(1)'), undefined);
assert.equal(sponsorHref('data:text/html,<script>alert(1)</script>'), undefined);
assert.equal(sponsorHref('acme.com'), undefined);
assert.equal(sponsorHref(''), undefined);
assert.equal(sponsorHref(undefined), undefined);

// Admin links (platform announcements) may also be paths on this site
assert.equal(safeLinkHref('/tools'), '/tools');
assert.equal(safeLinkHref(' https://acme.com '), 'https://acme.com/');
assert.equal(safeLinkHref('//evil.com'), undefined);
assert.equal(safeLinkHref('/\\evil.com'), undefined);
assert.equal(safeLinkHref('javascript:alert(1)'), undefined);
assert.equal(safeLinkHref(null), undefined);

// Badge text: the admin's label, otherwise the plain tier name
assert.equal(sponsorTierLabel('platinum'), 'Platinum Partner');
assert.equal(sponsorTierLabel('gold'), 'Gold Partner');
assert.equal(sponsorTierLabel('silver'), 'Silver Partner');
assert.equal(sponsorTierLabel('bronze'), 'Bronze Partner');
assert.equal(sponsorTierLabel('grassroots'), 'Grassroots Partner');
assert.equal(sponsorTierLabel(undefined), 'Club Partner');
assert.equal(sponsorLabel({ tier: 'silver', label: 'Front of Shirt Partner' }), 'Front of Shirt Partner');
assert.equal(sponsorLabel({ tier: 'silver', label: '  Water Partner ' }), 'Water Partner');
assert.equal(sponsorLabel({ tier: 'silver', label: '   ' }), 'Silver Partner');
assert.equal(sponsorLabel({ tier: 'bronze', label: null }), 'Bronze Partner');
assert.equal(sponsorLabel({ tier: 'gold' }), 'Gold Partner');

// On the site: switched on and not ended (admins load every row, so the pages check this)
assert.equal(isSponsorOnSite({ is_active: true, package_status: 'paid' }), true);
assert.equal(isSponsorOnSite({ is_active: true }), true, 'public rows have no status');
assert.equal(isSponsorOnSite({ is_active: false, package_status: 'paid' }), false);
assert.equal(isSponsorOnSite({ is_active: true, package_status: 'expired' }), false);
assert.equal(isSponsorOnSite({ is_active: true, package_status: 'cancelled' }), false);

// Website sign-ups: paid ones wait for Put on site; unpaid ones nag for two weeks
const NOW = Date.parse('2026-10-28T09:00:00Z');
const DAY = 24 * 3600 * 1000;
const ago = (days: number) => new Date(NOW - days * DAY).toISOString();
assert.equal(sponsorSignupStage({ is_active: false, package_status: 'paid', created_at: ago(40) }, NOW), 'paid');
assert.equal(sponsorSignupStage({ is_active: false, package_status: 'prospect', created_at: ago(2) }, NOW), 'unpaid');
assert.equal(sponsorSignupStage({ is_active: false, package_status: 'prospect' }, NOW), 'unpaid', 'just arrived live');
assert.equal(sponsorSignupStage({ is_active: false, package_status: 'prospect', created_at: ago(20) }, NOW), null, 'old unpaid');
assert.equal(sponsorSignupStage({ is_active: true, package_status: 'paid' }, NOW), null, 'already on the site');
assert.equal(sponsorSignupStage({ is_active: false, package_status: 'expired' }, NOW), null);
assert.equal(sponsorSignupStage({ is_active: false, package_status: 'confirmed' }, NOW), null, 'hidden by an admin');
assert.equal(sponsorSignupStage({ is_active: false, package_status: 'paid', created_at: ago(40), went_live_at: ago(30) }, NOW), null, 'SPE-6: paid, was on the site, hidden by an admin');

// Report chart: a bar a day up to 31 days, a bar a week beyond, covering the whole range
const days = chartBuckets(new Date(2026, 9, 1, 15), new Date(2026, 9, 7, 12));
assert.equal(days.length, 7);
assert.equal(days[0].start, new Date(2026, 9, 1).getTime(), 'starts at midnight');
assert.equal(days[6].end, new Date(2026, 9, 7, 12).getTime() + 1, 'ends at the range end');
const weeks = chartBuckets(new Date(2026, 6, 1), new Date(2026, 9, 1));
assert.equal(weeks.length, 14);
assert.ok(weeks[0].label.startsWith('w/c '));
assert.deepEqual(chartBuckets(new Date(2026, 9, 7), new Date(2026, 9, 1)), []);


// End dates (SP-F5): on the site to the end of the last day, off the day after
{
  const noon = new Date(2026, 9, 28, 12).getTime(); // 28 Oct 2026, local time
  assert.equal(localDateISO(noon), '2026-10-28');
  const live = { is_active: true, package_status: 'paid' as const };
  assert.equal(isSponsorOnSite({ ...live, ends_on: '2026-10-28' }, noon), true);
  assert.equal(isSponsorOnSite({ ...live, ends_on: '2026-10-27' }, noon), false);
  assert.equal(isSponsorOnSite({ ...live, ends_on: null }, noon), true);
  assert.equal(isSponsorOnSite(live, noon), true); // public view rows have no end date
  assert.equal(isPastEndDate({ ends_on: '2026-10-27' }, noon), true);
  assert.equal(daysUntilEnd({ ends_on: '2026-10-28' }, noon), 0);
  assert.equal(daysUntilEnd({ ends_on: '2026-11-27' }, noon), 30);
  assert.equal(daysUntilEnd({ ends_on: null }, noon), null);
  assert.equal(isEndingSoon({ ...live, ends_on: '2026-11-27' }, noon), true);
  assert.equal(isEndingSoon({ ...live, ends_on: '2026-11-28' }, noon), false);
  assert.equal(isEndingSoon({ ...live, ends_on: '2026-10-27' }, noon), false); // already ended
  assert.equal(isEndingSoon({ is_active: false, package_status: 'paid', ends_on: '2026-11-01' }, noon), false); // hidden

  // Renewing: a year from the old end date, or from today once it has passed
  assert.equal(renewedEndDate('2026-11-15', noon), '2027-11-15');
  assert.equal(renewedEndDate('2025-09-30', noon), '2027-10-28');
  assert.equal(renewedEndDate(null, noon), '2027-10-28');
  // SPE-1: paying again through a link only when a renewal is due
  assert.equal(canPayRenewal({ package_status: 'paid', ends_on: '2027-10-28' }, noon), false);
  assert.equal(canPayRenewal({ package_status: 'paid', ends_on: '2026-12-27' }, noon), true);
  assert.equal(canPayRenewal({ package_status: 'paid', ends_on: '2026-12-28' }, noon), false);
  assert.equal(canPayRenewal({ package_status: 'confirmed', ends_on: '2026-10-01' }, noon), true);
  assert.equal(canPayRenewal({ package_status: 'paid', ends_on: null }, noon), false);
  assert.equal(canPayRenewal({ package_status: 'expired', ends_on: null }, noon), true);
  assert.equal(canPayRenewal({ package_status: 'prospect', ends_on: '2026-11-01' }, noon), false);
  assert.equal(renewedEndDate('2028-02-29', noon), '2029-02-28');

  // Default end: the current season's end, else the next season's, else a year from today
  const season = (start_date: string, end_date: string, is_current = false) => ({ start_date, end_date, is_current });
  assert.equal(defaultSponsorEnd([season('2026-02-01', '2027-06-15', true)], noon), '2027-06-15');
  // SPE-13: a season ending within 90 days gives the next one, else a year from today
  assert.equal(defaultSponsorEnd([season('2026-02-01', '2026-11-30', true)], noon), '2027-10-28');
  assert.equal(defaultSponsorEnd([season('2026-02-01', '2026-11-30', true), season('2027-02-01', '2027-09-30')], noon), '2027-09-30');
  assert.equal(defaultSponsorSeason([{ name: '2026', is_current: true }, { name: '2025', is_current: false }], '2026/27'), '2026');
  assert.equal(defaultSponsorSeason([], '2026/27'), '2026/27');
  // SPE-14: a renewal says so, with the period it pays for
  assert.deepEqual(sponsorshipPaidFor({ description: 'Gold Package renewal (Acme Plumbing)', covers_from: '2026-11-07', covers_until: '2027-11-07' }), { renewal: true, period: '7 Nov 2026 to 7 Nov 2027' });
  assert.deepEqual(sponsorshipPaidFor({ description: 'Gold Package (Kelly Bakery)', covers_until: null }), { renewal: false, period: null });
  assert.equal(defaultSponsorEnd([season('2026-02-01', '2026-09-30', true), season('2027-02-01', '2027-09-30'), season('2028-02-01', '2028-09-30')], noon), '2027-09-30');
  assert.equal(defaultSponsorEnd([], noon), '2027-10-28');

  // Clearing old sign-ups: unpaid, hidden and over 60 days old only
  const day = 24 * 3600 * 1000;
  const old = new Date(noon - 61 * day).toISOString();
  assert.equal(isStaleSignup({ is_active: false, package_status: 'prospect', created_at: old }, noon), true);
  assert.equal(isStaleSignup({ is_active: false, package_status: 'prospect', created_at: new Date(noon - 59 * day).toISOString() }, noon), false);
  assert.equal(isStaleSignup({ is_active: false, package_status: 'paid', created_at: old }, noon), false);
  assert.equal(isStaleSignup({ is_active: true, package_status: 'prospect', created_at: old }, noon), false);
  assert.equal(isStaleSignup({ is_active: false, package_status: 'prospect' }, noon), false);
}

// Reordering (SP-U4): moves only within the sponsor's tier, renumbers down the list
{
  const list = [
    { id: 'a', tier: 'platinum' as const, display_order: 1 },
    { id: 'b', tier: 'gold' as const, display_order: 2 },
    { id: 'c', tier: 'gold' as const, display_order: 3 },
    { id: 'd', tier: 'gold' as const, display_order: 7 },
    { id: 'e', tier: 'silver' as const, display_order: 4 },
  ];
  assert.deepEqual(reorderSponsors(list, 'd', 1), [{ id: 'd', display_order: 2 }, { id: 'b', display_order: 3 }, { id: 'c', display_order: 4 }, { id: 'e', display_order: 5 }]);
  assert.deepEqual(reorderSponsors(list, 'b', 0), [{ id: 'd', display_order: 4 }, { id: 'e', display_order: 5 }]); // can't jump above platinum
  assert.deepEqual(reorderSponsors(list, 'c', 2), [{ id: 'd', display_order: 4 }, { id: 'e', display_order: 5 }]); // same place: only tidies numbers
  assert.deepEqual(reorderSponsors(list, 'zz', 0), []);
}

// Which package a payment / renewal link is for
{
  const pkgs = [
    { id: 'free', tier: 'gold' as const, price_cents: 0 },
    { id: 'gold', tier: 'gold' as const, price_cents: 150000 },
    { id: 'gold2', tier: 'gold' as const, price_cents: 200000 },
    { id: 'silver', tier: 'silver' as const, price_cents: 75000 },
  ];
  assert.equal(matchSponsorPackage({ tier: 'gold', package_value: 2000 }, pkgs)?.id, 'gold2');
  assert.equal(matchSponsorPackage({ tier: 'gold', package_value: undefined }, pkgs)?.id, 'gold');
  assert.equal(matchSponsorPackage({ tier: 'platinum', package_value: 750 }, pkgs)?.id, 'silver');
  assert.equal(matchSponsorPackage({ tier: 'platinum', package_value: 99 }, pkgs), null);
  assert.equal(matchSponsorPackage({ tier: 'platinum', package_value: 99 }, [pkgs[3]])?.id, 'silver');
  assert.equal(matchSponsorPackage({ tier: 'gold', package_value: 0 }, [pkgs[0]]), null); // price on request: nothing to pay
}

// The sponsor's page and the admin report, in plain words
{
  const r = summariseSponsorEvents([
    { event_type: 'impression', placement: 'club_home_showcase', visitor_hash: 'a' },
    { event_type: 'impression', placement: 'club_home_showcase', visitor_hash: 'a' },
    { event_type: 'impression', placement: 'footer_marquee', visitor_hash: 'b' },
    { event_type: 'impression', placement: 'something_new', visitor_hash: null },
    { event_type: 'viewable_impression', placement: 'footer_marquee', visitor_hash: 'c' },
    { event_type: 'click', placement: 'footer_marquee', visitor_hash: 'b' },
  ]);
  assert.equal(r.seen, 4);
  assert.equal(r.people, 2);
  assert.equal(r.clicks, 1);
  assert.deepEqual(r.byPlacement.map(p => [p.label, p.seen, p.clicks]), [['Home page', 2, 0], ['Every page footer', 1, 1], ['Other pages', 1, 0]]);
  assert.deepEqual(summariseSponsorEvents([]), { seen: 0, people: 0, clicks: 0, byPlacement: [] });
  const key = 'a'.repeat(64);
  assert.equal(sponsorPageUrl('https://itsfootball.club/riverside-rovers-fc/', key), `https://itsfootball.club/riverside-rovers-fc/sponsor/your-sponsorship?k=${key}`);
  assert.ok(isSponsorKey(key));
  assert.equal(typedWebsite('acme.com.au'), 'https://acme.com.au/');
  assert.equal(typedWebsite(' http://acme.com.au/x '), 'http://acme.com.au/x');
  assert.equal(typedWebsite('javascript:alert(1)'), undefined);
  assert.equal(typedWebsite(''), undefined);
  assert.equal(typedWebsite('www.acme.com.au'), 'https://www.acme.com.au/');
  assert.equal(typedWebsite('not a website'), undefined);
  assert.equal(typedWebsite('acme'), undefined);
  assert.equal(typedWebsite('https://localhost'), undefined);
  assert.ok(!isSponsorKey('A'.repeat(64)) && !isSponsorKey('a'.repeat(63)) && !isSponsorKey(undefined));
}

// Package ticks and the "Supported by" strip
{
  assert.deepEqual(packageIncludes(['footer', 'Ground sign', 'home_page', ' ']), { places: ['home_page', 'footer'], extras: ['Ground sign'] });
  assert.deepEqual(packageIncludeLines(['match_graphics', 'Kit sleeve']), ['Logo on match result graphics', 'Kit sleeve']);
  assert.deepEqual(packageIncludeLines(undefined), []);
  assert.deepEqual(buildPackageIncludes(['event_pages', 'home_page'], 'Matchday banner\n\n  Kit sleeve \nMatchday banner\nfooter'), ['home_page', 'event_pages', 'Matchday banner', 'Kit sleeve']);
  assert.equal(buildPackageIncludes([], 'x'.repeat(200))[0].length, 80);
  const list = [
    { id: 'a', tier: 'gold' as const, display_order: 2 },
    { id: 'b', tier: 'silver' as const, display_order: 1 },
    { id: 'c', tier: 'gold' as const, display_order: 1 },
  ];
  assert.deepEqual(topTierSponsors(list).map(s => s.id), ['c', 'a']);
  assert.deepEqual(topTierSponsors([]), []);
  assert.equal(placementName('supported_by'), 'Match reports and news');
}

// SPP-4: who holds a package's spot, and how many are left
{
  const NOW = new Date(2026, 9, 29, 12).getTime();
  const DAY_MS = 864e5;
  const base = { package_id: 'pkg', is_active: false, created_at: new Date(NOW - 5 * DAY_MS).toISOString() };
  assert.equal(holdsPackageSpot({ ...base, package_status: 'paid' }, false, NOW), true, 'paid holds it');
  assert.equal(holdsPackageSpot({ ...base, package_status: 'confirmed' }, false, NOW), true, 'agreed by hand holds it');
  assert.equal(holdsPackageSpot({ ...base, package_status: 'prospect' }, false, NOW), false, 'an old unpaid sign-up lets it go');
  assert.equal(holdsPackageSpot({ ...base, package_status: 'prospect', created_at: new Date(NOW - 3600e3).toISOString() }, false, NOW), true, 'a new sign-up holds it for 48 hours');
  assert.equal(holdsPackageSpot({ ...base, package_status: 'prospect' }, true, NOW), true, 'an open invoice or receipt holds it');
  assert.equal(holdsPackageSpot({ ...base, package_status: 'expired' }, true, NOW), false, 'ended');
  assert.equal(holdsPackageSpot({ ...base, package_status: 'paid', ends_on: '2026-10-28' }, false, NOW), false, 'past its end date');
  assert.equal(holdsPackageSpot({ ...base, package_id: null, package_status: 'paid' }, false, NOW), false, 'no package');
  assert.equal(packageSpotsLeft({ max_sponsors: null }, 3), null);
  assert.equal(packageSpotsLeft({ max_sponsors: 2 }, 1), 1);
  assert.equal(packageSpotsLeft({ max_sponsors: 1 }, 2), 0);

  // SPP-1: came off the site by itself in the last two weeks
  assert.equal(hasRecentlyLapsed({ is_active: true, package_status: 'paid', ends_on: '2026-10-20' }, NOW), true);
  assert.equal(hasRecentlyLapsed({ is_active: true, package_status: 'paid', ends_on: '2026-10-29' }, NOW), false, 'last day today');
  assert.equal(hasRecentlyLapsed({ is_active: true, package_status: 'paid', ends_on: '2026-10-01' }, NOW), false, 'over two weeks ago');
  assert.equal(hasRecentlyLapsed({ is_active: false, package_status: 'expired', ends_on: '2026-10-20' }, NOW), false, 'ended by an admin');
}

// SPP-2: an invoice sent before payment
assert.equal(isOpenInvoice({ kind: 'sponsorship', status: 'pending', due_on: '2026-11-12' }), true);
assert.equal(isOpenInvoice({ kind: 'sponsorship', status: 'pending', due_on: null }), false, 'an abandoned card checkout');
assert.equal(isOpenInvoice({ kind: 'sponsorship', status: 'paid', due_on: '2026-11-12' }), false);

// Sponsor links tell the sponsor's analytics where visits came from
assert.equal(sponsorClickHref('https://acme.com.au/', 'riverside-fc'), 'https://acme.com.au/?utm_source=itsfootball.club&utm_medium=sponsor&utm_campaign=riverside-fc');
assert.equal(sponsorClickHref('https://acme.com.au/shop?id=4', 'rfc'), 'https://acme.com.au/shop?id=4&utm_source=itsfootball.club&utm_medium=sponsor&utm_campaign=rfc');
assert.equal(sponsorClickHref('https://acme.com.au/?utm_source=footy', 'rfc'), 'https://acme.com.au/?utm_source=footy', 'their own tags are kept');
assert.equal(sponsorClickHref('javascript:alert(1)', 'rfc'), undefined);
assert.equal(sponsorClickHref('https://acme.com.au/', undefined), 'https://acme.com.au/');

console.log('sponsors: link filtering, labels, on-site and sign-up stages, chart bars, end dates, renewals, reordering, results, package ticks, package limits, invoices OK');
