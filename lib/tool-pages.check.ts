// Checks lib/tool-pages.ts: every tool page is on the /tools hub exactly once, under one group, and each
// format page's button text is the start of its name (the hub keeps the rest in the link for search engines).
// Run with `npm run check`.
import assert from 'node:assert/strict';
import { FORMAT_PAGES, MAIN_TOOLS, TOOL_FORMATS, TOOL_GROUPS } from './tool-pages';

const onHub = MAIN_TOOLS.flatMap(t => [t.path, ...(TOOL_FORMATS[t.path] ?? []).map(f => f.path)]);
assert.equal(new Set(onHub).size, onHub.length, 'a tool page is on the hub twice');
assert.deepEqual([...onHub].sort(), [...MAIN_TOOLS, ...FORMAT_PAGES].map(t => t.path).sort(), 'a tool page is missing from the hub cards');

const grouped = TOOL_GROUPS.flatMap(g => [...g.main, ...g.formats].map(t => t.path));
assert.equal(new Set(grouped).size, grouped.length, 'a tool page is in two groups');
assert.deepEqual([...grouped].sort(), [...onHub].sort(), 'groups and hub cards list different pages');
for (const g of TOOL_GROUPS) {
  for (const t of g.main) for (const f of TOOL_FORMATS[t.path] ?? []) assert.ok(g.formats.includes(f), `${f.path} is not in the ${g.id} group with its tool`);
}

for (const f of FORMAT_PAGES) assert.ok(f.short && f.label.startsWith(f.short), `${f.path}: short "${f.short}" must start its label`);

console.log('tool-pages checks passed');
