// npm run check: who sees which welcome-pack steps, and what ticks them off
import assert from 'node:assert/strict';
import { factsFrom, laterFor, packFor, packProgress } from './welcome-pack';

const keys = (v: Parameters<typeof packFor>[0]) => packFor(v).flatMap(g => g.steps.map(s => s.key));

assert.equal(keys({ isSuper: true, areas: {} }).length, 11);
assert.equal(laterFor({ isSuper: true, areas: {} }).length, 5);
// Treasurer: the money steps (edit or more) and sharing the link; never roles
assert.deepEqual(keys({ isSuper: false, areas: { finance: 'full', squad: 'view', seasons: 'view' } }), ['plans', 'stripe', 'share']);
// View only is not enough
assert.deepEqual(keys({ isSuper: false, areas: { teams: 'view', matches: 'view' } }), ['share']);
// Manager
assert.deepEqual(
  keys({ isSuper: false, areas: { teams: 'full', squad: 'edit', matches: 'full', availability: 'full', lineup: 'full', seasons: 'view' } }),
  ['teams', 'players', 'fixture', 'availability', 'lineup', 'share'],
);
// Empty groups are dropped
assert.deepEqual(packFor({ isSuper: false, areas: { finance: 'edit' } }).map(g => g.key), ['people', 'share']);

const facts = factsFrom({
  logoUrl: 'x.png', seasons: 1, teams: 1, teamMembers: 0, plans: 0, stripe: false, fixtures: 0,
  members: [{ role: 'Player, Treasurer' }, { roles: ['Manager'], applied_at: '2026-01-01' }],
  helperRoles: ['Treasurer'],
});
assert.deepEqual(facts, { logo: true, season: true, teams: false, plans: false, stripe: false, players: true, fixture: false, shared: true, helper: true });
const all = packFor({ isSuper: true, areas: {} });
const p = packProgress(all, facts, new Set(['availability']));
assert.equal(p.done, 6); // logo, season, players, share, helper + availability by hand
assert.equal(p.next?.key, 'teams');
// A hand tick doesn't count for a step that only ticks itself off
assert.equal(packProgress(all, facts, new Set(['teams'])).done, 5);
console.log('welcome-pack: role packs, facts and progress OK');
