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

const tables: Record<string, Record<string, unknown>[]> = {
  clubs: [{ id: CLUB, slug: 'alpha', name: 'Alpha FC', is_active: true }],
  club_payment_settings: [{ club_id: CLUB, currency: 'AUD' }],
  membership_plans: [{ id: PLAN, club_id: CLUB, name: 'U10', price_cents: 9000, is_active: true }],
  club_members: [
    { id: KID, club_id: CLUB, user_id: null, full_name: 'Kid One', email: '', guardian_name: 'Pat Parent', guardian_email: 'Pat@X.test', membership_status: 'approved' },
    { id: ADULT, club_id: CLUB, user_id: ADULT_USER, full_name: 'Al Adult', email: 'al@x.test', guardian_name: null, guardian_email: null, membership_status: 'approved' },
  ],
};

// Just enough of the query builder for preparePayment: select / eq / maybeSingle
function fakeDb(): SupabaseClient {
  const from = (table: string) => {
    const filters: [string, unknown][] = [];
    const q = {
      select: () => q,
      eq: (col: string, val: unknown) => { filters.push([col, val]); return q; },
      maybeSingle: async () => ({ data: (tables[table] || []).find(r => filters.every(([c, v]) => r[c] === v)) ?? null, error: null }),
    };
    return q;
  };
  return { from } as unknown as SupabaseClient;
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

  console.log('payments-server: renewal by member or guardian OK');
}

main().catch(e => { console.error(e); process.exit(1); });
