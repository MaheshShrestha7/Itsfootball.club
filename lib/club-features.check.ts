// Self-check for the club feature switches (clubs.config.features_off).
// Run (from the repo root): npx esbuild lib/club-features.check.ts --bundle --platform=node --log-level=warning | node
import assert from 'node:assert/strict';
import { configWithFeaturesOff, featureClosingPath, featureOn, featuresOff } from './club-features';

// On by default: no config, empty config, junk
assert.equal(featureOn(null, 'shop'), true);
assert.equal(featureOn({ config: {} }, 'shop'), true);
assert.equal(featureOn({ config: { features_off: 'shop' } }, 'shop'), true, 'a string is not a list');
assert.deepEqual(featuresOff({ config: { features_off: ['shop', 'made-up'] } }), ['shop'], 'unknown keys dropped');

const club = { config: { time_zone: 'Australia/Perth', hidden: true, features_off: ['shop', 'sponsor_page', 'gallery'] } };
assert.equal(featureOn(club, 'shop'), false);
assert.equal(featureOn(club, 'news'), true);

// Saving keeps the other settings and drops the list when everything is back on
assert.deepEqual(configWithFeaturesOff(club.config, ['news', 'shop']), { time_zone: 'Australia/Perth', hidden: true, features_off: ['shop', 'news'] });
assert.deepEqual(configWithFeaturesOff(club.config, []), { time_zone: 'Australia/Perth', hidden: true });
assert.deepEqual(configWithFeaturesOff(null, ['events']), { features_off: ['events'] });

// Pages that close
assert.equal(featureClosingPath(club, '/shop')?.key, 'shop');
assert.equal(featureClosingPath(club, '/gallery/')?.key, 'gallery');
assert.equal(featureClosingPath(club, '/sponsor')?.key, 'sponsor_page');
assert.equal(featureClosingPath(club, '/sponsor/invoice/abc'), null, 'signed-up sponsors keep their links');
assert.equal(featureClosingPath(club, '/admin/shop')?.key, 'shop');
assert.equal(featureClosingPath(club, '/admin/gallery')?.key, 'gallery');
assert.equal(featureClosingPath(club, '/admin/sponsors'), null, 'the admin Sponsors page stays');
assert.equal(featureClosingPath(club, '/news'), null);
assert.equal(featureClosingPath(club, '/'), null);
assert.equal(featureClosingPath(club, ''), null);
assert.equal(featureClosingPath({ config: { features_off: ['news'] } }, '/admin/content')?.key, 'news');
assert.equal(featureClosingPath({ config: { features_off: ['events'] } }, '/admin/events'), null, 'training stays in admin');

// The latest switches
const more = { config: { features_off: ['scanner', 'joining', 'perks', 'home_ground'] } };
assert.equal(featureClosingPath(more, '/verify')?.key, 'scanner');
assert.equal(featureClosingPath(more, '/admin/scanner')?.key, 'scanner');
assert.equal(featureClosingPath(more, '/member'), null, 'members still sign in with joining off');
assert.equal(featureClosingPath(more, '/admin/sponsors'), null, 'perks off keeps the Sponsors page');
assert.equal(featureOn(more, 'home_ground'), false);
assert.equal(featureOn(more, 'home_numbers'), true);
assert.deepEqual(configWithFeaturesOff({}, ['home_ground', 'scanner']), { features_off: ['scanner', 'home_ground'] }, 'saved in list order');

console.log('club-features: all checks passed');
