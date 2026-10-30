import { NextRequest, NextResponse } from 'next/server';
import { durableRateLimit, getClientIp } from '@/lib/rate-limit';
import { getServiceClient } from '@/lib/supabase/service';
import { requireClubPerm } from '@/lib/supabase/server-auth';
import { clubBaseUrl } from '@/lib/email/club-brand';
import { SITE_URL } from '@/lib/slugs';
import { isCheckinPath, isPosterPlace, type PosterPlace } from '@/lib/sponsors';
import { loadGroundSponsors } from '@/lib/sponsor-ground-server';
import type { SupabaseClient } from '@supabase/supabase-js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Printed posters and flyers in sponsor results (OSE-9). Paper can't say who looked at it, so only
// two things are counted, for each sponsor on that poster:
//   GET  /api/sponsors/qr?c=<club>&p=<place>&e=<event>&to=<check-in path>   a scan of its QR, which
//        then forwards to the check-in page, Become a Sponsor (thank-you poster) or the event (flyer)
//   POST { club, place, event }   the club pressed Print (or Download on a flyer)
// Rows go into sponsor_analytics as 'scan' and 'print' (migration 20261139). Before it runs the
// insert fails and nothing is counted, but the QR still forwards.

/** One row per sponsor on that poster now (who is on it is worked out as the poster does) */
async function record(db: SupabaseClient, clubId: string, place: PosterPlace, eventId: string | null, eventType: 'scan' | 'print') {
  const sponsors = await loadGroundSponsors(db, clubId, place, eventId);
  if (!sponsors.length) return 0;
  const { error } = await db.from('sponsor_analytics').insert(sponsors.map(s => ({
    club_id: clubId, sponsor_id: s.id, event_type: eventType, placement: place,
  })));
  return error ? 0 : sponsors.length;
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const clubId = params.get('c') || '';
  const place = params.get('p');
  const eventId = params.get('e');
  const to = params.get('to');
  const db = getServiceClient();
  const club = db && UUID_RE.test(clubId)
    ? (await db.from('clubs').select('slug, custom_domain').eq('id', clubId).eq('is_active', true).maybeSingle()).data
    : null;
  if (!db || !club || !isPosterPlace(place) || (eventId && !UUID_RE.test(eventId))) {
    return NextResponse.redirect(club ? clubBaseUrl(club) : SITE_URL, 302);
  }

  // Only ever forwards to the club's own pages
  let target = clubBaseUrl(club);
  if (place === 'checkin_posters' && isCheckinPath(to) && to.startsWith(`/${club.slug}/`)) target = new URL(to, req.nextUrl.origin).toString();
  else if (place === 'thanks_poster') target = `${clubBaseUrl(club)}/sponsor`;
  else if (place === 'event_flyers' && eventId) target = `${clubBaseUrl(club)}/events/${eventId}`;

  // A phone that scans the same poster again within half an hour counts once
  const ip = getClientIp(req.headers);
  if (await durableRateLimit(`poster-scan:${ip}:${clubId}:${place}:${eventId || to || ''}`, 1, 30 * 60 * 1000)) {
    await record(db, clubId, place, eventId, 'scan').catch(() => 0);
  }
  return NextResponse.redirect(target, 302);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const clubId = typeof body?.club === 'string' ? body.club : '';
  const place = body?.place;
  const eventId = typeof body?.event === 'string' && body.event ? body.event : null;
  if (!UUID_RE.test(clubId) || !isPosterPlace(place) || (eventId && !UUID_RE.test(eventId))) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  // Anyone on the club's staff who can open a poster can print it
  const auth = await requireClubPerm(req, clubId, null, 'view');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!(await durableRateLimit(`poster-print:${auth.userId}`, 60, 60 * 60 * 1000))) {
    return NextResponse.json({ counted: 0 }, { status: 429 });
  }
  const db = getServiceClient();
  if (!db) return NextResponse.json({ counted: 0 }, { status: 503 });
  return NextResponse.json({ counted: await record(db, clubId, place, eventId, 'print') });
}
