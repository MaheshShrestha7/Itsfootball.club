import assert from 'node:assert/strict';
import { newClubRow } from './new-club';

const ids = { id: 'c1', ownerId: 'u1' };
const ok = newClubRow({ name: ' Riverside <Rovers> FC ', primary_color: '#0369a1', secondary_color: 'red', owner_email: 'Jo@Club.com.au' }, ids);
assert.ok('row' in ok);
if ('row' in ok) {
  assert.equal(ok.row.name, 'Riverside Rovers FC');
  assert.equal(ok.row.slug, 'riverside-rovers-fc');
  assert.equal(ok.row.owner_id, 'u1');
  assert.equal(ok.row.primary_color, '#0369A1');
  assert.equal(ok.row.secondary_color, '#0F172A'); // not a hex colour: default
  assert.equal(ok.row.contact_email, ''); // optional
  assert.equal(ok.ownerEmail, 'jo@club.com.au');
  assert.equal((ok.row.config as { theme: { primaryColor: string } }).theme.primaryColor, '#0369A1');
}
assert.deepEqual(newClubRow({ name: 'X' }, ids), { error: 'Type the club’s name.' });
assert.ok('error' in newClubRow({ name: 'Club', slug: 'admin' }, ids));
assert.ok('error' in newClubRow({ name: 'Club', contact_email: 'nope' }, ids));
assert.ok('error' in newClubRow({ name: 'Club', owner_email: 'jo@' }, ids));
const logo = newClubRow({ name: 'Club FC', logo_url: 'javascript:alert(1)' }, ids);
assert.ok('row' in logo && logo.row.logo_url !== 'javascript:alert(1)');
console.log('new-club checks passed');
