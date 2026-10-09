// Self-check for admin access levels, and that the database migration only uses known area keys.
// Run (from the repo root): npx esbuild lib/permissions.check.ts --bundle --platform=node --log-level=warning | node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ACCESS_AREAS, areaFromPath, levelAtLeast, memberLabels } from './permissions';

assert.ok(levelAtLeast('full', 'edit'));
assert.ok(levelAtLeast('edit', 'edit'));
assert.ok(levelAtLeast('view'));
assert.ok(!levelAtLeast('view', 'edit'));
assert.ok(!levelAtLeast(undefined));
assert.ok(!levelAtLeast('owner'));

assert.equal(areaFromPath('/fc-united/admin'), null);
assert.equal(areaFromPath('/fc-united/admin/finance'), 'finance');
assert.equal(areaFromPath('/fc-united/admin/lineup/draft'), 'lineup');
assert.equal(areaFromPath('/fc-united/admin/tournaments/abc'), 'tournaments');

assert.deepEqual(memberLabels('Player, treasurer', ['Treasurer', 'Secretary']), ['Treasurer', 'Secretary', 'Player']);
assert.deepEqual(memberLabels(null, null), []);

// Every area the migration grants or checks must be one the roles editor can show
const known = new Set(ACCESS_AREAS.map(a => a.key));
const sql = ['20261023_access_roles.sql', '20261024_shop_orders_area.sql']
  .map(f => readFileSync(`supabase/migrations/${f}`, 'utf8'))
  .join('\n');
const seeded = [...sql.matchAll(/"([a-z-]+)":"(?:view|edit|full)"/g)].map(m => m[1]);
const checked = [...sql.matchAll(/'\{([a-z,-]+)\}'/g)].flatMap(m => m[1].split(','));
assert.ok(seeded.length > 50 && checked.length > 50, 'migration areas not found');
for (const key of [...seeded, ...checked]) assert.ok(known.has(key), `unknown area in migration: ${key}`);

console.log('permissions: levels, admin paths and migration area keys OK');
