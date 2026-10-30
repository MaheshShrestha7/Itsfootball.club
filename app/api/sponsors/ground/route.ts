import { NextRequest, NextResponse } from 'next/server';
import { durableRateLimit, getClientIp } from '@/lib/rate-limit';
import { getServiceClient } from '@/lib/supabase/service';
import { isGroundPlace } from '@/lib/sponsors';
import { loadGroundSponsors } from '@/lib/sponsor-ground-server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/sponsors/ground?club=<id>&place=<checkin_posters|event_tickets|checkin_screen>&event=<id>
// The sponsors whose package includes that place, for the check-in poster, tickets and check-in
// screen. Public: it only returns sponsors already on the club's site, with their name and logo.
export async function GET(req: NextRequest) {
  const ip = getClientIp(req.headers);
  if (!(await durableRateLimit(`sponsor-ground:${ip}`, 300, 5 * 60 * 1000))) {
    return NextResponse.json({ sponsors: [] }, { status: 429 });
  }
  const params = req.nextUrl.searchParams;
  const clubId = params.get('club') || '';
  const place = params.get('place');
  const eventId = params.get('event');
  if (!UUID_RE.test(clubId) || !isGroundPlace(place) || (eventId && !UUID_RE.test(eventId))) {
    return NextResponse.json({ sponsors: [] }, { status: 400 });
  }
  const db = getServiceClient();
  if (!db) return NextResponse.json({ sponsors: [] }, { status: 503 });
  const { data: club } = await db.from('clubs').select('id').eq('id', clubId).eq('is_active', true).maybeSingle();
  if (!club) return NextResponse.json({ sponsors: [] }, { status: 404 });
  const sponsors = await loadGroundSponsors(db, clubId, place, eventId);
  return NextResponse.json({ sponsors }, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' } });
}
