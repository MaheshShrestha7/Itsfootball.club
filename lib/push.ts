// Web push (the notifications a followed club sends to phones and browsers), with WebCrypto only so
// it runs on Cloudflare Workers: VAPID (RFC 8292) proves the message is from us, and aes128gcm
// (RFC 8291) encrypts it for the one browser that subscribed. Keys: see .env.example.
import type { SupabaseClient } from '@supabase/supabase-js';

export const b64url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const fromB64url = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>;

const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
};
const text = (s: string) => new TextEncoder().encode(s);

/** P-256 key from its raw private scalar d plus the matching uncompressed public key (0x04 || x || y) */
function privateKey(d: Uint8Array, publicRaw: Uint8Array, algorithm: 'ECDH' | 'ECDSA') {
  const jwk = { kty: 'EC', crv: 'P-256', d: b64url(d), x: b64url(publicRaw.slice(1, 33)), y: b64url(publicRaw.slice(33, 65)) };
  return crypto.subtle.importKey('jwk', jwk, { name: algorithm, namedCurve: 'P-256' }, false, algorithm === 'ECDH' ? ['deriveBits'] : ['sign']);
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number) {
  const key = await crypto.subtle.importKey('raw', ikm as Uint8Array<ArrayBuffer>, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: salt as Uint8Array<ArrayBuffer>, info: info as Uint8Array<ArrayBuffer> }, key, bytes * 8));
}

/** The sender's one-off key pair and salt; only the RFC 8291 test fixes them */
export interface EncryptFixture { salt: Uint8Array; senderPrivate: Uint8Array; senderPublic: Uint8Array }

/** RFC 8291 aes128gcm body for one subscriber (p256dh = their public key, auth = their secret) */
export async function encryptPayload(payload: string, p256dh: Uint8Array, auth: Uint8Array, fixture?: EncryptFixture) {
  let senderKey: CryptoKey;
  let senderPublic: Uint8Array;
  if (fixture) {
    senderKey = await privateKey(fixture.senderPrivate, fixture.senderPublic, 'ECDH');
    senderPublic = fixture.senderPublic;
  } else {
    const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']) as CryptoKeyPair;
    senderKey = pair.privateKey;
    senderPublic = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  }
  const salt = fixture?.salt ?? crypto.getRandomValues(new Uint8Array(16));

  const receiver = await crypto.subtle.importKey('raw', p256dh as Uint8Array<ArrayBuffer>, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: receiver }, senderKey, 256));
  const ikm = await hkdf(auth, shared, concat(text('WebPush: info\0'), p256dh, senderPublic), 32);
  const cek = await hkdf(salt, ikm, text('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, text('Content-Encoding: nonce\0'), 12);

  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  // One record: the payload, then the 0x02 "last record" delimiter
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(text(payload), new Uint8Array([2]))));
  // Header: salt, record size (4096), key id length, key id (the sender's public key)
  return concat(salt, new Uint8Array([0, 0, 16, 0, senderPublic.length]), senderPublic, sealed);
}

/** `vapid t=<JWT>, k=<public key>` for one push service (the JWT is scoped to its origin) */
export async function vapidAuthorization(endpoint: string, publicKey: string, privateD: string, subject: string) {
  const header = b64url(text(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64url(text(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const key = await privateKey(fromB64url(privateD), fromB64url(publicKey), 'ECDSA');
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, text(`${header}.${claims}`));
  return `vapid t=${header}.${claims}.${b64url(signature)}, k=${publicKey}`;
}

// Browser push services. The server POSTs to whatever endpoint a browser hands us, so only these hosts are accepted.
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /\.notify\.windows\.com$/];

/** A browser's PushSubscription JSON, checked: https endpoint on a known push service, well-formed keys */
export function parseSubscription(input: unknown): { endpoint: string; p256dh: string; auth: string } | null {
  const s = input as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null;
  if (typeof s?.endpoint !== 'string' || s.endpoint.length > 1024) return null;
  const { p256dh, auth } = s.keys || {};
  if (typeof p256dh !== 'string' || typeof auth !== 'string') return null;
  try {
    const url = new URL(s.endpoint);
    if (url.protocol !== 'https:' || !PUSH_HOSTS.some(h => h.test(url.hostname))) return null;
    const key = fromB64url(p256dh);
    if (key.length !== 65 || key[0] !== 4 || fromB64url(auth).length !== 16) return null;
  } catch {
    return null;
  }
  return { endpoint: s.endpoint, p256dh, auth };
}

export interface PushMessage {
  title: string;
  body: string;
  /** Path on the club's site (e.g. /my-club/match/123); the service worker opens it on its own origin */
  url: string;
  tag?: string;
}

export const pushConfigured = () => !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

// ponytail: one request per follower inside the calling request (Workers subrequest limit); move to a Queue past ~900 followers
const MAX_PUSHES = 900;

/** Sends `message` to everyone following the club; drops subscriptions the push service says are gone. Returns how many were delivered. */
export async function pushToClub(db: SupabaseClient, clubId: string, message: PushMessage): Promise<number> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateD = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateD) return 0;
  const subject = process.env.VAPID_SUBJECT || 'https://itsfootball.club';

  const { data } = await db.from('push_subscriptions').select('endpoint, p256dh, auth').eq('club_id', clubId).limit(MAX_PUSHES);
  const body = JSON.stringify(message);
  const gone: string[] = [];
  let delivered = 0;

  await Promise.all((data || []).map(async sub => {
    try {
      const res = await fetch(sub.endpoint, {
        method: 'POST',
        headers: {
          Authorization: await vapidAuthorization(sub.endpoint, publicKey, privateD, subject),
          'Content-Encoding': 'aes128gcm',
          'Content-Type': 'application/octet-stream',
          TTL: '86400',
          Urgency: 'normal',
        },
        body: await encryptPayload(body, fromB64url(sub.p256dh), fromB64url(sub.auth)),
      });
      if (res.ok) delivered++;
      else if (res.status === 404 || res.status === 410) gone.push(sub.endpoint);
      else console.error('[push]', res.status, new URL(sub.endpoint).host, await res.text().catch(() => ''));
    } catch (err) {
      console.error('[push] send failed:', err);
    }
  }));

  if (gone.length) await db.from('push_subscriptions').delete().in('endpoint', gone);
  return delivered;
}
