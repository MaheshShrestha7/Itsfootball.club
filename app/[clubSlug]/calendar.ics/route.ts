import { NextRequest, NextResponse } from 'next/server';
import { findClubBySlug, listCalendarData } from '@/lib/supabase/club-lookup';
import { buildCalendar } from '@/lib/calendar';
import { SITE_URL } from '@/lib/slugs';

const HISTORY_DAYS = 120;

// /{club}/calendar.ics: the club's fixtures and public events, for calendar apps to subscribe to
// (webcal://). Public data only, read with the public key, so RLS decides what's in it.
// ?match={fixture id}: that one fixture, as a file to open (the "Add to calendar" link in emails).
export async function GET(req: NextRequest, { params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  const club = await findClubBySlug(clubSlug);
  if (!club) return new NextResponse('Club not found', { status: 404 });

  const since = new Date(Date.now() - HISTORY_DAYS * 86400000).toISOString();
  const { matches, events } = await listCalendarData(club.id, since);
  const one = req.nextUrl.searchParams.get('match');
  const match = one ? matches.find(m => m.id === one) : null;
  if (one && !match) return new NextResponse('Fixture not found', { status: 404 });
  const body = match
    ? buildCalendar({ clubName: club.name, baseUrl: `${SITE_URL}/${club.slug}`, matches: [match], events: [] })
    : buildCalendar({ clubName: club.name, baseUrl: `${SITE_URL}/${club.slug}`, matches, events });
  const file = match ? `${club.slug}-match` : club.slug;

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `${match ? 'attachment' : 'inline'}; filename="${file}.ics"`,
      // Calendar apps poll; an hour matches the feed's own REFRESH-INTERVAL
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
