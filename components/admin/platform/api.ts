import { getAccessToken } from '@/lib/supabase/client';

/** Downloads a file from a Mission Control route. Returns an error message, or null when saved. */
export async function platformDownload(path: string, fallbackName: string): Promise<string | null> {
  try {
    const token = await getAccessToken();
    const res = await fetch(`/api/platform/${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) return (await res.json().catch(() => ({}))).error || `Download failed (${res.status})`;
    const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '')?.[1] || fallbackName;
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return null;
  } catch {
    return 'Network error. Check your connection and try again.';
  }
}

/** Calls a Mission Control route with the signed-in admin's token. Never throws: errors come back as `error`. */
export async function platformApi<T = Record<string, unknown>>(path: string, body?: unknown): Promise<T & { error?: string }> {
  try {
    const token = await getAccessToken();
    const res = await fetch(`/api/platform/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const json = await res.json().catch(() => ({}));
    return res.ok ? json : { ...json, error: json.error || `Request failed (${res.status})` };
  } catch {
    return { error: 'Network error. Check your connection and try again.' } as T & { error?: string };
  }
}
