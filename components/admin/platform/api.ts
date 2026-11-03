import { getAccessToken } from '@/lib/supabase/client';

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
