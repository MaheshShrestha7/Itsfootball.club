import assert from 'node:assert/strict';
import {
  BIRTHDAY_STYLES,
  birthdayFileName,
  effectiveBirthdayStyle,
  resolveBirthdayPalette,
  splitDisplayName,
} from './birthday-card-meta';

// Exactly 7 distinct variations
assert.equal(BIRTHDAY_STYLES.length, 7);
assert.equal(new Set(BIRTHDAY_STYLES.map(s => s.id)).size, 7);

// Default club colours & contrast ink
const crimson = resolveBirthdayPalette('#C8102E', '#E5C158', 'club');
assert.equal(crimson.primary, '#C8102E');
assert.equal(crimson.accent, '#E5C158');
assert.equal(crimson.inkOnPrimary, '#FFFFFF');

// Bright primary gets dark ink on primary surfaces (e.g. Swiss Brutalist)
const yellow = resolveBirthdayPalette('#FACC15', '#111827', 'club');
assert.equal(yellow.inkOnPrimary, '#0A0A0C');

// Inverted mode swaps primary & secondary and lifts dark accents for readability
const away = resolveBirthdayPalette('#C8102E', '#1D4ED8', 'inverted');
assert.equal(away.primary, '#1D4ED8');
assert.notEqual(away.accent, '#1D4ED8');
assert.ok(away.accent.startsWith('#'), 'lifted accent is a valid hex');

// Gold luxe always uses champagne gold accent
const gold = resolveBirthdayPalette('#047857', '#FFFFFF', 'gold');
assert.equal(gold.primary, '#047857');
assert.equal(gold.accent, '#E5C158');

// Custom colour falls back safely on bad hex
const customOk = resolveBirthdayPalette('#C8102E', '#E5C158', 'custom', '#00aaff');
assert.equal(customOk.primary, '#00AAFF');
const customBad = resolveBirthdayPalette('#C8102E', '#E5C158', 'custom', 'not-a-hex');
assert.equal(customBad.primary, '#C8102E');

// No-photo fallback automatically picks Architectural Kit
assert.equal(effectiveBirthdayStyle('ucl', false), 'kit');
assert.equal(effectiveBirthdayStyle('magazine', false), 'kit');
assert.equal(effectiveBirthdayStyle('ucl', true), 'ucl');

// Name splitting for stacked editorial typography
assert.deepEqual(splitDisplayName('Rohan Gurung'), { first: 'ROHAN', rest: 'GURUNG' });
assert.deepEqual(splitDisplayName('Maya P.'), { first: 'MAYA', rest: 'P.' });
assert.deepEqual(splitDisplayName('Pelé'), { first: '', rest: 'PELÉ' });

// Clean download filename
assert.equal(
  birthdayFileName('himalayan-fc', "Liam O'Connor", 'heritage', 'post'),
  'himalayan-fc-birthday-liam-o-connor-heritage-post.png',
);

console.log('birthday-card checks passed');
