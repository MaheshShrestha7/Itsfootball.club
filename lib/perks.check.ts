// Self-check for member perks.
// Run: npx esbuild lib/perks.check.ts --bundle --platform=node --log-level=warning | node
import assert from 'node:assert/strict';
import { perkBusiness, perkHiddenReason } from './perks';

const now = new Date(2026, 9, 31, 12).getTime(); // 31 Oct 2026, local time
const live = { id: 's1', is_active: true, package_status: 'paid' as const, ends_on: null };
const ended = { id: 's2', is_active: true, package_status: 'paid' as const, ends_on: '2026-10-30' };
const switchedOff = { id: 's3', is_active: false, package_status: 'paid' as const, ends_on: null };
const sponsors = [live, ended, switchedOff];
const perk = { id: 'p', club_id: 'c', title: '10% off', sort_order: 0, is_active: true };

assert.equal(perkHiddenReason(perk, sponsors, now), null); // no sponsor
assert.equal(perkHiddenReason({ ...perk, sponsor_id: 's1' }, sponsors, now), null);
assert.equal(perkHiddenReason({ ...perk, ends_on: '2026-10-31' }, sponsors, now), null); // shows to the end of its last day
assert.equal(perkHiddenReason({ ...perk, ends_on: '2026-10-30' }, sponsors, now), 'Ended');
assert.equal(perkHiddenReason({ ...perk, is_active: false }, sponsors, now), 'Hidden');
assert.equal(perkHiddenReason({ ...perk, sponsor_id: 's2' }, sponsors, now), 'Hidden: the sponsor is off the site'); // sponsor past ends_on
assert.equal(perkHiddenReason({ ...perk, sponsor_id: 's3' }, sponsors, now), 'Hidden: the sponsor is off the site'); // sponsor switched off
assert.equal(perkHiddenReason({ ...perk, sponsor_id: 'gone' }, sponsors, now), 'Hidden: the sponsor is off the site'); // sponsor deleted

assert.equal(perkBusiness({ business_name: " Joe's Pizza " }, 'Eastside FC'), "Joe's Pizza");
assert.equal(perkBusiness({ business_name: '' }, 'Eastside FC'), 'Eastside FC');
assert.equal(perkBusiness({}, 'Eastside FC'), 'Eastside FC');

console.log('perks.check: ok');
