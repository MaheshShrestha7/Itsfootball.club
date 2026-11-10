import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/supabase/server-auth';
import { getServiceClient } from '@/lib/supabase/service';
import { collectHealth } from '@/lib/platform-health';
import { JOBS as JOB_INFO } from '@/lib/mission-control';
import { logPlatformAction } from '@/lib/platform-audit';
import { POST as runReminders } from '@/app/api/cron/reminders/route';
import { POST as runIndexNow } from '@/app/api/cron/indexnow/route';
import { POST as runHealth } from '@/app/api/cron/health/route';

// Mission Control -> System health (components/admin/platform/HealthTab.tsx).
//   GET  [?quick=1]           the traffic lights and recent email failures (quick: skip the
//                             Cloudflare domain lookups, for the Today tab)
//   POST { job }              run a scheduled job now (reminders | indexnow | health). Operators
//                             and Super admins. Calls the job's handler directly, as the cron does.

const JOBS = { reminders: runReminders, indexnow: runIndexNow, health: runHealth } as const;

export async function GET(req: NextRequest) {
  const auth = await requirePlatformAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: 'Health checks are not configured on the server.' }, { status: 503 });
  try {
    return NextResponse.json(await collectHealth(db, { domains: req.nextUrl.searchParams.get('quick') !== '1' }));
  } catch (e) {
    console.error('[platform/health]', (e as Error).message);
    return NextResponse.json({ error: 'Could not check health. Has migration 20261147 been run?' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePlatformAdmin(req, true);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const input = await req.json().catch(() => null);
  const name = input?.job as keyof typeof JOBS;
  const run = JOBS[name];
  if (!run) return NextResponse.json({ error: 'Unknown job.' }, { status: 400 });
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not set on the server.' }, { status: 503 });

  const res = await run(new NextRequest(new URL(`/api/cron/${name}`, req.url), {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}` },
  }));
  const body = await res.json().catch(() => ({}));
  const db = getServiceClient();
  if (db) {
    await logPlatformAction(db, auth, {
      action: 'job_run', table: 'platform_events',
      summary: `Ran "${JOB_INFO[name]?.label || name}" by hand${res.ok ? '' : ' (it failed)'}`,
      details: { job: name, status: res.status },
    });
  }
  return NextResponse.json({ ok: res.ok, status: res.status, result: body }, { status: res.ok ? 200 : 502 });
}
