import assert from 'node:assert/strict';
import { sponsorGroups, headerSponsors, titleSponsor, moveSponsor, normaliseWebsite, defaultPlacement, categoryLabel, TournamentSponsor } from './tournament-sponsors';

const s = (id: string, category: string, display_order: number, placement: 'title' | 'header' | 'list' = 'list', is_active = true): TournamentSponsor =>
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
assert.equal(titleSponsor(list), undefined);
const withTitle = [...list, s('main', 'platinum', 9, 'title')];
assert.equal(titleSponsor(withTitle)!.id, 'main');
assert.ok(!headerSponsors(withTitle).some(x => x.id === 'main'), 'the main sponsor is not repeated in the strip');
assert.ok(sponsorGroups(withTitle)[0].sponsors.some(x => x.id === 'main'), 'but it is in the list');
console.log('tournament-sponsors.check: ok');
