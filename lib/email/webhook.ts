// Standard Webhooks signature check (https://www.standardwebhooks.com), the scheme Supabase uses
// to sign auth hook calls. Web Crypto only, so it runs on Cloudflare Workers unchanged.

const TOLERANCE_SECONDS = 5 * 60;

const b64ToBytes = (b64: string) => Uint8Array.from(atob(b64), c => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>;

/**
 * True when `signatureHeader` holds a valid v1 signature of `${id}.${timestamp}.${body}` and the
 * timestamp is within 5 minutes. `secret` is as Supabase shows it: "v1,whsec_<base64>".
 */
export async function verifyWebhook(
  secret: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  body: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): Promise<boolean> {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > TOLERANCE_SECONDS) return false;

  let keyBytes: Uint8Array<ArrayBuffer>;
  try {
    keyBytes = b64ToBytes(secret.replace(/^v1,/, '').replace(/^whsec_/, ''));
  } catch {
    return false;
  }
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const signed = new TextEncoder().encode(`${id}.${timestamp}.${body}`);

  // The header can carry several space-separated "v1,<base64>" signatures (key rotation)
  for (const part of signature.split(' ')) {
    const [version, sig] = part.split(',');
    if (version !== 'v1' || !sig) continue;
    try {
      // subtle.verify compares in constant time
      if (await crypto.subtle.verify('HMAC', key, b64ToBytes(sig), signed)) return true;
    } catch {
      // malformed base64 in this entry: try the next one
    }
  }
  return false;
}
