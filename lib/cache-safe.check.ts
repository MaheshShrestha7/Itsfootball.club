// Self-check for what the browser cache may hold.
// Run: npx esbuild lib/cache-safe.check.ts --bundle --platform=node --log-level=warning | node
import assert from 'node:assert/strict';
import { cacheSafeMembers, cacheSafeSponsors, PRIVATE_MEMBER_FIELDS, PRIVATE_SPONSOR_FIELDS } from './cache-safe';

const saved = { id: 'a', full_name: 'Mia Lee', jersey_number: 7, email: 'mia@x.com', phone: '0400', date_of_birth: '2014-02-01',
  medical_notes: 'Asthma', emergency_contact: 'Sam 0400', qr_code_token: 'pass_abc', guardian_email: 'sam@x.com' };
const pending = { id: 'b', full_name: 'New Player', email: 'new@x.com' };
const [a, b] = cacheSafeMembers<Record<string, unknown> & { id: string }>([saved, pending], ['a']);
assert.equal(a.full_name, 'Mia Lee');
assert.equal(a.jersey_number, 7);
for (const f of PRIVATE_MEMBER_FIELDS) assert.equal(f in a, false, `${f} must not be cached`);
assert.equal(b.email, 'new@x.com', 'a member not yet saved keeps their details until it is');
assert.equal(saved.email, 'mia@x.com', 'the live copy is untouched');

const sp = { id: 's1', name: 'Harbour Physio', tier: 'gold', contact_name: 'Jo', contact_email: 'jo@physio.test', contact_phone: '0411' };
const spNew = { id: 's2', name: 'New Cafe', contact_email: 'cafe@x.test' };
const [s1, s2] = cacheSafeSponsors<Record<string, unknown> & { id: string }>([sp, spNew], ['s1']);
assert.equal(s1.name, 'Harbour Physio');
for (const f of PRIVATE_SPONSOR_FIELDS) assert.equal(f in s1, false, `sponsor ${f} must not be cached`);
assert.equal(s2.contact_email, 'cafe@x.test', 'a sponsor not yet saved keeps its details until it is');
assert.equal(sp.contact_email, 'jo@physio.test', 'the live sponsor is untouched');
console.log('cache-safe: ok');
