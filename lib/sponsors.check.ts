// Self-check for sponsor link filtering.
// Run: npx esbuild lib/sponsors.check.ts --bundle --platform=node --log-level=warning | node
import assert from 'node:assert/strict';
import { sponsorHref } from './sponsors';

assert.equal(sponsorHref('https://acme.com/x?y=1'), 'https://acme.com/x?y=1');
assert.equal(sponsorHref('http://acme.com'), 'http://acme.com/');
assert.equal(sponsorHref('javascript:alert(document.cookie)'), undefined);
assert.equal(sponsorHref(' JavaScript:alert(1)'), undefined);
assert.equal(sponsorHref('data:text/html,<script>alert(1)</script>'), undefined);
assert.equal(sponsorHref('acme.com'), undefined);
assert.equal(sponsorHref(''), undefined);
assert.equal(sponsorHref(undefined), undefined);

console.log('sponsors: link filtering OK');
