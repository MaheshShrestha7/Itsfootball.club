import assert from 'node:assert/strict';
import { hexToRgb, readableClubInk } from './theme-utils';

// A 00 channel is real, not missing
assert.equal(hexToRgb('#ff0040').rgbString, '255, 0, 64');
assert.equal(hexToRgb('#000').rgbString, '0, 0, 0');
// Unreadable text falls back to the default green, a channel at a time
assert.equal(hexToRgb('#zz0040').rgbString, '16, 0, 64');
assert.equal(hexToRgb('').rgbString, '16, 185, 129');
// A red club's text stays red, in both themes
assert.equal(readableClubInk('#ff0040', 'dark'), '#ff5983');
assert.equal(readableClubInk('#ff0040', 'light'), '#b3002d');
console.log('theme-utils: ok');
