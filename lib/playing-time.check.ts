// Run with `npm run check`: every plan across formats, squads, match lengths and keeper modes keeps the
// right number of players on the pitch, never has a player in two places, and shares the minutes fairly.
import assert from 'node:assert/strict';
import { planRotation, type KeeperMode } from './playing-time';

const modes: KeeperMode[] = ['fixed', 'per-period', 'rolling'];
let plans = 0;
const started = Date.now();
for (const onField of [4, 5, 6, 7, 8, 9, 11]) {
  for (let squad = onField; squad <= onField + 9; squad++) {
    for (const [periods, periodMinutes] of [[2, 20], [2, 25], [2, 30], [4, 10], [4, 12], [1, 40], [2, 45], [3, 15]]) {
      for (const keeper of modes) {
        for (const unit of [60, 1]) {
          if (unit === 1 && squad % 3) continue;
          const plan = planRotation({ onField, periods, periodMinutes, squad, keeper, unit });
          const label = JSON.stringify({ onField, squad, periods, periodMinutes, keeper, unit });
          assert.ok(plan.ok, label);
          plans++;
          for (let t = 0; t < plan.total; t += 15) {
            const on = plan.stints.filter(s => s.start <= t && s.end > t);
            assert.equal(on.length, onField, `${label} players on at ${t}s`);
            assert.equal(new Set(on.map(s => s.player)).size, onField, `${label} player twice at ${t}s`);
            assert.ok(on.filter(s => s.keeper).length <= 1, `${label} two keepers at ${t}s`);
          }
          // Everyone who rotates gets the same time, give or take one rounding unit (two with a keeper per period)
          const keepers = new Set(plan.keeperByPeriod.filter((k): k is number => k != null));
          const rotating = plan.seconds.filter((_, i) => !(keeper === 'fixed' && i === 0) && !(keeper === 'per-period' && keepers.has(i) && plan.target < periodMinutes * 60));
          const spread = Math.max(...rotating) - Math.min(...rotating);
          assert.ok(spread <= unit * 2, `${label} spread ${spread}s`);
          assert.equal(plan.seconds.reduce((a, b) => a + b, 0), onField * plan.total, `${label} total`);
          for (const c of plan.changes) for (const s of c.swaps) assert.notEqual(s.off, s.on, label);
        }
      }
    }
  }
}
assert.equal(planRotation({ onField: 9, periods: 2, periodMinutes: 30, squad: 8, keeper: 'fixed' }).ok, false);
// The worked example on the 9-a-side page: 13 players, two 30-minute halves, fixed keeper → 40 minutes each, three stoppages
const nine = planRotation({ onField: 9, periods: 2, periodMinutes: 30, squad: 13, keeper: 'fixed' });
assert.deepEqual(nine.seconds.slice(1), Array(12).fill(40 * 60));
assert.equal(nine.changes.length, 3);
// Slowest case stays quick enough for a phone
const t0 = Date.now();
planRotation({ onField: 11, periods: 4, periodMinutes: 20, squad: 25, keeper: 'per-period', keepers: [0, 1, 2, 3] });
assert.ok(Date.now() - t0 < 1500, `slow: ${Date.now() - t0}ms`);
console.log(`playing-time: ${plans} plans ok in ${Date.now() - started}ms`);
