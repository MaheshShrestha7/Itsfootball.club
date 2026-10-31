// Run: npx esbuild lib/payments-server.check.ts --bundle --platform=node | node   (part of `npm run check`)
// Who may pay a membership fee: the member, or their parent / guardian (guardian accounts, 20261103).
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { preparePayment, readPaymentInput } from './payments-server';

const CLUB = '00000000-0000-4000-8000-00000000000a';
const PLAN = '00000000-0000-4000-8000-000000000600';
const KID = '00000000-0000-4000-8000-000000000105';
const ADULT = '00000000-0000-4000-8000-000000000101';
const PARENT_USER = '99999999-9999-4999-8999-000000000001';
const ADULT_USER = '99999999-9999-4999-8999-000000000002';
const PKG = '00000000-0000-4000-8000-000000000700';
const NEW_SPONSOR = '00000000-0000-4000-8000-000000000801';
const LIVE_SPONSOR = '00000000-0000-4000-8000-000000000802';
const PAID_SPONSOR = '00000000-0000-4000-8000-000000000803';
const ENDED_SPONSOR = '00000000-0000-4000-8000-000000000804';
const BANK_SPONSOR = '00000000-0000-4000-8000-000000000805';
const INVOICED_SPONSOR = '00000000-0000-4000-8000-000000000806';
const SHIRT_HOLDER = '00000000-0000-4000-8000-000000000807';
const SHIRT_WANTER = '00000000-0000-4000-8000-000000000808';
const SHIRT_PKG = '00000000-0000-4000-8000-000000000701';
const inDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const KEY = 'a'.repeat(64);
// Member prices (migration 20261143)
const SHIRT = '00000000-0000-4000-8000-000000000901';
const SCARF = '00000000-0000-4000-8000-000000000902';
const EVENT = '00000000-0000-4000-8000-000000000903';
const EXPIRED_USER = '99999999-9999-4999-8999-000000000003';
const SUSPENDED_USER = '99999999-9999-4999-8999-000000000004';
const PENDING_USER = '99999999-9999-4999-8999-000000000005';
const OTHER_CLUB = '00000000-0000-4000-8000-00000000000b';

