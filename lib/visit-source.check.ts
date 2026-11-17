import assert from 'node:assert/strict';
import { countBySource, mediumLabel, sourceLabel, summariseSources, tagLink, DIRECT, OWN_SITE } from './visit-source';

// tagLink
assert.equal(tagLink('/rfc/news/x', 'share', 'share', 'news/x'), '/rfc/news/x?utm_source=share&utm_medium=share&utm_campaign=news%2Fx');
assert.equal(tagLink('https://rfc.com.au/events/1#top', 'qr', 'flyer', 'Event Flyer'), 'https://rfc.com.au/events/1?utm_source=qr&utm_medium=flyer&utm_campaign=event-flyer#top');
assert.equal(tagLink('https://a.com/?utm_source=x', 'qr', 'poster', 'p'), 'https://a.com/?utm_source=x', 'their own tags are kept');
assert.equal(tagLink('/rfc?tab=1', 'email', 'email', 'news-email'), '/rfc?tab=1&utm_source=email&utm_medium=email&utm_campaign=news-email');

// sourceLabel: tags beat fbclid beat referrer
assert.equal(sourceLabel(null, { src: 'facebook' }), 'Facebook');
assert.equal(sourceLabel(null, { src: 'share', fb: 1 }), 'Facebook', 'Facebook added fbclid to our shared link');
assert.equal(sourceLabel('https://l.facebook.com/', {}), 'Facebook');
assert.equal(sourceLabel('https://m.facebook.com/', { src: 'share' }), 'Facebook');
assert.equal(sourceLabel(null, { src: 'share' }), 'Shared link, app unknown');
assert.equal(sourceLabel('https://www.google.com.au/', {}), 'Google');
assert.equal(sourceLabel('https://mail.google.com/', {}), 'Email');
assert.equal(sourceLabel('https://gemini.google.com/', {}), 'AI chat');
assert.equal(sourceLabel('https://chatgpt.com/', {}), 'AI chat');
assert.equal(sourceLabel('https://l.instagram.com/', {}), 'Instagram');
assert.equal(sourceLabel(null, { src: 'qr', med: 'poster' }), 'QR poster or flyer');
assert.equal(sourceLabel('https://somecouncil.nsw.gov.au/', {}), 'somecouncil.nsw.gov.au');
assert.equal(sourceLabel('', {}), DIRECT);
assert.equal(sourceLabel(undefined, undefined), DIRECT);
// own site
assert.equal(sourceLabel('https://itsfootball.club/rfc/news', {}, { slug: 'rfc' }), OWN_SITE);
assert.equal(sourceLabel('https://itsfootball.club/clubs', {}, { slug: 'rfc' }), 'itsfootball.club');
assert.equal(sourceLabel('https://www.rfc.com.au/', {}, { slug: 'rfc', domain: 'rfc.com.au' }), OWN_SITE);
assert.equal(sourceLabel('https://itsfootball.club/', {}), OWN_SITE, 'platform pages: all of itsfootball.club is our own');

// summariseSources: one visit per browser per day, an outside source beats Direct
const day = '2026-11-18T01:00:00Z';
const s = summariseSources([
  { visitor_hash: 'a', created_at: day, referrer: null, metadata: {} },
  { visitor_hash: 'a', created_at: day, referrer: null, metadata: { src: 'share', med: 'share', cmp: 'match/u12', fb: 1 } },
  { visitor_hash: 'a', created_at: day, referrer: null, metadata: {} },
  { visitor_hash: 'b', created_at: day, referrer: 'https://www.google.com/', metadata: {} },
  { visitor_hash: 'b', created_at: '2026-11-19T01:00:00Z', referrer: 'https://www.google.com/', metadata: {} },
  { visitor_hash: 'c', created_at: day, referrer: 'https://itsfootball.club/rfc', metadata: {} },
  { visitor_hash: 'anon', created_at: day, referrer: null, metadata: {} },
  { visitor_hash: 'anon', created_at: day, referrer: null, metadata: {} },
], { slug: 'rfc' });
assert.deepEqual(s.sources, [['Google', 2], [DIRECT, 2], ['Facebook', 1]]);
assert.equal(s.visits, 5);
assert.deepEqual(s.campaigns, [{ campaign: 'match/u12', how: 'Share button', visits: 1, from: 'Facebook 1' }]);

assert.deepEqual(countBySource([
  { created_at: day, referrer: 'https://m.facebook.com/', metadata: { kind: 'member' } },
  { created_at: day, referrer: null, metadata: { kind: 'member', src: 'facebook' } },
  { created_at: day, referrer: null, metadata: { kind: 'member' } },
]), [['Facebook', 2], [DIRECT, 1]]);
assert.equal(mediumLabel('flyer'), 'Event flyer');

console.log('visit-source checks passed');
