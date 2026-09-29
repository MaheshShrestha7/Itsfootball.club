// Cloudflare for SaaS custom hostnames: each club domain is registered on our zone, and Cloudflare
// issues its certificate once the club's CNAME points at us (see docs/custom-domains.md).
// Server only: needs CF_HOSTNAMES_TOKEN (Zone > SSL and Certificates > Edit) and CF_ZONE_ID.

export interface CustomHostname {
  id: string;
  hostname: string;
  /** 'active' once the CNAME is found; 'pending' until then */
  status: string;
  ssl?: { status?: string };
}

interface CfResponse<T> {
  success: boolean;
  errors?: { code: number; message: string }[];
  result: T;
}

export const isCloudflareConfigured = () => Boolean(process.env.CF_HOSTNAMES_TOKEN && process.env.CF_ZONE_ID);

async function cf<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${process.env.CF_ZONE_ID}/custom_hostnames${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.CF_HOSTNAMES_TOKEN}`, 'Content-Type': 'application/json' },
  });
  const json = (await res.json().catch(() => null)) as CfResponse<T> | null;
  if (!json?.success) throw new Error(`Cloudflare ${res.status}: ${json?.errors?.map(e => e.message).join('; ') || 'no response'}`);
  return json.result;
}

export async function findHostname(hostname: string): Promise<CustomHostname | null> {
  const list = await cf<CustomHostname[]>(`?hostname=${encodeURIComponent(hostname)}`);
  return list.find(h => h.hostname === hostname) ?? null;
}

/** Registers the hostname (or returns it if it already is) */
export async function addHostname(hostname: string): Promise<CustomHostname> {
  return (await findHostname(hostname)) ??
    cf<CustomHostname>('', { method: 'POST', body: JSON.stringify({ hostname, ssl: { method: 'http', type: 'dv' } }) });
}

export async function removeHostname(hostname: string): Promise<void> {
  const found = await findHostname(hostname);
  if (found) await cf(`/${found.id}`, { method: 'DELETE' });
}

/** Live only when both the hostname and its certificate are active */
export const isLive = (h: CustomHostname | null) => h?.status === 'active' && h.ssl?.status === 'active';
