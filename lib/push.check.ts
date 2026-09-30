// Self-check for web push encryption (RFC 8291 section 5 example), VAPID signing and subscription checks.
// Run: npx esbuild lib/push.check.ts --bundle --platform=node --log-level=warning | node
import assert from 'node:assert/strict';
import { b64url, encryptPayload, fromB64url, parseSubscription, vapidAuthorization } from './push';

// RFC 8291 section 5: fixed sender key and salt, so the whole message is known in advance
const RECEIVER_PUBLIC = 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4';
const AUTH = 'BTBZMqHH6r4Tts7J_aSIgg';
const EXPECTED =
  'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml' +
  'mlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPT' +
  'pK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN';

(async () => {
  const body = await encryptPayload('When I grow up, I want to be a watermelon', fromB64url(RECEIVER_PUBLIC), fromB64url(AUTH), {
    salt: fromB64url('DGv6ra1nlYgDCS1FRnbzlw'),
    senderPrivate: fromB64url('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw'),
    senderPublic: fromB64url('BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8'),
  });
  assert.equal(b64url(body), EXPECTED, 'RFC 8291 example message');

  // Random sender key and salt each time
  const a = await encryptPayload('hi', fromB64url(RECEIVER_PUBLIC), fromB64url(AUTH));
  const b = await encryptPayload('hi', fromB64url(RECEIVER_PUBLIC), fromB64url(AUTH));
  assert.notEqual(b64url(a), b64url(b));
  assert.equal(a.length, 16 + 5 + 65 + 2 + 1 + 16, 'header + payload + delimiter + tag');

  // VAPID: a throwaway key pair; the JWT must verify with the public key and be scoped to the push service origin
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
  const pub = b64url(await crypto.subtle.exportKey('raw', pair.publicKey));
  const d = (await crypto.subtle.exportKey('jwk', pair.privateKey)).d!;
  const auth = await vapidAuthorization('https://fcm.googleapis.com/fcm/send/abc', pub, d, 'mailto:test@example.com');
  const [, jwt, k] = auth.match(/^vapid t=([^,]+), k=(.+)$/)!;
  assert.equal(k, pub);
  const [h, c, s] = jwt.split('.');
  assert.equal(JSON.parse(new TextDecoder().decode(fromB64url(c))).aud, 'https://fcm.googleapis.com');
  assert.ok(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pair.publicKey, fromB64url(s), new TextEncoder().encode(`${h}.${c}`)), 'VAPID signature');

  // Subscriptions: only real push services, only well-formed keys
  const keys = { p256dh: RECEIVER_PUBLIC, auth: AUTH };
  assert.ok(parseSubscription({ endpoint: 'https://fcm.googleapis.com/fcm/send/x', keys }));
  assert.ok(parseSubscription({ endpoint: 'https://web.push.apple.com/abc', keys }));
  assert.ok(parseSubscription({ endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/x', keys }));
  assert.equal(parseSubscription({ endpoint: 'https://evil.example.com/x', keys }), null, 'unknown host');
  assert.equal(parseSubscription({ endpoint: 'https://push.apple.com.evil.com/x', keys }), null, 'lookalike host');
  assert.equal(parseSubscription({ endpoint: 'http://fcm.googleapis.com/x', keys }), null, 'plain http');
  assert.equal(parseSubscription({ endpoint: 'https://fcm.googleapis.com/x', keys: { ...keys, auth: 'AAAA' } }), null, 'short auth');
  assert.equal(parseSubscription({ endpoint: 'https://fcm.googleapis.com/x', keys: { ...keys, p256dh: AUTH } }), null, 'short key');
  assert.equal(parseSubscription(null), null);

  console.log('push: RFC 8291 encryption, VAPID and subscription checks OK');
})().catch(err => { console.error(err); process.exit(1); });
