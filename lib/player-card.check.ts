// Run with `npm run check`: the auto rating matches the worked examples on the tool pages and in
// llms.txt, stays between 45 and 95, and only counts clean sheets for keepers and defenders. The card type
// labels and the Levelled Up rise read as the tool pages describe.
import assert from 'node:assert/strict';
import { CARD_TYPES, POSITIONS, autoRating, cardLabel, storyHeading, upgradeBy } from './player-card';

// The striker on /tools/player-card-maker: 55 + 9.8 + 4 + 2.7 + 9.5 + 3.5 = 84.5, shown as 85
assert.equal(autoRating({ goals: 18, assists: 11, apps: 22, motm: 6, att: 95, streak: 14 }, 'LM'), 85);
// The example cards in public/images/tools
assert.equal(autoRating({ goals: 21, assists: 8, apps: 20, motm: 5, streak: 16, att: 95 }, 'ST'), 87);
assert.equal(autoRating({ cs: 9, saves: 41, apps: 19, motm: 3, streak: 8, att: 86 }, 'GK'), 74);
assert.equal(autoRating({ goals: 7, assists: 12, apps: 18, motm: 4, streak: 18, att: 100 }, 'CM'), 82);

// No games played: only attendance counts; nothing at all: 55
assert.equal(autoRating({}, 'ST'), 55);
assert.equal(autoRating({ goals: 5 }, 'ST'), 55);

// Clean sheets count for a centre-back, not for a striker
assert.ok(autoRating({ cs: 10, apps: 10 }, 'CB') > autoRating({ cs: 10, apps: 10 }, 'ST'));

// Card type labels: none on Standard, the detail after the type, and the rise on Levelled Up
assert.equal(new Set(CARD_TYPES.map(t => t.key)).size, CARD_TYPES.length);
assert.equal(cardLabel({ type: 'standard', detail: 'x', rating: 80 }), '');
assert.equal(cardLabel({ rating: 80 }), '');
assert.equal(cardLabel({ type: 'totw', detail: ' Round 7 ', rating: 86 }), 'Team of the Week · Round 7');
assert.equal(cardLabel({ type: 'potm', detail: '', rating: 88 }), 'Player of the Month');
assert.equal(cardLabel({ type: 'upgrade', detail: '81', rating: 85 }), 'Levelled Up · was 81');
assert.equal(upgradeBy({ type: 'upgrade', detail: '81', rating: 85 }), 4);
// No rise to show: the rating before was the same or higher, or isn't a number
assert.equal(cardLabel({ type: 'upgrade', detail: '85', rating: 85 }), 'Levelled Up');
assert.equal(upgradeBy({ type: 'upgrade', detail: '90', rating: 85 }), 0);
assert.equal(upgradeBy({ type: 'upgrade', detail: 'abc', rating: 85 }), 0);
assert.equal(upgradeBy({ type: 'totw', detail: '81', rating: 85 }), 0);

// The player's own wording replaces the type's name, and the story heading follows it unless set
assert.equal(cardLabel({ type: 'legend', labelText: ' Legend ', detail: '300 games', rating: 91 }), 'Legend · 300 games');
assert.equal(cardLabel({ type: 'legend', labelText: '  ', rating: 91 }), 'Club Legend');
assert.equal(cardLabel({ type: 'standard', labelText: 'Legend', rating: 91 }), '');
assert.equal(storyHeading({ type: 'legend' }), 'Club Legend');
assert.equal(storyHeading({ type: 'legend', labelText: 'Legend' }), 'Legend');
assert.equal(storyHeading({ type: 'legend', labelText: 'Legend', heading: 'Thank you, Mahesh' }), 'Thank you, Mahesh');
assert.equal(storyHeading({ type: 'standard' }), 'Player card');
assert.equal(storyHeading({ type: 'standard', heading: 'Captain' }), 'Captain');

let cases = 0;
for (const position of POSITIONS) {
  for (const apps of [0, 1, 5, 20]) {
    for (const goals of [0, 3, 40, 999]) {
      const r = autoRating({ goals, assists: goals, apps, motm: apps, cs: apps, saves: goals, att: 100, streak: 999 }, position);
      assert.ok(Number.isInteger(r) && r >= 45 && r <= 95, `${position} ${apps} ${goals}: ${r}`);
      cases++;
    }
  }
}
console.log(`player-card: ok (${cases} rating cases)`);
