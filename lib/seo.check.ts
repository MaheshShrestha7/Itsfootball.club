// Self-check for title and description fitting.
// Run: npx esbuild lib/seo.check.ts --bundle --platform=node --log-level=warning | node
import assert from 'node:assert/strict';
import { fitDescription, fitTitle } from './seo';

// A sentence without end punctuation gets a full stop before the next one
assert.equal(fitDescription('ANCC Wins Friendly against Hamro', 'The latest news.'), 'ANCC Wins Friendly against Hamro. The latest news.');
assert.equal(fitDescription('Already done!', 'Next'), 'Already done! Next.');
assert.equal(fitDescription('He said “go”', 'Next.'), 'He said “go” Next.');
// Overlong first sentence is cut on a word with an ellipsis, never a stray full stop
const long = fitDescription('word '.repeat(60));
assert.ok(long.length <= 155 && long.endsWith('…'), long);
// Titles: shorter alternative swapped in before parts are dropped
assert.equal(fitTitle(['A'.repeat(50), 'Short'], 'itsfootball.club'), 'Short | itsfootball.club');
assert.equal(fitTitle('Spond Alternative: itsfootball.club vs Spond'), 'Spond Alternative: itsfootball.club vs Spond');
console.log('seo ok');