const tables: Record<string, Record<string, unknown>[]> = {
  clubs: [{ id: CLUB, slug: 'alpha', name: 'Alpha FC', is_active: true }],
  club_payment_settings: [{ club_id: CLUB, currency: 'AUD' }],
  shop_products: [
    { id: SHIRT, club_id: CLUB, name: 'Home shirt', price_cents: 6000, member_price_cents: 4500, sizes: ['M'], is_active: true },
    { id: SCARF, club_id: CLUB, name: 'Scarf', price_cents: 2000, member_price_cents: null, sizes: [], is_active: true },
  ],
  events: [{ id: EVENT, club_id: CLUB, title: 'Gala night', is_public: true, ticket_price_cents: 3000, ticket_member_price_cents: 2000, start_time: new Date(Date.now() + 7 * 864e5).toISOString(), end_time: null }],
  membership_plans: [{ id: PLAN, club_id: CLUB, name: 'U10', price_cents: 9000, is_active: true }],
  sponsorship_packages: [
    { id: PKG, club_id: CLUB, name: 'Gold Package', price_cents: 150000, is_active: true },
    // SPP-4: one shirt front to sell
    { id: SHIRT_PKG, club_id: CLUB, name: 'Front of shirt', price_cents: 500000, is_active: true, max_sponsors: 1 },
  ],
  sponsors: [
    { id: NEW_SPONSOR, club_id: CLUB, name: 'Kelly Bakery', contact_name: 'Sam', contact_email: 'sam@x.test', package_status: 'prospect', access_key: 'b'.repeat(64) },
    { id: LIVE_SPONSOR, club_id: CLUB, name: 'Acme Plumbing', contact_name: 'Dan', contact_email: 'dan@x.test', package_status: 'paid', access_key: KEY, ends_on: inDays(20) },
    { id: PAID_SPONSOR, club_id: CLUB, name: 'Corner Cafe', contact_name: 'Kim', contact_email: 'kim@x.test', package_status: 'paid', access_key: 'c'.repeat(64), ends_on: inDays(300) },
    { id: ENDED_SPONSOR, club_id: CLUB, name: 'Old Mill', contact_name: 'Jo', contact_email: 'jo@x.test', package_status: 'expired', access_key: 'd'.repeat(64), ends_on: null },
    { id: BANK_SPONSOR, club_id: CLUB, name: 'Bay Bakery', contact_name: 'Pat', contact_email: 'pat@x.test', package_status: 'prospect', access_key: 'e'.repeat(64) },
    { id: INVOICED_SPONSOR, club_id: CLUB, name: 'Hills Hardware', contact_name: 'Lee', contact_email: 'lee@x.test', package_status: 'paid', access_key: 'f'.repeat(64), ends_on: inDays(300) },
    { id: SHIRT_HOLDER, club_id: CLUB, name: 'Big Builders', contact_name: 'Bo', contact_email: 'bo@x.test', package_status: 'paid', access_key: '1'.repeat(64), ends_on: inDays(30), package_id: SHIRT_PKG, is_active: true },
    { id: SHIRT_WANTER, club_id: CLUB, name: 'Late Larry', contact_name: 'Larry', contact_email: 'l@x.test', package_status: 'prospect', access_key: '2'.repeat(64), package_id: SHIRT_PKG, created_at: new Date(Date.now() - 5 * 864e5).toISOString() },
  ],
  payments: [
    { id: 'p1', sponsor_id: BANK_SPONSOR, kind: 'sponsorship', status: 'awaiting_review' },
    // SPP-2: an invoice the club sent for next year, before the renewal window opens
    { id: 'p2', club_id: CLUB, sponsor_id: INVOICED_SPONSOR, package_id: PKG, kind: 'sponsorship', status: 'pending', due_on: inDays(14), amount_cents: 120000, currency: 'AUD', description: 'Gold Package renewal (Hills Hardware)', created_at: new Date().toISOString() },
  ],
  club_members: [
    { id: KID, club_id: CLUB, user_id: null, full_name: 'Kid One', email: '', guardian_name: 'Pat Parent', guardian_email: 'Pat@X.test', membership_status: 'approved' },
    { id: ADULT, club_id: CLUB, user_id: ADULT_USER, full_name: 'Al Adult', email: 'al@x.test', guardian_name: null, guardian_email: null, membership_status: 'approved' },
    { id: 'm-exp', club_id: CLUB, user_id: EXPIRED_USER, guardian_email: null, membership_status: 'approved', status: 'active', membership_expires_at: inDays(-1) },
    { id: 'm-sus', club_id: CLUB, user_id: SUSPENDED_USER, guardian_email: null, membership_status: 'approved', status: 'suspended', membership_expires_at: null },
    { id: 'm-pen', club_id: CLUB, user_id: PENDING_USER, guardian_email: null, membership_status: 'pending', status: 'active', membership_expires_at: null },
    // A member of another club only
    { id: 'm-oth', club_id: OTHER_CLUB, user_id: PARENT_USER, guardian_email: null, membership_status: 'approved', status: 'active', membership_expires_at: null },
  ],
};

// Just enough of the query builder for preparePayment: select / eq / in / not null / maybeSingle, or awaited for every row
function fakeDb(): SupabaseClient {
  const from = (table: string) => {
    const filters: ((r: Record<string, unknown>) => boolean)[] = [];
    const rows = () => (tables[table] || []).filter(r => filters.every(f => f(r)));
    const q = {
      select: () => q,
      eq: (col: string, val: unknown) => { filters.push(r => r[col] === val); return q; },
      in: (col: string, vals: unknown[]) => { filters.push(r => vals.includes(r[col])); return q; },
      // Only used with a plain address (no wildcards): equal, ignoring case
      ilike: (col: string, val: string) => { filters.push(r => String(r[col] ?? '').toLowerCase() === val.toLowerCase()); return q; },
      not: (col: string) => { filters.push(r => r[col] != null); return q; },
      order: () => q,
      limit: () => q,
      maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
      then: (resolve: (v: { data: unknown[]; error: null }) => unknown) => resolve({ data: rows(), error: null }),
    };
    return q;
  };
  // tickets_left: no capacity limit
  const rpc = async () => ({ data: null, error: null });
  return { from, rpc } as unknown as SupabaseClient;
}

const input = (memberId: string, kind = 'membership_renewal') =>
  readPaymentInput(k => ({ clubId: CLUB, kind, memberId, planId: PLAN } as Record<string, unknown>)[k]);

