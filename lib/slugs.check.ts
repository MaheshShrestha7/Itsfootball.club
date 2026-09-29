// Self-check for club custom domain parsing and platform-host detection.
// Run: npx esbuild lib/slugs.check.ts --bundle --platform=node --log-level=warning | node
import assert from 'node:assert/strict';
import { authReturnTarget, authReturnUrl, isPlatformHost, normalizeDomain, safeNextPath } from './slugs';

assert.equal(normalizeDomain('https://WWW.YourClub.com/news?x=1'), 'www.yourclub.com');
assert.equal(normalizeDomain(' yourclub.co.uk. '), 'yourclub.co.uk');
assert.equal(normalizeDomain('club.example.org:443'), 'club.example.org');
assert.equal(normalizeDomain(''), '');
assert.equal(normalizeDomain('not a domain'), '');
assert.equal(normalizeDomain('localhost'), '');
assert.equal(normalizeDomain('-bad.com'), '');
// Our own hosts can't be claimed by a club
assert.equal(normalizeDomain('itsfootball.club'), '');
assert.equal(normalizeDomain('cname.itsfootball.club'), '');

assert.ok(isPlatformHost('itsfootball.club'));
assert.ok(isPlatformHost('www.itsfootball.club'));
assert.ok(isPlatformHost('localhost:3000'));
assert.ok(isPlatformHost('itsfootball-club.me.workers.dev'));
assert.ok(!isPlatformHost('www.yourclub.com'));
assert.ok(!isPlatformHost('notitsfootball.club'));

// Sign-in return: platform pages go straight back; club domains go via /auth/confirm and round-trip
assert.equal(authReturnUrl('https://itsfootball.club', '/ancc/member'), 'https://itsfootball.club/ancc/member');
const viaUs = authReturnUrl('https://www.ancc.com', '/ancc/member');
assert.ok(viaUs.startsWith('https://itsfootball.club/auth/confirm?to='));
assert.equal(authReturnTarget(viaUs)?.href, 'https://www.ancc.com/ancc/member');
assert.equal(authReturnTarget('https://itsfootball.club/ancc/member'), null);
assert.equal(authReturnTarget('https://evil.com/auth/confirm?to=https://www.ancc.com/'), null);
assert.equal(authReturnTarget('https://itsfootball.club/auth/confirm?to=not-a-url'), null);

assert.equal(safeNextPath('/ancc/member?x=1'), '/ancc/member?x=1');
assert.equal(safeNextPath('//evil.com'), '/');
assert.equal(safeNextPath('/\\evil.com'), '/');
assert.equal(safeNextPath('https://evil.com'), '/');
assert.equal(safeNextPath(null), '/');

console.log('slugs: custom domains, platform hosts and sign-in returns OK');
