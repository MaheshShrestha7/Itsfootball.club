import { NextRequest, NextResponse } from 'next/server';
import { findClubBySlug, listCalendarData } from '@/lib/supabase/club-lookup';
import { buildCalendar } from '@/lib/calendar';
import { SITE_URL } from '@/lib/slugs';

const HISTORY_DAYS = 120;

// /{club}/calendar.ics: the club's fixtures and public events, for calendar apps to subscribe to
// (webcal://). Public data only, read with the public key, so RLS decides what's in it.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const club = await findClubBySlug(clubSlug);
  if (!club) return new NextResponse('Club not found', { status: 404 });

  const since = new Date(Date.now() - HISTORY_DAYS * 86400000).toISOString();
  const { matches, events } = await listCalendarData(club.id, since);
  const body = buildCalendar({ clubName: club.name, baseUrl: `${SITE_URL}/${club.slug}`, matches, events });

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="${club.slug}.ics"`,
      // Calendar apps poll; an hour matches the feed's own REFRESH-INTERVAL
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
