// Run with `npm run check`: the auto rating matches the worked examples on the tool pages and in
// llms.txt, stays between 45 and 95, and only counts clean sheets for keepers and defenders.
import assert from 'node:assert/strict';
import { POSITIONS, autoRating } from './player-card';

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
