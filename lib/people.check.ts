// Self-check for the admin People page helpers.
// Run: npx esbuild lib/people.check.ts --bundle --platform=node --log-level=warning | node
import assert from 'node:assert/strict';
import type { ClubMember } from './supabase/types';
import { ageOn, inGroup, isStaff, matchesSearch, membershipInfo, personChecks, personRoles } from './people';

const today = new Date(2026, 9, 24); // 24 Oct 2026
const person = (p: Partial<ClubMember>): ClubMember => ({
  id: 'x', club_id: 'c', full_name: 'Sam Striker', email: 'sam@example.com', role: 'Player', status: 'active',
  qr_code_token: 't', membership_tier: 'Senior', membership_expires_at: '2027-03-14', is_executive: false, ...p,
} as ClubMember);

assert.equal(ageOn('2015-10-25', today), 10);
assert.equal(ageOn('2015-10-24', today), 11);
assert.equal(ageOn('nope', today), null);

assert.deepEqual(membershipInfo(person({}), today), { state: 'active', expires: '2027-03-14' });
assert.deepEqual(membershipInfo(person({ membership_expires_at: '2026-11-05' }), today), { state: 'expiring', days: 12, expires: '2026-11-05' });
assert.deepEqual(membershipInfo(person({ membership_expires_at: '2026-10-20' }), today), { state: 'expired', days: 4, expires: '2026-10-20' });
assert.equal(membershipInfo(person({ membership_status: 'pending' }), today).state, 'pending');
assert.equal(membershipInfo(person({ membership_expires_at: '' }), today).state, 'active');

assert.deepEqual(personRoles(person({ role: '' as never, roles: [] })), ['Player']);
assert.deepEqual(personRoles(person({ role: 'Player, Treasurer' as never })), ['Player', 'Treasurer']);
assert.equal(isStaff(person({ roles: ['Player'] })), false);
assert.equal(isStaff(person({ roles: ['Coach'] })), true);
assert.equal(isStaff(person({ is_executive: true })), true);
assert.equal(inGroup('supporters', person({ role: 'supporter' as never }), false, today), true);
assert.equal(inGroup('players', person({ role: 'supporter' as never }), false, today), false);

// Checks: background check dates, and for juniors consent and contacts
assert.deepEqual(personChecks(person({ safeguarding_check_type: 'WWCC', safeguarding_check_expiry_date: '2026-11-03' }), false, today).map(c => c.text), ['WWCC expires in 10 days']);
assert.deepEqual(personChecks(person({ safeguarding_check_expiry_date: '2026-10-01' }), false, today).map(c => c.urgent), [true]);
assert.deepEqual(personChecks(person({}), true, today).map(c => c.kind), ['photo', 'guardian', 'emergency']);
assert.deepEqual(personChecks(person({ photo_consent: false, guardian_phone: '0400' }), true, today), []);
assert.equal(inGroup('attention', person({}), false, today), false);
assert.equal(inGroup('attention', person({ membership_expires_at: '2026-11-01' }), false, today), true);

assert.equal(matchesSearch(person({ jersey_number: 9 }), '#9'), true);
assert.equal(matchesSearch(person({ guardian_email: 'gina@example.com' }), 'gina'), true);
assert.equal(matchesSearch(person({}), 'zzz'), false);

console.log('people checks passed');