async function main() {
  const db = fakeDb();

  // The guardian renews for the child, matched on their confirmed email (any case)
  const byParent = await preparePayment(db, input(KID), PARENT_USER, 'pat@x.test');
  assert.ok(byParent.ok, 'guardian can renew their child');
  if (byParent.ok) {
    assert.equal(byParent.draft.row.payer_name, 'Pat Parent', 'guardian is the payer');
    assert.equal(byParent.draft.row.payer_email, 'pat@x.test', 'receipt goes to the guardian');
    assert.equal(byParent.draft.row.member_id, KID);
  }

  // Anyone else, signed in or not, cannot
  const stranger = await preparePayment(db, input(KID), ADULT_USER, 'al@x.test');
  assert.ok(!stranger.ok && stranger.status === 403, 'another account cannot renew the child');
  const anonymous = await preparePayment(db, input(KID), null, null);
  assert.ok(!anonymous.ok && anonymous.status === 403, 'signed out cannot renew');
  const noEmail = await preparePayment(db, input(KID), PARENT_USER, null);
  assert.ok(!noEmail.ok, 'unconfirmed email (none passed) cannot renew');

  // Adults renew themselves exactly as before
  const self = await preparePayment(db, input(ADULT), ADULT_USER, 'al@x.test');
  assert.ok(self.ok && self.draft.row.payer_email === 'al@x.test' && self.draft.row.payer_name === 'Al Adult', 'member renews themselves');
  const otherAdult = await preparePayment(db, input(ADULT), PARENT_USER, 'pat@x.test');
  assert.ok(!otherAdult.ok, 'a guardian email does not unlock members they are not guardian of');

  // Sponsorships: a new sign-up pays with its id; renewing an existing one needs the link's key
  const sponsorPay = (sponsorId: string, sponsorKey?: string) => preparePayment(db,
    readPaymentInput(k => ({ clubId: CLUB, kind: 'sponsorship', sponsorId, packageId: PKG, sponsorKey } as Record<string, unknown>)[k]));
  const fresh = await sponsorPay(NEW_SPONSOR);
  assert.ok(fresh.ok && fresh.draft.row.description === 'Gold Package (Kelly Bakery)', 'a new sign-up pays');
  const noKey = await sponsorPay(LIVE_SPONSOR);
  assert.ok(!noKey.ok && noKey.status === 409, 'a public sponsor id alone cannot pay to renew');
  const wrongKey = await sponsorPay(LIVE_SPONSOR, 'b'.repeat(64));
  assert.ok(!wrongKey.ok && wrongKey.status === 409, "another sponsor's key does not renew this one");
  const badKey = await sponsorPay(LIVE_SPONSOR, 'not-a-key');
  assert.ok(!badKey.ok, 'a malformed key is ignored');
  const renewal = await sponsorPay(LIVE_SPONSOR, KEY);
  assert.ok(renewal.ok && renewal.draft.row.description === 'Gold Package renewal (Acme Plumbing)' && renewal.draft.row.amount_cents === 150000, 'the renewal link pays');

  // SPE-1: the key only renews when a renewal is due, so an old link can't take a second payment
  const early = await sponsorPay(PAID_SPONSOR, 'c'.repeat(64));
  assert.ok(!early.ok && early.status === 409 && /already paid/.test(early.error), 'a sponsor who paid this term cannot pay again through an old link');
  const ended = await sponsorPay(ENDED_SPONSOR, 'd'.repeat(64));
  assert.ok(ended.ok, 'an ended sponsorship can be renewed through its link');
  const waiting = await sponsorPay(BANK_SPONSOR);
  assert.ok(!waiting.ok && waiting.status === 409 && /receipt/.test(waiting.error), 'no card payment while a bank transfer receipt waits to be checked');

  // SPP-2: an open invoice from the club is payable, with its own amount, and paid on the same row
  const invoiced = await sponsorPay(INVOICED_SPONSOR, 'f'.repeat(64));
  assert.ok(invoiced.ok && invoiced.draft.invoiceId === 'p2' && invoiced.draft.row.amount_cents === 120000, 'an invoice sent before the renewal window can be paid, for the invoiced amount');
  const invoicedNoKey = await sponsorPay(INVOICED_SPONSOR);
  assert.ok(!invoicedNoKey.ok, 'paying an existing sponsor\'s invoice still needs their key');
  assert.ok(fresh.ok && !fresh.draft.invoiceId, 'no invoice, a new payment row');

  // SPP-4: the one shirt front is taken by a paid sponsor, so a new sign-up can't buy it; the holder can renew
  const shirtPay = (sponsorId: string, sponsorKey?: string) => preparePayment(db,
    readPaymentInput(k => ({ clubId: CLUB, kind: 'sponsorship', sponsorId, packageId: SHIRT_PKG, sponsorKey } as Record<string, unknown>)[k]));
  const taken = await shirtPay(SHIRT_WANTER);
  assert.ok(!taken.ok && taken.status === 409 && /taken/.test(taken.error), 'a sold-out package cannot be paid for (their 48-hour hold ran out)');
  const holderRenews = await shirtPay(SHIRT_HOLDER, '1'.repeat(64));
  assert.ok(holderRenews.ok, 'the sponsor holding the package renews it');

  // Member prices: only a signed-in active member of this club (or a guardian of one) pays them
  const shop = (userId: string | null, email: string | null) => preparePayment(db, readPaymentInput(k => ({
    clubId: CLUB, kind: 'shop_order', buyerName: 'Buyer', buyerEmail: 'b@x.test',
    items: JSON.stringify([{ productId: SHIRT, size: 'M', quantity: 2 }, { productId: SCARF, size: '', quantity: 1 }]),
  } as Record<string, unknown>)[k]), userId, email);
  const tickets = (userId: string | null, email: string | null) => preparePayment(db, readPaymentInput(k => ({
    clubId: CLUB, kind: 'event_ticket', eventId: EVENT, quantity: 3, buyerName: 'Buyer', buyerEmail: 'b@x.test',
  } as Record<string, unknown>)[k]), userId, email);
  const amount = (r: Awaited<ReturnType<typeof preparePayment>>) => (r.ok ? r.draft.row.amount_cents : `error: ${r.error}`);
  const units = (r: Awaited<ReturnType<typeof preparePayment>>) => (r.ok ? r.draft.lines?.map(l => l.unit_cents) : []);

  // Member: shirt at 45.00 (x2), scarf has no member price so 20.00; tickets 20.00 x3
  assert.equal(amount(await shop(ADULT_USER, 'al@x.test')), 2 * 4500 + 2000, 'member pays member prices in the shop');
  assert.deepEqual(units(await shop(ADULT_USER, 'al@x.test')), [4500, 2000], 'lines carry the price charged; blank member price = full price');
  assert.equal(amount(await tickets(ADULT_USER, 'al@x.test')), 3 * 2000, 'member pays the member ticket price');
  // Guardian of an active child, matched on their confirmed email whatever its case
  assert.equal(amount(await shop(PARENT_USER, 'PAT@x.test')), 2 * 4500 + 2000, "a child's guardian pays member prices");
  assert.equal(amount(await tickets(null, 'pat@x.test')), 3 * 2000, 'guardian matched on email alone');
  // Everyone else pays full price
  for (const [who, userId, email] of [
    ['signed out', null, null], ['expired member', EXPIRED_USER, 'e@x.test'], ['suspended member', SUSPENDED_USER, 's@x.test'],
    ['pending applicant', PENDING_USER, 'p@x.test'], ["another club's member", PARENT_USER, 'nobody@x.test'],
  ] as const) {
    assert.equal(amount(await shop(userId, email)), 2 * 6000 + 2000, `${who} pays full shop prices`);
    assert.equal(amount(await tickets(userId, email)), 3 * 3000, `${who} pays the full ticket price`);
  }
  // A buyer email typed into the form is not a sign-in: a guardian's address, signed out, pays full price
  const typedEmail = await preparePayment(db, readPaymentInput(k => ({
    clubId: CLUB, kind: 'shop_order', buyerName: 'Pat', buyerEmail: 'pat@x.test', items: JSON.stringify([{ productId: SHIRT, size: 'M', quantity: 1 }]),
  } as Record<string, unknown>)[k]), null, null);
  assert.equal(amount(typedEmail), 6000, 'the typed buyer email never unlocks member prices');

  console.log('payments-server: renewal by member or guardian, sponsorship sign-up and renewal, invoices, package limits and member prices OK');
}

main().catch(e => { console.error(e); process.exit(1); });
