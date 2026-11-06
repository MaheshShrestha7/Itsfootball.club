import type { SupabaseClient } from '@supabase/supabase-js';
import { findHostname, isCloudflareConfigured, isLive } from '@/lib/cloudflare';
import { healthSignals, JOBS, type HealthInput, type HealthSignal, type JobRun } from '@/lib/mission-control';

// Gathers what Mission Control's Health tab and the hourly alert job (/api/cron/health) look at.
// Server-only: `db` is the service-role client. The lights themselves are healthSignals().

export interface EmailFailure { at: string; to: string[]; subject: string; error: string; count: number }

export interface HealthReport {
  checkedAt: string;
  signals: HealthSignal[];
  failures: EmailFailure[];
}

const DAY_MS = 86400000;

export async function collectHealth(db: SupabaseClient, opts: { domains: boolean }): Promise<HealthReport> {
  const since = new Date(Date.now() - DAY_MS).toISOString();

  const { ms: dbMs, error: dbError } = await timeDatabase(db);

  const [sent, failed, stripeAll, stripeBad, stripeLast, connected, needDetails, jobs, domains] = await Promise.all([
    db.from('email_log').select('key', { count: 'exact', head: true }).gte('sent_at', since),
    db.from('platform_events').select('detail, created_at').eq('kind', 'email').eq('ok', false).gte('created_at', since)
      .order('created_at', { ascending: false }).limit(200),
    db.from('platform_events').select('id', { count: 'exact', head: true }).eq('kind', 'stripe').gte('created_at', since),
    db.from('platform_events').select('id', { count: 'exact', head: true }).eq('kind', 'stripe').eq('ok', false).gte('created_at', since),
    db.from('platform_events').select('created_at').eq('kind', 'stripe').order('created_at', { ascending: false }).limit(1),
    db.from('club_payment_settings').select('club_id', { count: 'exact', head: true }).not('stripe_account_id', 'is', null),
    db.from('club_payment_settings').select('club_id', { count: 'exact', head: true }).not('stripe_account_id', 'is', null).eq('stripe_charges_enabled', false),
    Promise.all(Object.keys(JOBS).map(async (name): Promise<JobRun> => {
      const [last, lastOk] = await Promise.all([
        db.from('platform_events').select('ok, created_at').eq('kind', 'cron').eq('name', name).order('created_at', { ascending: false }).limit(1),
        db.from('platform_events').select('created_at').eq('kind', 'cron').eq('name', name).eq('ok', true).order('created_at', { ascending: false }).limit(1),
      ]);
      return { name, lastAt: last.data?.[0]?.created_at ?? null, lastOk: last.data?.[0]?.ok ?? null, lastOkAt: lastOk.data?.[0]?.created_at ?? null };
    })),
    opts.domains ? checkDomains(db) : Promise.resolve(null),
  ]);

  const failures = (failed.data || []).map(r => {
    const d = (r.detail || {}) as { to?: string[]; subject?: string; error?: string; count?: number };
    return { at: r.created_at as string, to: d.to || [], subject: d.subject || '', error: d.error || '', count: Number(d.count) || 1 };
  });

  const input: HealthInput = {
    emailsSent24: sent.count || 0,
    emailsFailed24: failures.reduce((n, f) => n + f.count, 0),
    jobs,
    stripe: {
      events24: stripeAll.count || 0,
      failed24: stripeBad.count || 0,
      lastAt: stripeLast.data?.[0]?.created_at ?? null,
      connected: connected.count || 0,
      needDetails: needDetails.count || 0,
    },
    domains,
    dbMs,
    dbError,
  };
  return { checkedAt: new Date().toISOString(), signals: healthSignals(input), failures: failures.slice(0, 50) };
}

const DB_SAMPLES = 3;

/**
 * How fast the database answers a tiny query, as the best of a few tries one after another.
 * The first try in a freshly started worker also pays for opening the connection (DNS and TLS
 * to Supabase), which alone can take a second; one slow try is noise, all of them slow is real.
 * Any error means the database didn't answer, which is reported as such and never as "fast".
 */
export async function timeDatabase(db: SupabaseClient, samples = DB_SAMPLES): Promise<{ ms: number; error: string | null }> {
  let best = Infinity;
  for (let n = 0; n < samples; n++) {
    const t0 = Date.now();
    const { error } = await db.from('platform_events').select('id').limit(1);
    if (error) return { ms: Date.now() - t0, error: error.message || 'Unknown error' };
    best = Math.min(best, Date.now() - t0);
  }
  return { ms: best, error: null };
}

/** Each club domain's Cloudflare status; null when Cloudflare isn't set up */
async function checkDomains(db: SupabaseClient): Promise<HealthInput['domains']> {
  if (!isCloudflareConfigured()) return null;
  const { data } = await db.from('clubs').select('custom_domain').not('custom_domain', 'is', null).limit(100);
  const list = (data || []).map(c => String(c.custom_domain)).filter(Boolean);
  const live = await Promise.all(list.map(d => findHostname(d).then(isLive, () => false)));
  return { total: list.length, pending: list.filter((_, i) => !live[i]) };
}
