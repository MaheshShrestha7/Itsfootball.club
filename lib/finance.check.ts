// Self-check for finance helpers.
// Run: npx esbuild lib/finance.check.ts --bundle --platform=node --log-level=warning | node
import assert from 'node:assert/strict';
import {
  bookingFeeCents,
  bookingFeeText,
  membershipTermEnd,
  parseMoneyToCents,
  paymentReference,
  paymentSeason,
  toCsv,
  DEFAULT_MEMBERSHIP_PAYMENT_POLICY,
  MEMBERSHIP_PAYMENT_POLICIES,
  policyAllowsWaiver,
  policyAutoApprovesOnPayment,
} from './finance';
import { matchesFileSignature } from './file-signature';

assert.equal(parseMoneyToCents('12.50'), 1250);
assert.equal(parseMoneyToCents('1,200'), 120000);
assert.equal(parseMoneyToCents('0.1'), 10);
assert.equal(parseMoneyToCents('19.99'), 1999);
assert.equal(parseMoneyToCents('-5'), null);
assert.equal(parseMoneyToCents('1.234'), null);
assert.equal(parseMoneyToCents('abc'), null);
assert.equal(parseMoneyToCents(''), null);

const none = { percent: 0, flatCents: 0, minCents: 0 };
assert.equal(bookingFeeCents(6000, none), 0);
assert.equal(bookingFeeCents(6000, { ...none, flatCents: 100 }), 100);
assert.equal(bookingFeeCents(6000, { ...none, percent: 2 }), 120);
assert.equal(bookingFeeCents(500, { ...none, percent: 2, minCents: 30 }), 30);
assert.equal(bookingFeeText(none), 'no booking fee');
assert.equal(bookingFeeText({ ...none, percent: 1.5, minCents: 30 }), "1.5% of the payment (minimum 0.30 in the payment's currency)");
assert.equal(bookingFeeText({ ...none, percent: 2 }), '2% of the payment');
assert.equal(bookingFeeText({ ...none, percent: 1, flatCents: 20 }), "1% of the payment + 0.20 (in the payment's currency)");
assert.equal(bookingFeeCents(6000, { percent: 1.5, flatCents: 20, minCents: 30 }), 110);
assert.equal(bookingFeeCents(0, { ...none, minCents: 30 }), 0);

assert.equal(paymentReference('3f2a9c1e-0000-4000-8000-000000000000'), '3F2A9C1E');

assert.equal(toCsv([['a', 1, null], ['b,c', 'say "hi"', 'x\ny']]), 'a,1,\r\n"b,c","say ""hi""","x\ny"');
assert.equal(toCsv([['=HYPERLINK("x")', '-5', '+1', '@a']]), `"'=HYPERLINK(""x"")",'-5,'+1,'@a`);

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);
const text = (s: string) => new Uint8Array([...s].map(c => c.charCodeAt(0)));
assert.ok(matchesFileSignature(bytes(0xff, 0xd8, 0xff), 'image/jpeg'));
assert.ok(!matchesFileSignature(bytes(0xff, 0xd8, 0xff), 'image/png'));
assert.ok(matchesFileSignature(text('%PDF-1.7\n'), 'application/pdf'));
assert.ok(!matchesFileSignature(text('MZ\x90\x00'), 'application/pdf'));
assert.ok(matchesFileSignature(text('RIFF\0\0\0\0WEBPVP8 '), 'image/webp'));
assert.ok(!matchesFileSignature(text('%PDF-1.7'), 'image/svg+xml'));

// Membership terms: year to year (the request's example) and fiscal year
assert.equal(membershipTermEnd('2025-08-01', null), '2026-08-01');
assert.equal(membershipTermEnd('2025-08-01', { membership_renewal: 'anniversary' }, 6), '2026-02-01');
assert.equal(membershipTermEnd('2024-02-29', null), '2025-02-28');
assert.equal(membershipTermEnd('2025-11-30', null, 3), '2026-02-28');
const july = { membership_renewal: 'fiscal' as const, fiscal_year_start_month: 7 };
assert.equal(membershipTermEnd('2025-08-01', july), '2026-07-01');
assert.equal(membershipTermEnd('2026-06-30', july), '2026-07-01');
assert.equal(membershipTermEnd('2026-07-01', july), '2027-07-01'); // renewing from the renewal date
assert.equal(membershipTermEnd('2026-01-15', { membership_renewal: 'fiscal', fiscal_year_start_month: 1 }), '2027-01-01');
// Grace period: joining within N days before the fiscal year starts runs to the next one
const grace = { ...july, fiscal_grace_days: 30 };
assert.equal(membershipTermEnd('2026-06-15', grace), '2027-07-01');
assert.equal(membershipTermEnd('2026-06-01', grace), '2027-07-01'); // exactly 30 days before
assert.equal(membershipTermEnd('2026-05-31', grace), '2026-07-01'); // 31 days before: this year
assert.equal(membershipTermEnd('2026-07-01', grace), '2027-07-01'); // renewing from the renewal date
assert.equal(membershipTermEnd('2026-06-15', { ...july, fiscal_grace_days: 0 }), '2026-07-01');
assert.equal(membershipTermEnd('2025-12-20', { membership_renewal: 'fiscal', fiscal_year_start_month: 1, fiscal_grace_days: 14 }), '2027-01-01');
assert.equal(membershipTermEnd('2026-06-15', { membership_renewal: 'anniversary', fiscal_grace_days: 30 }), '2027-06-15'); // year to year ignores it

