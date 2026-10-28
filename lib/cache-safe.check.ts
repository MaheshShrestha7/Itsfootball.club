// Self-check for what the browser cache may hold.
// Run: npx esbuild lib/cache-safe.check.ts --bundle --platform=node --log-level=warning | node
import assert from 'node:assert/strict';
import { cacheSafeMembers, PRIVATE_MEMBER_FIELDS } from './cache-safe';

const saved = { id: 'a', full_name: 'Mia Lee', jersey_number: 7, email: 'mia@x.com', phone: '0400', date_of_birth: '2014-02-01',
  medical_notes: 'Asthma', emergency_contact: 'Sam 0400', qr_code_token: 'pass_abc', guardian_email: 'sam@x.com' };
const pending = { id: 'b', full_name: 'New Player', email: 'new@x.com' };
const [a, b] = cacheSafeMembers<Record<string, unknown> & { id: string }>([saved, pending], ['a']);
assert.equal(a.full_name, 'Mia Lee');
assert.equal(a.jersey_number, 7);
for (const f of PRIVATE_MEMBER_FIELDS) assert.equal(f in a, false, `${f} must not be cached`);
assert.equal(b.email, 'new@x.com', 'a member not yet saved keeps their details until it is');
assert.equal(saved.email, 'mia@x.com', 'the live copy is untouched');
console.log('cache-safe: ok');
