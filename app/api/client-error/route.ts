import { NextRequest, NextResponse } from 'next/server';
import { durableRateLimit, getClientIp } from '@/lib/rate-limit';
import { logEvent } from '@/lib/platform-events';

// A page crashed for a visitor (app/error.tsx, app/global-error.tsx). Saved to platform_events as
// kind 'error' (migration 20261149) for Mission Control's Overview. Only the page and the error
// message are kept, never who it was. Before that migration the insert fails quietly.
export async function POST(req: NextRequest) {
  if (!(await durableRateLimit(`client-error:${getClientIp(req.headers)}`, 10, 10 * 60 * 1000))) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
  const path = text(body?.path, 255);
  if (!path.startsWith('/')) return NextResponse.json({ ok: false }, { status: 400 });
  await logEvent('error', text(body?.where, 20) === 'global' ? 'global' : 'page', false, {
    path,
    message: text(body?.message, 300),
    digest: text(body?.digest, 64) || undefined,
  });
  return NextResponse.json({ ok: true });
}
