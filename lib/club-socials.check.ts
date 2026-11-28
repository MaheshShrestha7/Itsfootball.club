import assert from 'node:assert/strict';
import { clubSocials, normaliseSocial, socialLabel } from './club-socials';

const url = (k: Parameters<typeof normaliseSocial>[0], raw: string) => {
  const r = normaliseSocial(k, raw);
  assert.ok('url' in r, `${k} "${raw}" should be accepted: ${'error' in r ? r.error : ''}`);
  return r.url;
};
const err = (k: Parameters<typeof normaliseSocial>[0], raw: string) => {
  const r = normaliseSocial(k, raw);
  assert.ok('error' in r, `${k} "${raw}" should be refused`);
  return r.error;
};

// Empty clears it
assert.equal(url('facebook', '  '), '');
// @names become the platform's own link
assert.equal(url('instagram', '@southside.utd'), 'https://instagram.com/southside.utd');
assert.equal(url('tiktok', 'southsideutd'), 'https://tiktok.com/@southsideutd');
assert.equal(url('youtube', '@southside'), 'https://youtube.com/@southside');
assert.equal(url('x', '@southside_fc'), 'https://x.com/southside_fc');
// Links are tidied: https, no www, no tracking query, no trailing slash
assert.equal(url('facebook', 'facebook.com/SouthsideUnitedFC/'), 'https://facebook.com/SouthsideUnitedFC');
assert.equal(url('tiktok', 'https://www.tiktok.com/@southsideutd?lang=en'), 'https://tiktok.com/@southsideutd');
assert.equal(url('facebook', 'http://m.facebook.com/profile.php?id=1000&ref=x'), 'https://facebook.com/profile.php?id=1000');
assert.equal(url('x', 'https://twitter.com/southside'), 'https://x.com/southside');
assert.equal(url('youtube', 'https://www.youtube.com/channel/UC123'), 'https://youtube.com/channel/UC123');
// Wrong platform, other sites, unsafe schemes and bare home pages are refused
assert.match(err('youtube', 'instagram.com/southsideutd'), /Instagram link/);
assert.match(err('youtube', 'instagram.com'), /Instagram link/);
assert.match(err('facebook', 'https://evil.com/facebook.com'), /isn't a Facebook link/);
assert.match(err('facebook', 'https://facebook.com.evil.com/x'), /isn't a Facebook link/);
assert.match(err('instagram', 'javascript:alert(1)//instagram.com'), /web links/);
assert.match(err('facebook', 'facebook.com'), /Add your page/);
assert.match(err('facebook', 'facebook.com/profile.php'), /page id/);
err('x', 'x.com/' + 'a'.repeat(400));

// Only valid saved links are shown, in platform order
const shown = clubSocials({ socials: { x: 'https://x.com/a', facebook: 'https://facebook.com/b', instagram: 'javascript:alert(1)', tiktok: 5 } });
assert.deepEqual(shown.map(s => s.url), ['https://facebook.com/b', 'https://x.com/a']);
assert.deepEqual(clubSocials(null), []);
assert.deepEqual(clubSocials({ socials: 'nope' }), []);
assert.equal(socialLabel('https://facebook.com/b'), 'facebook.com/b');

console.log('club-socials: ok');
