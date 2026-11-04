import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { defaultSeasonLabel } from '@/lib/season';
import { countsTowardClubRecord } from '@/lib/supabase/types';
import { clubNumbers } from '@/lib/club-numbers';
import { matchScoreHidden, type HiddenScoreTeams } from '@/lib/supabase/club-lookup';

// Only what the response uses (never owner_id, email_settings and the like)
const CLUB_COLUMNS = 'id, name, slug, short_name, motto, founded_year, stadium_name, stadium_address, config';

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
      const { data } = await supabase.from('clubs').select(CLUB_COLUMNS).eq('id', cleanSlug).maybeSingle();
      club = data;
    }

    // Case-insensitive, with % and _ escaped so they can't act as wildcards
    if (!club) {
      const { data } = await supabase.from('clubs').select(CLUB_COLUMNS).ilike('slug', cleanSlug.replace(/[\\%_]/g, '\\$&')).maybeSingle();
      club = data;
    }

    // Previous slugs alias fallback
    if (!club) {
      const { data } = await supabase
        .from('clubs')
        .select(CLUB_COLUMNS)
        .contains('previous_slugs', JSON.stringify([cleanSlug]))
        .limit(1)
        .maybeSingle();
      club = data;
    }

    if (!club) {
      return NextResponse.json(
        {
          success: false,
          found: false,
          message: `Club with slug "${cleanSlug}" not found in Supabase`,
          source: 'supabase_not_found',
        },
        { status: 404 }
      );
    }

    const clubId = club.id;

    // 2. Approved members (public-safe view: personal details are not exposed)
    const { data: members } = await supabase
      .from('club_members_public')
      .select('id, role, roles, player_position, status')
      .eq('club_id', clubId);

    // 3. The club's matches, newest first (the "latest match" season fallback below reads the first row)
    const { data: matches } = await supabase
      .from('matches')
      .select('id, competition, season, match_date, status, home_score, away_score, home_penalty_score, away_penalty_score, is_club_home, tournament_id, match_type, team_id')
      .eq('club_id', clubId)
      .order('match_date', { ascending: false });

    // Query club_seasons for the designated active current season
    const { data: activeSeasonRow } = await supabase
      .from('club_seasons')
      .select('name')
      .eq('club_id', clubId)
      .eq('is_current', true)
      .maybeSingle();

    const playedFirst = (matches || []).find(
      m => countsTowardClubRecord(m) && ['completed', 'full_time', 'live', 'halftime'].includes(m.status)
    );
    // Current season: club_seasons, else the latest played game's, else the latest game's, else the calendar default
    const currentSeason =
      activeSeasonRow?.name ||
      playedFirst?.season ||
      matches?.[0]?.season ||
      defaultSeasonLabel();

    // 4. Active teams: how many there are, and which hide their scores publicly (junior rules)
    const { data: teamRows } = await supabase
      .from('club_teams')
      .select('id, is_default, hide_public_scores')
      .eq('club_id', clubId)
      .eq('is_active', true);
    const hiddenTeams: HiddenScoreTeams = {
      hidden: new Set((teamRows || []).filter(t => t.hide_public_scores).map(t => t.id)),
      defaultHidden: (teamRows || []).some(t => t.is_default && t.hide_public_scores),
    };

    // 5. Events (what row-level security lets the public read)
    const { data: events } = await supabase
      .from('events')
      .select('start_time, category, rsvp_count')
      .eq('club_id', clubId);

    // 6. Club-wide sponsors, via the public-safe view (the sponsors table itself is admin-only;
    //    the view already leaves out inactive and lapsed sponsors). Event-scoped sponsors don't count.
    const { data: sponsors } = await supabase
      .from('sponsors_public')
      .select('tier')
      .eq('club_id', clubId)
      .is('event_id', null);

    const numbers = clubNumbers({
      members: members || [],
      matches: matches || [],
      scoreHidden: m => matchScoreHidden(m, hiddenTeams),
      currentSeason,
      events: events || [],
      sponsors: sponsors || [],
      teams: (teamRows || []).length,
    });

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
        totalMembers: (members || []).length,
        ...numbers,
      },
    }, {
      headers: {
        // Was s-maxage=10/SWR=30 (up to ~40s of a CDN-cached snapshot); this endpoint backs a
        // periodically-refetched widget, so keep it live rather than trading freshness for
        // hit rate at the edge.
        'Cache-Control': 'no-store',
      }
    });
  } catch (err) {
    console.error('[Identity Stats API] Unexpected handler exception:', err);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch club identity stats',
      },
      { status: 500 }
    );
  }
}
