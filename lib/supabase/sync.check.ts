// Self-check for the sync engine against a fake Supabase client: scoped loading, column-only
// updates and explicit deletes.
// Run: npx esbuild lib/supabase/sync.check.ts --bundle --platform=node --log-level=warning | node
import assert from 'node:assert/strict';
import { SupabaseSync } from './sync';

type Op = { table: string; kind?: string; filters: unknown[][]; rows?: unknown; options?: unknown; patch?: Record<string, unknown> };

function fakeClient(tables: Record<string, unknown[]>, log: Op[]) {
  const from = (table: string) => {
    const op: Op = { table, filters: [] };
    const b: any = {
      select: () => b,
      order: () => b,
      range: () => b,
      in: (c: string, v: unknown) => (op.filters.push(['in', c, v]), b),
      or: (f: string) => (op.filters.push(['or', f]), b),
      eq: (c: string, v: unknown) => (op.filters.push(['eq', c, v]), b),
      upsert: (rows: unknown, options: unknown) => ((op.kind = 'upsert'), (op.rows = rows), (op.options = options), b),
      update: (patch: Record<string, unknown>) => ((op.kind = 'update'), (op.patch = patch), b),
      delete: () => ((op.kind = 'delete'), b),
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
        log.push(op);
        const data = op.kind === 'update' ? [{ id: 'x' }] : op.kind ? null : tables[table] || [];
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      },
    };
    return b;
  };
  return { auth: { getSession: async () => ({ data: { session: { user: {} } } }) }, from } as any;
}

const C1 = '11111111-1111-4111-8111-111111111111';
const C2 = '22222222-2222-4222-8222-222222222222';
const M1 = '33333333-3333-4333-8333-333333333333';

const match = {
  id: M1, club_id: C1, home_team_name: 'A', away_team_name: 'B', match_date: '2026-10-01T15:00:00Z',
  venue: 'Park', status: 'upcoming', home_score: 0, away_score: 0, checkin_count: 5,
};

async function main() {
  const log: Op[] = [];
  const engine = new SupabaseSync(
    fakeClient({ clubs: [{ id: C1, slug: 'fc' }, { id: C2, slug: 'other' }], matches: [match] }, log)
  );

  // Scope: the URL's club only; other clubs' rows are not requested (live matches aside)
  const { clubIds } = await engine.load({ slug: 'FC', clubIds: [] });
  assert.deepEqual(clubIds, [C1]);
  const membersQuery = log.find(o => o.table === 'club_members')!;
  assert.deepEqual(membersQuery.filters, [['in', 'club_id', [C1]]]);
  const matchesQuery = log.find(o => o.table === 'matches')!;
  assert.deepEqual(matchesQuery.filters, [['or', `club_id.in.(${C1}),status.in.(live,halftime)`]]);
  assert.ok(!log.some(o => o.table === 'tournament_participants'), 'no tournaments in scope, so no participants query');

  engine.seed({ matches: [match] });

  // Only the edited column is sent, so a server-side checkin_count isn't overwritten
  log.length = 0;
  await engine.flush({ matches: [{ ...match, home_score: 1 }] });
  const updates = log.filter(o => o.kind === 'update');
  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0].patch, { home_score: 1 });

  // A row that looks new is only ever inserted, never allowed to overwrite an existing one
  const M2 = '44444444-4444-4444-8444-444444444444';
  log.length = 0;
  await engine.flush({ matches: [{ ...match, home_score: 1 }, { ...match, id: M2 }] });
  const insert = log.find(o => o.kind === 'upsert')!;
  assert.deepEqual(insert.options, { onConflict: 'id', ignoreDuplicates: true });
  assert.deepEqual((insert.rows as { id: string }[]).map(r => r.id), [M2]);

  // A row missing from state is not deleted...
  log.length = 0;
  await engine.flush({ matches: [] });
  assert.ok(!log.some(o => o.kind === 'delete'));

  // ...only an explicit delete is
  const result = await engine.flush({ matches: [] }, { matches: new Set([M1]) });
  assert.deepEqual(result.deletedIds, [M1]);
  assert.ok(log.some(o => o.kind === 'delete' && o.table === 'matches'));

  console.log('sync: scoped load, column updates and explicit deletes OK');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
