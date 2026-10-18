// Self-check for title and description fitting.
// Run: npx esbuild lib/seo.check.ts --bundle --platform=node --log-level=warning | node
import assert from 'node:assert/strict';
import { fitDescription, fitTitle, clubPageTitle } from './seo';

// A sentence without end punctuation gets a full stop before the next one
assert.equal(fitDescription('ANCC Wins Friendly against Hamro', 'The latest news.'), 'ANCC Wins Friendly against Hamro. The latest news.');
assert.equal(fitDescription('Already done!', 'Next'), 'Already done! Next.');
assert.equal(fitDescription('He said “go”', 'Next.'), 'He said “go” Next.');
// Overlong first sentence is cut on a word with an ellipsis, never a stray full stop
const long = fitDescription('word '.repeat(60));
assert.ok(long.length <= 155 && long.endsWith('…'), long);
// Overlong sentence ending in a preposition like "at" strips the preposition
const cutAt = fitDescription('Dashain Cup 2026 Concludes with Resounding Success in Austral at Craik Park Fifteenth Avenue Austral NSW ' + 'more words '.repeat(10));
assert.ok(!cutAt.includes(' at…'), 'Never ends in at…');
// Titles: shorter alternative swapped in before parts are dropped
assert.equal(fitTitle(['A'.repeat(50), 'Short'], 'itsfootball.club'), 'Short | itsfootball.club');
assert.equal(fitTitle('Spond Alternative: itsfootball.club vs Spond'), 'Spond Alternative: itsfootball.club vs Spond');
// Club page title prioritises the full name
assert.equal(
  clubPageTitle({ name: 'Penrith Strikers FC', short_name: 'PSFC', slug: 'penrith-strikers-fc', id: '1', previous_slugs: null, motto: null, logo_url: null, banner_url: null, stadium_name: null, stadium_address: null, founded_year: null, config: null }),
  'Penrith Strikers FC (PSFC): Fixtures, Results & Live Scores'
);
assert.equal(
  clubPageTitle({ name: 'Austral Nepalese Community Club', short_name: 'ANCC', slug: 'ancc', id: '2', previous_slugs: null, motto: null, logo_url: null, banner_url: null, stadium_name: null, stadium_address: null, founded_year: null, config: null }),
  'Austral Nepalese Community Club: Fixtures & Live Scores'
);
console.log('seo ok');
