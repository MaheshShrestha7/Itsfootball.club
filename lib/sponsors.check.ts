// Self-check for sponsor link filtering and badge labels.
// Run: npx esbuild lib/sponsors.check.ts --bundle --platform=node --log-level=warning | node
import assert from 'node:assert/strict';
import { chartBuckets, isSponsorOnSite, safeLinkHref, sponsorHref, sponsorLabel, sponsorSignupStage, sponsorTierLabel } from './sponsors';

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

// Report chart: a bar a day up to 31 days, a bar a week beyond, covering the whole range
const days = chartBuckets(new Date(2026, 9, 1, 15), new Date(2026, 9, 7, 12));
assert.equal(days.length, 7);
assert.equal(days[0].start, new Date(2026, 9, 1).getTime(), 'starts at midnight');
assert.equal(days[6].end, new Date(2026, 9, 7, 12).getTime() + 1, 'ends at the range end');
const weeks = chartBuckets(new Date(2026, 6, 1), new Date(2026, 9, 1));
assert.equal(weeks.length, 14);
assert.ok(weeks[0].label.startsWith('w/c '));
assert.deepEqual(chartBuckets(new Date(2026, 9, 7), new Date(2026, 9, 1)), []);

console.log('sponsors: link filtering, labels, on-site and sign-up stages, chart bars OK');
