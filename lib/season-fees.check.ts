// Run with `npm run check`: the break-even fee covers the season, the card price nets at least the
// break-even fee after the card fee (and a cent less would not), and the cash price covers the non-payers.
import assert from 'node:assert/strict';
import { CARD_PRESETS, EXAMPLE_COSTS, EXAMPLE_INCOME, EXAMPLE_PLAYERS, cardFeeCents, grossUpCents, money, seasonBudget } from './season-fees';

let cases = 0;
for (const card of CARD_PRESETS) {
  for (let net = 1; net <= 100000; net += 37) {
    const gross = grossUpCents(net, card);
    assert.ok(gross - cardFeeCents(gross, card) >= net, `covers ${net}`);
    assert.ok(gross - 1 - cardFeeCents(gross - 1, card) < net, `smallest for ${net}`);
    cases++;
  }
}

for (let players = 1; players <= 60; players++) {
  for (const unpaidPercent of [0, 5, 10, 25]) {
    for (const incomeCents of [0, 100000, 9_000_000]) {
      const b = seasonBudget({ costs: EXAMPLE_COSTS, players, incomeCents, bufferPercent: 5, card: CARD_PRESETS[0], unpaidPercent, feeCents: null });
      assert.ok(b.ok);
      assert.ok(b.breakEvenCents * players >= b.toRaiseCents, 'break-even covers the season');
      assert.ok((b.breakEvenCents - 1) * players < b.toRaiseCents || b.toRaiseCents === 0, 'break-even is the smallest');
      assert.ok(b.cashPriceCents * (players - b.unpaidPlayers) >= b.toRaiseCents, 'cash price covers the non-payers');
      assert.ok(b.suggestedCents >= b.cardPriceCents && b.suggestedCents % 500 === 0);
      assert.ok(b.card.balanceCents >= 0, 'the suggested fee breaks even by card');
      assert.equal(b.card.keptCents + b.card.lostCents, b.card.grossCents);
      assert.equal(b.cash.keptCents + b.cash.lostCents, b.cash.grossCents);
      cases++;
    }
  }
}

// The example season: 18 players
const ex = seasonBudget({ costs: EXAMPLE_COSTS, players: EXAMPLE_PLAYERS, incomeCents: EXAMPLE_INCOME, bufferPercent: 5, card: CARD_PRESETS[0], unpaidPercent: 10, feeCents: null });
assert.equal(ex.costsCents, 320000 + 120000 + 160000 + 16000 * 18 + 45000 + 140000 + 50000 + 15000);
assert.equal(money(123456), '$1,234.56');
assert.equal(money(123456, true), '$1,235');
assert.ok(!seasonBudget({ costs: EXAMPLE_COSTS, players: 0, incomeCents: 0, bufferPercent: 0, card: CARD_PRESETS[0], unpaidPercent: 0, feeCents: null }).ok);
console.log(`season-fees: ${cases} cases ok (example: break-even ${money(ex.breakEvenCents)}, card ${money(ex.cardPriceCents)}, cash ${money(ex.cashPriceCents)}, suggested ${money(ex.suggestedCents)})`);
