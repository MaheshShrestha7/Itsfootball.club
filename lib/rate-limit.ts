// In-memory sliding-window rate limiter for API routes.
//
// This is best-effort: state lives in the server instance's memory, so on a
// multi-isolate edge deployment (Cloudflare Workers) an attacker spread across
// isolates sees a higher effective limit than configured here. It still stops
// naive floods from a single client/isolate. Where a hard, deployment-topology
// -independent ceiling matters (e.g. contact form spam), pair this with a
// durable check enforced in Postgres, which is centralized regardless of how
// many edge instances are running: durableRateLimit() below does that.

import { getServiceClient } from '@/lib/supabase/service';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Caps how large this Map can grow over a long-lived instance's lifetime.
const MAX_TRACKED_KEYS = 5000;

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    if (buckets.size >= MAX_TRACKED_KEYS) {
      const oldestKey = buckets.keys().next().value;
      if (oldestKey !== undefined) buckets.delete(oldestKey);
    }
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return { allowed: true, remaining: limit - existing.count, resetAt: existing.resetAt };
}

/**
 * rateLimit() plus a Postgres counter shared by every isolate (hit_rate_limit, migration
 * 20261015). The in-memory check runs first so floods don't reach the database. If the
 * database can't be asked (not configured, migration not run), the in-memory answer stands.
 */
export async function durableRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  if (!rateLimit(key, limit, windowMs).allowed) return false;
  const db = getServiceClient();
  if (!db) return true;
  const { data, error } = await db.rpc('hit_rate_limit', {
    p_key: key,
    p_limit: limit,
    p_window_seconds: Math.ceil(windowMs / 1000),
  });
  if (error) {
    console.error('[rate-limit] hit_rate_limit failed:', error.message);
    return true;
  }
  return data === true;
}

export function getClientIp(headers: Headers): string {
  return (
    headers.get('cf-connecting-ip') ||
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  );
}
