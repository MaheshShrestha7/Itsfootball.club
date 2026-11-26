import { AwsClient } from 'aws4fetch';

// Cloudflare R2 over its S3 API, signed with aws4fetch. Not the AWS SDK: its Node build reads
// ~/.aws config files with fs.readFile, which Workers don't have ("[unenv] fs.readFile is not implemented").

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME || 'itsfootball-assets';
const publicDomain = process.env.R2_PUBLIC_DOMAIN;
// Bucket with no public domain, for receipts and other private files
const privateBucketName = process.env.R2_PRIVATE_BUCKET;
// Leave unset in production; lets the R2 code be tested against a local S3-compatible server
const endpoint = (process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`).replace(/\/$/, '');

export const isR2Configured = Boolean(
  accountId &&
  accessKeyId &&
  secretAccessKey &&
  !accountId.includes('your-cloudflare')
);

/** An R2 error response: `name` is R2's code (NoSuchBucket, AccessDenied, ...), `status` the HTTP status */
export class R2Error extends Error {
  constructor(public name: string, message: string, public status: number) {
    super(message);
  }
}

let r2Client: AwsClient | null = null;
function client(): AwsClient | null {
  if (!isR2Configured) return null;
  r2Client ??= new AwsClient({ accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey!, service: 's3', region: 'auto' });
  return r2Client;
}

function objectUrl(bucket: string, key = ''): URL {
  const path = key.split('/').map(encodeURIComponent).join('/');
  return new URL(`${endpoint}/${bucket}/${path}`);
}

function xmlText(xml: string, tag: string): string | undefined {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m ? unescapeXml(m[1]) : undefined;
}

function unescapeXml(s: string): string {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

async function send(url: URL, init: RequestInit): Promise<Response> {
  const c = client();
  if (!c) throw new R2Error('NotConfigured', 'R2 is not configured', 0);
  const res = await c.fetch(url.toString(), init);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new R2Error(xmlText(body, 'Code') || `HTTP${res.status}`, xmlText(body, 'Message') || res.statusText, res.status);
  }
  return res;
}

/**
 * Direct server-side upload of a buffer to Cloudflare R2. Null (callers then use Supabase Storage) when R2
 * or its public address isn't set: the bucket's own r2.cloudflarestorage.com address never loads in a browser.
 */
export async function uploadBufferToR2(key: string, buffer: Buffer | Uint8Array, contentType: string): Promise<string | null> {
  if (!client()) return null;
  if (!publicDomain) {
    console.error('R2_PUBLIC_DOMAIN is not set; storing in Supabase instead of R2');
    return null;
  }
  await send(objectUrl(bucketName, key), { method: 'PUT', body: buffer as BodyInit, headers: { 'Content-Type': contentType } });
  return `${publicDomain.replace(/\/$/, '')}/${key}`;
}

/** Delete an object from the public bucket; false when R2 isn't configured */
export async function deleteR2Object(key: string): Promise<boolean> {
  if (!client()) return false;
  await send(objectUrl(bucketName, key), { method: 'DELETE' });
  return true;
}

/**
 * Generate standard object storage path for club achievement badges
 */
export function getBadgeStorageKey(clubId: string, badgeId: string, extension = 'svg'): string {
  return `clubs/${clubId}/badges/${badgeId}.${extension}`;
}

export const isR2PrivateConfigured = isR2Configured && Boolean(privateBucketName);

/** Upload to the private bucket; returns the key, or null when it isn't configured */
export async function putPrivateObject(key: string, body: Uint8Array, contentType: string): Promise<string | null> {
  if (!client() || !privateBucketName) return null;
  await send(objectUrl(privateBucketName, key), { method: 'PUT', body: body as BodyInit, headers: { 'Content-Type': contentType } });
  return key;
}

/** Whether the private bucket holds `key` (false when it isn't configured or the object is missing) */
export async function privateObjectExists(key: string): Promise<boolean> {
  if (!client() || !privateBucketName) return false;
  try {
    await send(objectUrl(privateBucketName, key), { method: 'HEAD' });
    return true;
  } catch (e) {
    if (e instanceof R2Error && e.status === 404) return false;
    throw e;
  }
}

/** Short-lived download link for a private object */
export async function getPrivateObjectUrl(key: string, expiresIn = 300): Promise<string | null> {
  const c = client();
  if (!c || !privateBucketName) return null;
  const url = objectUrl(privateBucketName, key);
  url.searchParams.set('X-Amz-Expires', String(expiresIn));
  const signed = await c.sign(url.toString(), { method: 'GET', aws: { signQuery: true } });
  return signed.url;
}

/** The parts of a ListObjectsV2 reply we use */
export function parseListXml(xml: string): { prefixes: string[]; files: { key: string; size: number }[]; next?: string } {
  const prefixes = [...xml.matchAll(/<CommonPrefixes>([\s\S]*?)<\/CommonPrefixes>/g)]
    .map(m => xmlText(m[1], 'Prefix') || '').filter(Boolean);
  const files = [...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)]
    .map(m => ({ key: xmlText(m[1], 'Key') || '', size: Number(xmlText(m[1], 'Size') || 0) }))
    .filter(f => f.key);
  const next = xmlText(xml, 'IsTruncated') === 'true' ? xmlText(xml, 'NextContinuationToken') : undefined;
  return { prefixes, files, next };
}

async function listPages(prefix: string, delimiter?: string, bucket = bucketName) {
  const out: ReturnType<typeof parseListXml>[] = [];
  let token: string | undefined;
  do {
    const url = objectUrl(bucket);
    url.searchParams.set('list-type', '2');
    url.searchParams.set('prefix', prefix);
    if (delimiter) url.searchParams.set('delimiter', delimiter);
    if (token) url.searchParams.set('continuation-token', token);
    const page = parseListXml(await (await send(url, { method: 'GET' })).text());
    out.push(page);
    token = page.next;
  } while (token);
  return out;
}

/** The "folders" directly under `prefix` in the public bucket ('clubs/' -> ['clubs/<id>/', ...]) */
export async function listR2Folders(prefix: string): Promise<string[]> {
  if (!client()) return [];
  return (await listPages(prefix, '/')).flatMap(p => p.prefixes);
}

/** Every file under `prefix` in the public bucket (or the private one), with its size in bytes */
export async function listR2Files(prefix: string, priv = false): Promise<{ key: string; size: number }[]> {
  if (!client() || (priv && !privateBucketName)) return [];
  return (await listPages(prefix, undefined, priv ? privateBucketName : bucketName)).flatMap(p => p.files);
}

/** Size in bytes of an object in the public (or private) bucket; null when it isn't there */
export async function r2ObjectSize(key: string, priv = false): Promise<number | null> {
  const bucket = priv ? privateBucketName : bucketName;
  if (!client() || !bucket) return null;
  try {
    const res = await send(objectUrl(bucket, key), { method: 'HEAD' });
    return Number(res.headers.get('content-length') || 0);
  } catch (e) {
    if (e instanceof R2Error && e.status === 404) return null;
    throw e;
  }
}

/** Where public files are served from ('https://media.example.com/'); null when R2_PUBLIC_DOMAIN isn't set */
export function r2PublicBase(): string | null {
  return publicDomain ? `${publicDomain.replace(/\/$/, '')}/` : null;
}

/** The bucket's API address, which browsers can't open: links saved with it (before R2_PUBLIC_DOMAIN was set) need fixing */
export function r2ApiBase(): string {
  return `https://${bucketName}.${accountId}.r2.cloudflarestorage.com/`;
}