// Membership payment policy checks
assert.equal(DEFAULT_MEMBERSHIP_PAYMENT_POLICY, 'require_payment');
assert.equal(policyAllowsWaiver('require_payment'), false);
assert.equal(policyAllowsWaiver(null), false);
assert.equal(policyAllowsWaiver(undefined), false);
assert.equal(policyAllowsWaiver('allow_waiver'), true);
assert.equal(policyAllowsWaiver('auto_approve_with_waiver'), true);
assert.equal(policyAllowsWaiver('auto_approve'), false);

assert.equal(policyAutoApprovesOnPayment('require_payment'), false);
assert.equal(policyAutoApprovesOnPayment(null), false);
assert.equal(policyAutoApprovesOnPayment(undefined), false);
assert.equal(policyAutoApprovesOnPayment('auto_approve'), true);
assert.equal(policyAutoApprovesOnPayment('auto_approve_with_waiver'), true);
assert.equal(policyAutoApprovesOnPayment('allow_waiver'), false);

assert.equal(MEMBERSHIP_PAYMENT_POLICIES.length, 4);
assert.equal(MEMBERSHIP_PAYMENT_POLICIES[0].id, 'require_payment');

// --- which season a payment counts in ---
const seasons2 = [{ name: '2025', start_date: '2025-01-01', end_date: '2025-12-31' }, { name: '2026', start_date: '2026-01-01', end_date: '2026-12-31' }];
const inSeason = (over: object) => paymentSeason({ status: 'paid', season: '2025', ...over }, seasons2);
assert.equal(inSeason({ paid_at: '2026-03-01T02:00:00Z' }), '2026', 'billed in 2025, paid in 2026: counts in 2026');
assert.equal(inSeason({ season: '2026', paid_at: '2025-03-01T02:00:00Z' }), '2025', 'and the other way round');
assert.equal(inSeason({ season: '2025', paid_at: '2025-12-31T12:59:00Z' }), '2025', 'late on 31 Dec in Sydney');
assert.equal(inSeason({ season: '2025', paid_at: '2025-12-31T13:30:00Z' }), '2026', 'already 1 Jan in Sydney, though still 31 Dec in UTC');
assert.equal(inSeason({ status: 'refunded', paid_at: '2026-03-01T02:00:00Z' }), '2026', 'a refund stays with the season it was paid in');
assert.equal(inSeason({ paid_at: null, created_at: '2026-03-01T02:00:00Z' }), '2026', 'no paid date recorded: when it was entered');
assert.equal(inSeason({ status: 'pending', paid_at: null, created_at: '2026-03-01T02:00:00Z' }), '2025', 'unpaid stays where it was filed');
assert.equal(inSeason({ status: 'rejected', created_at: '2026-03-01T02:00:00Z' }), '2025');
assert.equal(inSeason({ season: 'Old', paid_at: '2019-06-01T02:00:00Z' }), 'Old', 'outside every dated season: not lost, stays where filed');
assert.equal(inSeason({ season: null, paid_at: '2019-06-01T02:00:00Z' }), null, 'nothing to go on');
assert.equal(paymentSeason({ status: 'paid', season: '2025/26', paid_at: '2026-03-01T02:00:00Z' }, []), '2025/26', 'a club with no dated seasons works as before');
assert.equal(paymentSeason({ status: 'paid', season: 'x', paid_at: '2026-03-01T02:00:00Z' }, [{ name: 'Undated', start_date: null, end_date: null }]), 'x', 'an undated season can\'t claim anything');
assert.equal(paymentSeason({ status: 'paid', paid_at: '2026-07-01T02:00:00Z' }, [{ name: 'A', start_date: '2026-01-01', end_date: '2026-07-01' }, { name: ' B ', start_date: '2026-07-01', end_date: '2027-06-30' }]), 'B', 'a shared day goes to the later season, name trimmed');

console.log('finance: money, booking fee, CSV, file signatures, membership terms and payment policies OK');
