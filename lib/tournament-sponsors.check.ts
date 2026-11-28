import assert from 'node:assert/strict';
import { sponsorGroups, headerSponsors, moveSponsor, normaliseWebsite, defaultPlacement, categoryLabel, TournamentSponsor } from './tournament-sponsors';

const s = (id: string, category: string, display_order: number, placement: 'header' | 'list' = 'list', is_active = true): TournamentSponsor =>
  ({ id, tournament_id: 't', name: id, category, placement, display_order, is_active });
const list = [s('food', 'Food partner', 0), s('radio', 'media', 1, 'header'), s('gold2', 'gold', 2, 'header'), s('plat', 'platinum', 3, 'header'), s('gold1', 'gold', 4), s('off', 'gold', 5, 'header', false)];

const groups = sponsorGroups(list);
assert.deepEqual(groups.map(g => g.title), ['Platinum', 'Gold', 'Media partner', 'Food partner'], 'presets in order, own categories last, hidden left out');
assert.deepEqual(groups[1].sponsors.map(x => x.id), ['gold2', 'gold1'], 'host order inside a category');
assert.equal(groups[0].size, 'xl');
assert.deepEqual(headerSponsors(list).map(x => x.id), ['radio', 'gold2', 'plat'], 'header strip in host order, hidden left out');
assert.deepEqual(moveSponsor(list, 'plat', -1), [{ id: 'plat', display_order: 2 }, { id: 'gold2', display_order: 3 }]);
assert.deepEqual(moveSponsor(list, 'food', -1), [], 'first stays first');
assert.equal(normaliseWebsite(' momohouse.com.au '), 'https://momohouse.com.au');
assert.equal(normaliseWebsite('http://a.au'), 'http://a.au');
assert.equal(normaliseWebsite(''), '');
assert.equal(defaultPlacement('gold'), 'header');
assert.equal(defaultPlacement('media'), 'list');
assert.equal(categoryLabel('media'), 'Media partner');
assert.equal(categoryLabel('Food partner'), 'Food partner');
console.log('tournament-sponsors.check: ok');
