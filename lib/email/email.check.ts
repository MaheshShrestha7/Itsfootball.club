// Run: npx esbuild lib/email/email.check.ts --bundle --platform=node | node   (part of `npm run check`)
import assert from 'node:assert/strict';
import { verifyWebhook } from './webhook';
import { authEmail, availabilityReminder, renewalReminder, newsNotice, matchNotice } from './templates';
import { unsubscribeToken, verifyUnsubscribeToken } from './unsubscribe';
import { cleanSettings } from './settings';

// Test fixture only, NOT a real key: a made-up string, wrapped in the "v1,whsec_<base64>" format
// Supabase uses. Built at runtime so no secret-shaped literal sits in the repo.
// SIG was computed independently with Python's hmac module: base64(HMAC-SHA256(key, "id.ts.body")).
const FAKE_KEY = 'test-secret-key-0123456789abcdef';
const SECRET = `v1,whsec_${btoa(FAKE_KEY)}`;
const BODY = '{"user":{"email":"a@b.co"}}';
const SIG = 'mrts+LzYLON1CFt9H4c4oszDyylifj4pWdi3XzDpjfU=';
const TS = 1700000000;
const headers = (signature: string, timestamp = String(TS)) => ({ id: 'msg_2Lh9KsGQ', timestamp, signature });

async function main() {
  // --- webhook signatures ---
  assert.equal(await verifyWebhook(SECRET, headers(`v1,${SIG}`), BODY, TS), true, 'valid signature');
  assert.equal(await verifyWebhook(SECRET, headers(`v1,${SIG}`), BODY + ' ', TS), false, 'tampered body');
  assert.equal(await verifyWebhook(SECRET, headers(`v1,${SIG}`), BODY, TS + 301), false, 'expired timestamp');
  assert.equal(await verifyWebhook(SECRET, headers(`v1,${SIG}`), BODY, TS - 301), false, 'future timestamp');
  assert.equal(await verifyWebhook(SECRET, headers(`v1,AAAA v1,${SIG}`), BODY, TS), true, 'one of several signatures');
  assert.equal(await verifyWebhook(SECRET, headers(`v2,${SIG}`), BODY, TS), false, 'unknown version');
  assert.equal(await verifyWebhook(SECRET, headers('v1,not-base64!!'), BODY, TS), false, 'garbage signature');
  assert.equal(await verifyWebhook('v1,whsec_' + btoa('another-key'), headers(`v1,${SIG}`), BODY, TS), false, 'wrong secret');
  assert.equal(await verifyWebhook(SECRET, { id: null, timestamp: String(TS), signature: `v1,${SIG}` }, BODY, TS), false, 'missing id');

  // --- templates ---
  const evil = { name: 'Evil <script>alert(1)</script> FC', color: '#FFFF00', url: 'https://itsfootball.club/evil', logoUrl: 'javascript:alert(1)' };
  const link = 'https://x.supabase.co/auth/v1/verify?token=abc&type=magiclink&redirect_to=https%3A%2F%2Fitsfootball.club%2Fevil%2Fmember';
  const signIn = authEmail('magiclink', link, '123456', evil);
  assert.ok(!signIn.html.includes('<script>'), 'club name is escaped');
  assert.ok(!signIn.html.includes('javascript:'), 'non-https logo is dropped');
  assert.ok(signIn.html.includes(link.replace(/&/g, '&amp;')), 'link in html (escaped)');
  assert.ok(signIn.text.includes(link), 'link in plain text');
  assert.ok(signIn.subject.includes('Evil <script>'), 'subject is plain text, not html');
  assert.ok(signIn.html.includes('color:#090D16'), 'dark button text on a light club colour');

  const platform = authEmail('signup', link, '123456');
  assert.ok(platform.html.includes('https://itsfootball.club/logo-96.png'), 'platform logo');
  assert.ok(platform.subject.includes('itsfootball.club'));

  const code = authEmail('reauthentication', '', '654321');
  assert.ok(code.html.includes('654321') && code.text.includes('654321'), 'reauth shows the code');

  const avail = availabilityReminder({ brand: evil, memberName: '  Sam  Ray ', fixture: 'A vs B', when: 'Sat 4 Oct', venue: 'Park', link: 'https://itsfootball.club/evil/availability?token=t' });
  assert.ok(avail.text.startsWith(evil.name) && avail.text.includes('Hi Sam,'), 'first name greeting');

  const renew = renewalReminder({ brand: evil, memberName: 'Jo', tier: 'Senior', expires: '1 November 2026', expired: true, link: 'https://x' });
  assert.ok(renew.subject.includes('has expired'));

  // --- unsubscribe tokens ---
  const k = 'test-cron-secret';
  const tok = (await unsubscribeToken('club-1', ' Sam@Example.com ', k))!;
  assert.ok(/^[A-Za-z0-9_-]+$/.test(tok), 'url-safe token');
  assert.equal(await verifyUnsubscribeToken('club-1', 'sam@example.com', tok, k), true, 'same address, any case/spacing');
  assert.equal(await verifyUnsubscribeToken('club-2', 'sam@example.com', tok, k), false, 'other club');
  assert.equal(await verifyUnsubscribeToken('club-1', 'other@example.com', tok, k), false, 'other address');
  assert.equal(await verifyUnsubscribeToken('club-1', 'sam@example.com', tok, 'another-secret'), false, 'other secret');
  assert.equal(await verifyUnsubscribeToken('club-1', 'sam@example.com', 'garbage!!', k), false, 'garbage token');
  assert.equal(await unsubscribeToken('club-1', 'sam@example.com', ''), null, 'no secret, no token');

  // --- settings ---
  assert.deepEqual(cleanSettings({ availability_reminders: true, event_reminders: 'yes', bogus: true }), { availability_reminders: true }, 'only known boolean switches');
  assert.deepEqual(cleanSettings(null), {});

  // --- notices ---
  const news = newsNotice({ brand: evil, recipientName: 'Sam', title: 'Big <win>', summary: 'We won', image: 'http://insecure/img.jpg', link: 'https://x/#news', message: 'Hi <b>all</b>\n\nSecond para', unsubscribeUrl: 'https://itsfootball.club/unsubscribe?c=1&e=a&t=b' });
  assert.ok(!news.html.includes('<b>all</b>') && news.html.includes('&lt;b&gt;all&lt;/b&gt;'), 'admin message escaped');
  assert.ok(!news.html.includes('http://insecure'), 'non-https image dropped');
  assert.ok(news.html.includes('Unsubscribe from') && news.text.includes('Unsubscribe: https://itsfootball.club/unsubscribe'), 'unsubscribe link in html and text');
  assert.ok(news.text.includes('Second para'), 'message in plain text');
  const match = matchNotice({ brand: evil, recipientName: 'Sam', fixture: 'A vs B', competition: null, when: 'Sun', venue: 'Park', link: 'https://x' });
  assert.ok(!match.html.includes('Message from') && !match.html.includes('Unsubscribe from'), 'no message/unsubscribe blocks when absent');

  console.log('email: webhook signatures, unsubscribe tokens and templates OK');
}

main().catch(e => { console.error(e); process.exit(1); });
