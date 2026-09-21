import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { defaultSeasonLabel } from '@/lib/season';

// Server-side secure Supabase client initialization
function getServerSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Public figures only, so use the public key and let row-level security apply
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ clubSlug: string }> }
) {
  try {
    const { clubSlug } = await context.params;
    if (!clubSlug) {
      return NextResponse.json({ error: 'Club slug is required' }, { status: 400 });
    }

    const cleanSlug = decodeURIComponent(clubSlug).toLowerCase().trim();
    const supabase = getServerSupabaseClient();

    if (!supabase) {
      return NextResponse.json(
        {
          success: false,
          error: 'Supabase client is not configured',
          source: 'unconfigured',
        },
        { status: 200 }
      );
    }

    // 1. Resolve club by slug, previous_slugs alias, or id
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanSlug);
    let club: any = null;

    if (isUuid) {
      const { data } = await supabase.from('clubs').select('*').eq('id', cleanSlug).maybeSingle();
      club = data;
    }

    if (!club) {
      const { data } = await supabase.from('clubs').select('*').ilike('slug', cleanSlug).maybeSingle();
      club = data;
    }

    // Check previous slugs alias fallback
    if (!club) {
      const { data: allClubs } = await supabase.from('clubs').select('*');
      if (allClubs) {
        club = allClubs.find(c =>
          c.slug?.toLowerCase() === cleanSlug ||
          (Array.isArray(c.previous_slugs) && c.previous_slugs.some((p: string) => p.toLowerCase() === cleanSlug))
        ) || null;
      }
    }

    if (!club) {
      return NextResponse.json(
        {
          success: false,
          found: false,
          message: `Club with slug "${cleanSlug}" not found in Supabase`,
          source: 'supabase_not_found',
        },
        { status: 200 }
      );
    }

    const clubId = club.id;

    // 2. Approved members (public-safe view: personal details are not exposed)
    const { data: members, error: membersError } = await supabase
      .from('club_members_public')
      .select('id, role, player_position, status')
      .eq('club_id', clubId);

    const totalMembers = members ? members.length : 0;
    const totalPlayers = members
      ? members.filter(
          m =>
            (m.role && (m.role.toLowerCase() === 'player' || m.role.toLowerCase().includes('player'))) ||
            Boolean(m.player_position)
        ).length
      : 0;

    // 3. Query raw Matches table
    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select('id, competition, season, home_score, away_score, is_club_home, status')
      .eq('club_id', clubId);

    // Filter for matches that have actually been played (completed, live, or halftime)
    const playedMatches = matches
      ? matches.filter(
          m =>
            m.status === 'completed' ||
            m.status === 'live' ||
            m.status === 'halftime' ||
            m.status === 'full_time'
        )
      : [];
    const matchesPlayed = playedMatches.length;

    // Query club_seasons for the designated active current season
    let activeSeasonName: string | null = null;
    const { data: activeSeasonRow } = await supabase
      .from('club_seasons')
      .select('name')
      .eq('club_id', clubId)
      .eq('is_current', true)
      .maybeSingle();

    if (activeSeasonRow?.name) {
      activeSeasonName = activeSeasonRow.name;
    }

    // Determine current active season (e.g. from club_seasons, or latest match, or the calendar default)
    const currentSeason =
      activeSeasonName ||
      playedMatches[0]?.season ||
      matches?.[0]?.season ||
      defaultSeasonLabel();

    const currentSeasonMatches = playedMatches.filter(
      m => !m.season || m.season === currentSeason
    );

    // Sum goals scored by this club in the current season:
    // If club was home: home_score. If club was away: away_score.
    const goalsScored = currentSeasonMatches.reduce((sum, m) => {
      const scored = m.is_club_home ? (m.home_score ?? 0) : (m.away_score ?? 0);
      return sum + scored;
    }, 0);

    // 4. Query raw Events table
    const { count: eventsCount, error: eventsError } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('club_id', clubId);

    // 5. Query raw Sponsors table
    const { count: sponsorsCount, error: sponsorsError } = await supabase
      .from('sponsors')
      .select('*', { count: 'exact', head: true })
      .eq('club_id', clubId)
      .eq('is_active', true);

    // Construct response with verified arithmetic sums
    return NextResponse.json({
      success: true,
      found: true,
      source: 'supabase_raw_dataset',
      timestamp: new Date().toISOString(),
      club: {
        id: club.id,
        name: club.name,
        slug: club.slug,
        short_name: club.short_name,
        motto: club.motto || club.config?.identity?.motto || '',
        founded_year: club.config?.identity?.founded_year || club.founded_year || 2018,
        stadium_name: club.config?.identity?.stadium_name || club.stadium_name || '',
        stadium_address: club.config?.contact?.address || club.stadium_address || '',
      },
      stats: {
        totalMembers,
        totalPlayers,
        matchesPlayed,
        eventsCount: eventsCount ?? 0,
        sponsorsCount: sponsorsCount ?? 0,
        goalsScored,
        currentSeason,
      },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
      }
    });
  } catch (err: any) {
    console.error('[Identity Stats API] Unexpected handler exception:', err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Failed to fetch club identity stats',
      },
      { status: 500 }
    );
  }
}
