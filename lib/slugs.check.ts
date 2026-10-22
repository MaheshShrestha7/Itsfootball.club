// Self-check for club custom domain parsing and platform-host detection.
// Run: npx esbuild lib/slugs.check.ts --bundle --platform=node --log-level=warning | node
import assert from 'node:assert/strict';
import { authReturnTarget, authReturnUrl, clubSlugFromPath, isPlatformHost, matchForParam, matchPath, normalizeDomain, safeNextPath } from './slugs';

// Club pages, platform pages, and public tournament pages (which load their tournament-only club)
assert.equal(clubSlugFromPath('/ancc/match/123'), 'ancc');
assert.equal(clubSlugFromPath('/tools/lineup-builder'), '');
assert.equal(clubSlugFromPath('/tournaments'), '');
assert.equal(clubSlugFromPath('/tournaments/Dashain-Cup-2026'), 'dashain-cup-2026');
assert.equal(clubSlugFromPath('/tournaments/dashain-cup-2026/manage'), 'dashain-cup-2026');
assert.equal(clubSlugFromPath('/tournaments/admin'), '');
assert.equal(clubSlugFromPath('/%E0%A4%A'), '');

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

// Match URLs: the slug once there is one, else the id; the page finds a match by either, or by an old slug
const fixture = { id: '7f1c2e9a-0b1d-4c5e-8f00-1234567890ab', slug: 'riverside-fc-vs-parramatta-city-2026-10-16', previous_slugs: ['riverside-fc-vs-parramatta-city-2026-10-09'] };
assert.equal(matchPath('ancc', fixture), '/ancc/match/riverside-fc-vs-parramatta-city-2026-10-16');
assert.equal(matchPath('ancc', { id: fixture.id }), `/ancc/match/${fixture.id}`);
assert.equal(matchPath('ancc', { id: fixture.id, slug: null }), `/ancc/match/${fixture.id}`);
assert.equal(matchForParam([fixture], fixture.id), fixture);
assert.equal(matchForParam([fixture], 'Riverside-FC-vs-Parramatta-City-2026-10-16'), fixture);
assert.equal(matchForParam([fixture], 'riverside-fc-vs-parramatta-city-2026-10-09'), fixture);
assert.equal(matchForParam([fixture], 'riverside-fc-vs-parramatta-city-2026-10-23'), undefined);
assert.equal(matchForParam([{ id: 'a' }], '%E0%A4%A'), undefined);
