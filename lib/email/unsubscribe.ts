// Signed unsubscribe links: the token is an HMAC of (club, email), so a link only works for the
// address it was sent to and can't be forged for someone else. Keyed on CRON_SECRET (already a
// server secret); rotating it makes old links show "invalid link", nothing worse.
import { SITE_URL } from '@/lib/seo';

const b64url = (bytes: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>;

const message = (clubId: string, email: string) => new TextEncoder().encode(`unsubscribe:${clubId}:${email.trim().toLowerCase()}`);

async function hmacKey(usage: 'sign' | 'verify', secret = process.env.CRON_SECRET) {
  if (!secret) return null;
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage]);
}

export async function unsubscribeToken(clubId: string, email: string, secret?: string): Promise<string | null> {
  const key = await hmacKey('sign', secret);
  return key ? b64url(await crypto.subtle.sign('HMAC', key, message(clubId, email))) : null;
}

export async function verifyUnsubscribeToken(clubId: string, email: string, token: string, secret?: string): Promise<boolean> {
  const key = await hmacKey('verify', secret);
  if (!key || !token) return false;
  try {
    return await crypto.subtle.verify('HMAC', key, fromB64url(token), message(clubId, email));
  } catch {
    return false;
  }
}

/** Page link for the email footer, and the one-click URL for the List-Unsubscribe header */
export async function unsubscribeLinks(clubId: string, email: string) {
  const token = await unsubscribeToken(clubId, email);
  if (!token) return null;
  const query = `c=${encodeURIComponent(clubId)}&e=${encodeURIComponent(email.trim().toLowerCase())}&t=${token}`;
  return { page: `${SITE_URL}/unsubscribe?${query}`, oneClick: `${SITE_URL}/api/email/unsubscribe?${query}` };
}

/** Headers that give Gmail / Outlook their own "Unsubscribe" button (RFC 8058 one-click) */
export const unsubscribeHeaders = (oneClick: string) => ({
  'List-Unsubscribe': `<${oneClick}>`,
  'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
});
