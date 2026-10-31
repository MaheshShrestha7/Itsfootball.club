// Self-check for member prices.
// Run: npx esbuild lib/member-prices.check.ts --bundle --platform=node --log-level=warning | node
import assert from 'node:assert/strict';
import { hasActiveMembership, productUnitCents, siteToday, ticketUnitCents } from './member-prices';

// Sydney's date, not the server's (Cloudflare runs in UTC): 31 Oct 14:00 UTC is 1 Nov 01:00 in Sydney
assert.equal(siteToday(Date.UTC(2026, 9, 31, 14)), '2026-11-01');
assert.equal(siteToday(Date.UTC(2026, 9, 31, 12)), '2026-10-31'); // 23:00 in Sydney

const today = '2026-10-31';
const own = { user_id: 'u1', guardian_email: null, membership_status: 'approved', status: 'active', membership_expires_at: '2027-01-01' };
const child = { user_id: null, guardian_email: 'Pat@Example.com ', membership_status: 'approved', status: 'active', membership_expires_at: null };

assert.equal(hasActiveMembership([own], 'u1', null, today), true);
assert.equal(hasActiveMembership([child], null, 'pat@example.com', today), true); // guardian, any case and spacing
assert.equal(hasActiveMembership([child], 'u9', ' PAT@example.com', today), true);
assert.equal(hasActiveMembership([{ ...own, membership_expires_at: today }], 'u1', null, today), true); // in date to the end of its last day
assert.equal(hasActiveMembership([{ ...own, membership_status: null }], 'u1', null, today), true); // blank status counts as approved, as in the database
assert.equal(hasActiveMembership([{ ...own, membership_expires_at: '2026-10-30' }], 'u1', null, today), false);
assert.equal(hasActiveMembership([{ ...own, status: 'suspended' }], 'u1', null, today), false);
assert.equal(hasActiveMembership([{ ...own, membership_status: 'pending' }], 'u1', null, today), false);
assert.equal(hasActiveMembership([{ ...own, membership_status: 'rejected' }], 'u1', null, today), false);
assert.equal(hasActiveMembership([own], 'u2', null, today), false); // someone else's row
assert.equal(hasActiveMembership([child], null, 'pat@example.co', today), false); // a near miss on the email
assert.equal(hasActiveMembership([{ ...child, guardian_email: '' }], null, '', today), false); // blank never matches blank
assert.equal(hasActiveMembership([own], null, null, today), false); // signed out
// One lapsed row and one active one: the active one counts
assert.equal(hasActiveMembership([{ ...own, membership_expires_at: '2020-01-01' }, child], 'u1', 'pat@example.com', today), true);

const event = { ticket_price_cents: 3000, ticket_member_price_cents: 2000 };
assert.equal(ticketUnitCents(event, true), 2000);
assert.equal(ticketUnitCents(event, false), 3000);
assert.equal(ticketUnitCents({ ticket_price_cents: 3000, ticket_member_price_cents: null }, true), 3000); // no member price
assert.equal(ticketUnitCents({ ticket_price_cents: 3000 }, true), 3000); // before migration 20261143

assert.equal(productUnitCents({ price_cents: 6000, member_price_cents: 4500 }, true), 4500);
assert.equal(productUnitCents({ price_cents: 6000, member_price_cents: 4500 }, false), 6000);
assert.equal(productUnitCents({ price_cents: 6000 }, true), 6000);

console.log('member-prices: who is a member, Sydney dates, ticket and product prices OK');
