import { getServiceClient } from '@/lib/supabase/service';

// Writes a row to platform_events (migration 20261147) for Mission Control's Health tab.
// Server-only. Never throws and never blocks the caller's real work on failure: health logging
// must not break sending an email or handling a webhook.

export type EventKind = 'cron' | 'email' | 'stripe' | 'alert';

export async function logEvent(kind: EventKind, name: string, ok: boolean, detail: Record<string, unknown> = {}): Promise<void> {
  const db = getServiceClient();
  if (!db) return;
  try {
    const { error } = await db.from('platform_events').insert({ kind, name: name.slice(0, 100), ok, detail });
    if (error) console.warn('[platform-events] not logged:', error.message);
  } catch (e) {
    console.warn('[platform-events] not logged:', (e as Error).message);
  }
}
