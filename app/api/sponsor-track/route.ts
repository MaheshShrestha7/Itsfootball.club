import { NextRequest, NextResponse } from 'next/server';
import { durableRateLimit, getClientIp } from '@/lib/rate-limit';
import { getServiceClient } from '@/lib/supabase/service';

const EVENT_TYPES = new Set(['impression', 'viewable_impression', 'click']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The only way into sponsor_analytics (the public key can no longer insert, migration 20261015),
// so the figures clubs show their sponsors can't be padded around this limit.
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req.headers);
    // Generous limit: a single page view can fire an impression + viewable_impression
    // per sponsor shown, plus the occasional click.
    if (!(await durableRateLimit(`sponsor-track:${ip}`, 120, 5 * 60 * 1000))) {
      return NextResponse.json({ success: false }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false }, { status: 400 });
    }

    const clubId = typeof body.club_id === 'string' ? body.club_id : '';
    const sponsorId = typeof body.sponsor_id === 'string' ? body.sponsor_id : '';
    const eventType = typeof body.event_type === 'string' ? body.event_type : '';
    if (!UUID_RE.test(clubId) || !UUID_RE.test(sponsorId) || !EVENT_TYPES.has(eventType)) {
      return NextResponse.json({ success: false }, { status: 400 });
    }

    const placement = typeof body.placement === 'string' ? body.placement.slice(0, 64) : null;
    const device = typeof body.device === 'string' ? body.device.slice(0, 16) : null;
    const visitorHash = typeof body.visitor_hash === 'string' ? body.visitor_hash.slice(0, 64) : null;
    const dwellMs =
      eventType === 'viewable_impression' && typeof body.dwell_ms === 'number' && Number.isFinite(body.dwell_ms)
        ? Math.max(0, Math.min(600000, Math.round(body.dwell_ms)))
        : null;

    // Resolved from the CDN's geo header, not the client, so it can't be spoofed.
    const country =
      req.headers.get('cf-ipcountry') ||
      req.headers.get('x-vercel-ip-country') ||
      null;

    const client = getServiceClient();
    if (!client) {
      return NextResponse.json({ success: false }, { status: 503 });
    }

    // What the old insert policy checked: an active sponsor of this (active) club
    const { data: sponsor } = await client
      .from('sponsors')
      .select('id, clubs!inner(is_active)')
      .eq('id', sponsorId)
      .eq('club_id', clubId)
      .eq('is_active', true)
      .eq('clubs.is_active', true)
      .maybeSingle();
    if (!sponsor) {
      return NextResponse.json({ success: false }, { status: 404 });
    }

    const { error } = await client.from('sponsor_analytics').insert({
      club_id: clubId,
      sponsor_id: sponsorId,
      event_type: eventType,
      placement,
      device,
      country,
      visitor_hash: visitorHash,
      dwell_ms: dwellMs,
    });

    if (error) {
      return NextResponse.json({ success: false }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
