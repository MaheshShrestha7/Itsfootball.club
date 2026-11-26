// Facebook and Instagram posting through Meta's Graph API (Admin > Social media, phase 2,
// migration 20261188). Server only: it uses the app secret.
// Env: META_APP_SECRET (Cloudflare, secret), META_APP_ID (optional, the public app id below),
// META_LOGIN_CONFIG_ID (optional, a Facebook Login for Business configuration in place of scopes).
import { SITE_URL } from '@/lib/slugs';

const GRAPH = 'https://graph.facebook.com/v25.0';
export const META_REDIRECT = `${SITE_URL}/api/social/meta/callback`;
export const META_SCOPES = [
  'pages_show_list', 'pages_manage_posts', 'pages_read_engagement', 'business_management',
  'instagram_basic', 'instagram_content_publish',
];

export interface MetaConfig { appId: string; secret: string; configId?: string }
export function metaConfig(): MetaConfig | null {
  const secret = process.env.META_APP_SECRET?.trim();
  if (!secret) return null;
  return { appId: process.env.META_APP_ID?.trim() || '1508498767790055', secret, configId: process.env.META_LOGIN_CONFIG_ID?.trim() || undefined };
}

const enc = new TextEncoder();
const b64url = (b: Uint8Array) => Buffer.from(b).toString('base64url');
const unb64url = (s: string) => new Uint8Array(Buffer.from(s, 'base64url'));

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}
function sameBytes(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

// --- Page tokens are saved encrypted (AES-GCM, key derived from the app secret: a new secret means reconnecting)
async function aesKey(secret: string) {
  const base = await crypto.subtle.importKey('raw', enc.encode(secret), 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: enc.encode('itsfootball-social'), info: enc.encode('page-tokens') },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function seal(secret: string, text: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(secret), enc.encode(text)));
  return `${b64url(iv)}.${b64url(ct)}`;
}
export async function unseal(secret: string, sealed: string): Promise<string | null> {
  const [iv, ct] = sealed.split('.');
  if (!iv || !ct) return null;
  try {
    return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64url(iv) }, await aesKey(secret), unb64url(ct)));
  } catch { return null; }
}

// --- The sign-in's state: which club and admin started it, for 15 minutes
export async function signState(secret: string, clubId: string, userId: string, now = Date.now()): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify({ c: clubId, u: userId, e: now + 15 * 60000 })));
  return `${body}.${b64url(await hmac(secret, `state:${body}`))}`;
}
export async function readState(secret: string, state: string, now = Date.now()): Promise<{ clubId: string; userId: string } | null> {
  const [body, sig] = state.split('.');
  if (!body || !sig || !sameBytes(unb64url(sig), await hmac(secret, `state:${body}`))) return null;
  try {
    const s = JSON.parse(new TextDecoder().decode(unb64url(body)));
    return typeof s.c === 'string' && typeof s.u === 'string' && s.e > now ? { clubId: s.c, userId: s.u } : null;
  } catch { return null; }
}

/** Meta's data deletion request: "<signature>.<payload>", signed with the app secret */
export async function readSignedRequest(secret: string, signed: string): Promise<{ user_id: string } | null> {
  const [sig, payload] = signed.split('.', 2);
  if (!sig || !payload || !sameBytes(unb64url(sig), await hmac(secret, payload))) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(unb64url(payload)));
    return data?.algorithm === 'HMAC-SHA256' && typeof data.user_id === 'string' ? data : null;
  } catch { return null; }
}

export function loginUrl(cfg: MetaConfig, state: string): string {
  const p = new URLSearchParams({ client_id: cfg.appId, redirect_uri: META_REDIRECT, state, response_type: 'code' });
  if (cfg.configId) p.set('config_id', cfg.configId);
  else p.set('scope', META_SCOPES.join(','));
  return `https://www.facebook.com/v25.0/dialog/oauth?${p}`;
}

export class MetaError extends Error {}

