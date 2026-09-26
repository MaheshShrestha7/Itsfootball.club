// Self-check for paged fetching past Supabase's 1,000-rows-per-request cap.
// Run: npx esbuild lib/paged.check.ts --bundle --platform=node --log-level=warning | node
import assert from 'node:assert/strict';
import { fetchPaged } from './paged';

// A fake table of `total` rows that, like Supabase, never returns more than 1,000 at once
function table(total: number, failAt?: number) {
  const calls: Array<[number, number]> = [];
  const page = async (from: number, to: number) => {
    calls.push([from, to]);
    if (failAt !== undefined && from >= failAt) return { data: null, error: { message: 'boom' } };
    const end = Math.min(to, from + 999, total - 1);
    return { data: Array.from({ length: Math.max(0, end - from + 1) }, (_, i) => from + i), error: null };
  };
  return { page, calls };
}

async function main() {
  let t = table(2500);
  let res = await fetchPaged<number>(t.page, 5000);
  assert.equal(res.data.length, 2500);
  assert.deepEqual(t.calls, [[0, 999], [1000, 1999], [2000, 2999]]);

  t = table(12000);
  res = await fetchPaged<number>(t.page, 5000);
  assert.equal(res.data.length, 5000, 'stops at max');
  assert.equal(res.data[4999], 4999);

  t = table(1000);
  res = await fetchPaged<number>(t.page, 5000);
  assert.equal(res.data.length, 1000);
  assert.equal(t.calls.length, 2, 'a full last page needs one more request to see the end');

  t = table(3000, 1000);
  res = await fetchPaged<number>(t.page, 5000);
  assert.equal(res.error, 'boom');
  assert.equal(res.data.length, 1000, 'keeps the pages that arrived');

  console.log('paged: fetches past the 1,000-row cap OK');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
