import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { collectHealth } from '@/lib/platform-health';
import { logEvent } from '@/lib/platform-events';
import { sendEmail } from '@/lib/email/send';
import { SITE_URL } from '@/lib/slugs';
import { isCloudflareConfigured, removeHostname } from '@/lib/cloudflare';

// Hourly health check, triggered by the Cloudflare cron in worker.ts (or by hand: POST with
// "Authorization: Bearer $CRON_SECRET", or "Run now" in Mission Control -> System health).
// Emails the platform Super admins and Operators when a light turns red, at most once every
// 12 hours per light. Also clears platform_events rows older than 60 days, and deletes clubs closed
// more than 30 days ago (purge_closed_clubs), releasing their custom domains.

const REPEAT_HOURS = 12;
const KEEP_DAYS = 60;

/** Equal-time string compare, so the secret can't be guessed byte by byte from response timing */
function sameSecret(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  if (!sameSecret(req.headers.get('authorization') || '', `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const report = await collectHealth(db, { domains: false });
  // This job's own lateness is old news once it runs again
  const red = report.signals.filter(s => s.light === 'red' && s.key !== 'job:health');

  // Lights already emailed about recently
  const { data: recent } = await db.from('platform_events').select('name').eq('kind', 'alert')
    .gte('created_at', new Date(Date.now() - REPEAT_HOURS * 3600000).toISOString());
  const told = new Set((recent || []).map(r => r.name));
  const fresh = red.filter(s => !told.has(s.key));

  let emailed = 0;
  if (fresh.length) {
    const { data: admins } = await db.from('platform_admins').select('email').eq('is_active', true).in('role', ['super_admin', 'operator']);
    const to = [...new Set((admins || []).map(a => String(a.email || '').toLowerCase()))].filter(Boolean);
    if (!to.length && process.env.SUPPORT_EMAIL) to.push(process.env.SUPPORT_EMAIL);
    const lines = fresh.map(s => `- ${s.label}: ${s.summary}`);
    const text = `Something needs a look on itsfootball.club:\n\n${lines.join('\n')}\n\nOpen System health: ${SITE_URL}/admin/platform`;
    for (const addr of to) {
      const sent = await sendEmail({
        to: addr,
        subject: `[itsfootball.club] ${fresh.length === 1 ? fresh[0].label : `${fresh.length} problems`} need a look`,
        text,
        html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;white-space:pre-wrap">${text.replace(/[&<>]/g, c => `&#${c.charCodeAt(0)};`)}</div>`,
      });
      if (sent.ok) emailed++;
    }
    if (emailed) await Promise.all(fresh.map(s => logEvent('alert', s.key, true, { summary: s.summary })));
  }

  await db.from('platform_events').delete().lt('created_at', new Date(Date.now() - KEEP_DAYS * 86400000).toISOString());

  // Clubs closed more than 30 days ago go for good (payments stay, see migration 20261148)
  const { data: purged, error: purgeError } = await db.rpc('purge_closed_clubs');
  if (purgeError) console.error('[health] purge failed:', purgeError.message);
  const gone = (purged || []) as { id: string; name: string; custom_domain: string | null }[];
  for (const c of gone) {
    if (c.custom_domain && isCloudflareConfigured()) {
      await removeHostname(c.custom_domain).catch(e => console.error('[health] domain not released:', c.custom_domain, (e as Error).message));
    }
  }

  const body = { red: red.map(s => s.key), alerted: fresh.map(s => s.key), emailed, deletedClubs: gone.map(c => ({ id: c.id, name: c.name })), ...(purgeError ? { purgeError: purgeError.message } : {}) };
  await logEvent('cron', 'health', true, body);
  return NextResponse.json(body);
}