async function graph<T = Record<string, unknown>>(cfg: MetaConfig, path: string, opts: { token?: string; post?: boolean; params?: Record<string, string> } = {}): Promise<T> {
  const p = new URLSearchParams(opts.params);
  if (opts.token) {
    p.set('access_token', opts.token);
    // Proves the call comes from our server, should the app require it
    p.set('appsecret_proof', Buffer.from(await hmac(cfg.secret, opts.token)).toString('hex'));
  }
  // Facebook can be slow to fetch a picture; never leave the admin waiting for ever
  const res = await fetch(opts.post ? `${GRAPH}${path}` : `${GRAPH}${path}?${p}`, { ...(opts.post ? { method: 'POST', body: p } : {}), signal: AbortSignal.timeout(30000) })
    .catch(e => { throw new MetaError((e as Error).name === 'TimeoutError' ? 'Facebook took too long to answer.' : "Couldn't reach Facebook."); });
  const data = await res.json().catch(() => ({})) as { error?: { message?: string } };
  if (!res.ok || data.error) throw new MetaError(data.error?.message || `Facebook didn't answer (${res.status}).`);
  return data as T;
}

export interface MetaPage { id: string; name: string; token: string; igId?: string; igUsername?: string }
/** A sign-in with Facebook waiting for its admin to pick the Page (social_accounts.pending_enc) */
export interface MetaPending { fbUserId: string; nonce: string; pages: MetaPage[] }

/** From the sign-in's code: who signed in, and the Pages they can post to (Page tokens that don't expire) */
export async function pagesFromCode(cfg: MetaConfig, code: string): Promise<{ fbUserId: string; pages: MetaPage[] }> {
  const short = await graph<{ access_token: string }>(cfg, '/oauth/access_token',
    { params: { client_id: cfg.appId, client_secret: cfg.secret, redirect_uri: META_REDIRECT, code } });
  // Page tokens fetched with a long-lived user token don't expire
  const long = await graph<{ access_token: string }>(cfg, '/oauth/access_token',
    { params: { grant_type: 'fb_exchange_token', client_id: cfg.appId, client_secret: cfg.secret, fb_exchange_token: short.access_token } });
  const me = await graph<{ id: string }>(cfg, '/me', { token: long.access_token, params: { fields: 'id' } });
  const list = await graph<{ data?: { id: string; name: string; access_token: string; tasks?: string[]; instagram_business_account?: { id: string; username?: string } }[] }>(
    cfg, '/me/accounts', { token: long.access_token, params: { fields: 'id,name,access_token,tasks,instagram_business_account{id,username}', limit: '100' } });
  const pages = (list.data || [])
    .filter(p => p.access_token && (!p.tasks || p.tasks.includes('CREATE_CONTENT')))
    .map(p => ({ id: p.id, name: p.name.slice(0, 200), token: p.access_token, igId: p.instagram_business_account?.id, igUsername: p.instagram_business_account?.username?.slice(0, 100) }));
  return { fbUserId: me.id, pages };
}

/** A photo post on the Page; returns its post id */
export async function postPagePhoto(cfg: MetaConfig, pageId: string, token: string, imageUrl: string, caption: string): Promise<string> {
  const r = await graph<{ id: string; post_id?: string }>(cfg, `/${pageId}/photos`, { token, post: true, params: { url: imageUrl, caption } });
  return r.post_id || r.id;
}

/** An Instagram feed post (or a Story, which has no caption); returns the media id */
export async function postInstagram(cfg: MetaConfig, igId: string, token: string, imageUrl: string, caption: string, story: boolean): Promise<string> {
  const box = await graph<{ id: string }>(cfg, `/${igId}/media`, {
    token, post: true, params: story ? { image_url: imageUrl, media_type: 'STORIES' } : { image_url: imageUrl, caption },
  });
  // Instagram fetches the picture first; a JPEG is usually ready within seconds
  for (let i = 0; i < 10; i++) {
    const s = await graph<{ status_code?: string }>(cfg, `/${box.id}`, { token, params: { fields: 'status_code' } });
    if (s.status_code === 'FINISHED') break;
    if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') throw new MetaError("Instagram couldn't use the picture.");
    await new Promise(r => setTimeout(r, 2000));
  }
  const done = await graph<{ id: string }>(cfg, `/${igId}/media_publish`, { token, post: true, params: { creation_id: box.id } });
  return done.id;
}
