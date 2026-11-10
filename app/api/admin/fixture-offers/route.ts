import { NextRequest, NextResponse } from 'next/server';
import { requireClubPerm } from '@/lib/supabase/server-auth';
import { getServiceClient } from '@/lib/supabase/service';
import { isUuid } from '@/lib/ids';
import { FORMAT_LABEL, halfLabel, ourSide, shortName } from '@/lib/friendlies';
import { formatMatchWhen } from '@/lib/email/format';
import { clubTimeZone } from '@/lib/dates';
import { DEFAULT_CREST } from '@/lib/crest';
import type { ClubTeamFormat } from '@/lib/supabase/types';

// Friendlies another club offered to this club's site (migration 20261159): a club accepted an
// invitation this club sent, and offered the fixture back.
//   GET  ?clubId=...                                  the open offers, for the dashboard's "Needs you"
//   POST { clubId, offerId, action: 'add', teamId }   makes this club's copy of the game, linked to
//                                                     theirs, so date, ground, status and score stay in step
//   POST { clubId, offerId, action: 'decline' }       "Not now"

const MATCH_COLUMNS = 'id, club_id, team_id, competition, season, is_club_home, match_date, match_time, venue, status, home_score, away_score, period, current_minute, half_minutes, ground_id, pitch_label, linked_match_id, match_type';

export async function GET(req: NextRequest) {
  const clubId = req.nextUrl.searchParams.get('clubId');
  if (!isUuid(clubId)) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  const auth = await requireClubPerm(req, clubId, ['matches'], 'view');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const db = getServiceClient();
  if (!db) return NextResponse.json({ offers: [] });

  const { data: offers, error } = await db.from('fixture_offers')
    .select('id, from_club_id, from_match_id, inquiry_id, created_at')
    .eq('to_club_id', clubId).eq('status', 'open').order('created_at').limit(20);
  // Before migration 20261159 there's no table: nothing to show
  if (error || !offers?.length) return NextResponse.json({ offers: [] });

  const [{ data: clubs }, { data: matches }, { data: inquiries }] = await Promise.all([
    db.from('clubs').select('id, name, logo_url, config').in('id', [...new Set(offers.map(o => o.from_club_id))]),
    db.from('matches').select(`${MATCH_COLUMNS}, match_format`).in('id', offers.map(o => o.from_match_id)),
    db.from('contact_inquiries').select('id, sender_name, details').in('id', offers.map(o => o.inquiry_id).filter(Boolean)),
  ]);
  const teamIds = (matches || []).map(m => m.team_id).filter(Boolean);
  const { data: teams } = teamIds.length ? await db.from('club_teams').select('id, name').in('id', teamIds) : { data: [] };

  const list = offers.flatMap(o => {
    const m = (matches || []).find(x => x.id === o.from_match_id);
    const from = (clubs || []).find(c => c.id === o.from_club_id);
    if (!m || !from || m.status === 'cancelled' || m.linked_match_id) return [];
    const inq = (inquiries || []).find(i => i.id === o.inquiry_id);
    const theirTeam = (teams || []).find(t => t.id === m.team_id)?.name;
    const details = (inq?.details || {}) as { their_team?: string };
    const format = (m.match_format || '11v11') as ClubTeamFormat;
    return [{
      id: o.id,
      from: { name: from.name, logo_url: from.logo_url, side: ourSide(from.name, theirTeam) },
      sender: inq?.sender_name || null,
      /** The team the invitation was for on our side, to start the picker on */
      our_team_hint: details.their_team || null,
      when: formatMatchWhen(m.match_date, m.match_time, clubTimeZone(from)),
      // From our side: their home game is away for us
      we_host: !m.is_club_home,
      venue: m.venue,
      game: `${FORMAT_LABEL[format] || FORMAT_LABEL['11v11']}, ${halfLabel(m.half_minutes ?? null, format)}`,
      format,
    }];
  });
  return NextResponse.json({ offers: list });
}

export async function POST(req: NextRequest) {
  const input = await req.json().catch(() => null);
  if (!isUuid(input?.clubId) || !isUuid(input?.offerId) || !['add', 'decline'].includes(input?.action)) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const auth = await requireClubPerm(req, input.clubId, ['matches'], 'edit');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: 'This can’t be saved right now.' }, { status: 503 });

  const { data: offer } = await db.from('fixture_offers').select('*').eq('id', input.offerId).eq('to_club_id', input.clubId).maybeSingle();
  if (!offer) return NextResponse.json({ error: 'Offer not found.' }, { status: 404 });
  if (offer.status !== 'open') return NextResponse.json({ error: 'This one has already been answered.' }, { status: 409 });

  if (input.action === 'decline') {
    await db.from('fixture_offers').update({ status: 'declined', answered_at: new Date().toISOString() }).eq('id', offer.id);
    return NextResponse.json({ ok: true });
  }

  if (!isUuid(input.teamId)) return NextResponse.json({ error: 'Pick which of your teams is playing.' }, { status: 400 });
  const [{ data: source }, { data: from }, { data: us }, { data: team }, { data: season }] = await Promise.all([
    db.from('matches').select(`${MATCH_COLUMNS}, match_format`).eq('id', offer.from_match_id).maybeSingle(),
    db.from('clubs').select('id, name, logo_url').eq('id', offer.from_club_id).maybeSingle(),
    db.from('clubs').select('id, name, logo_url').eq('id', input.clubId).maybeSingle(),
    db.from('club_teams').select('id, name, match_format, is_active').eq('id', input.teamId).eq('club_id', input.clubId).maybeSingle(),
    db.from('club_seasons').select('name').eq('club_id', input.clubId).eq('is_current', true).maybeSingle(),
  ]);
  if (!source || !from || !us) return NextResponse.json({ error: 'That fixture is no longer there.' }, { status: 404 });
  if (!team || !team.is_active) return NextResponse.json({ error: 'Pick which of your teams is playing.' }, { status: 400 });
  if (source.linked_match_id) return NextResponse.json({ error: 'This game is already on your fixtures.' }, { status: 409 });
  const { data: theirTeam } = source.team_id ? await db.from('club_teams').select('name').eq('id', source.team_id).maybeSingle() : { data: null };

  // Our copy: the same game from our side (home and away the other way round, same score order)
  const opponent = ourSide(from.name, theirTeam?.name);
  const weHost = !source.is_club_home;
  const ourLogo = us.logo_url || '';
  const theirLogo = from.logo_url || DEFAULT_CREST;
  const ourName = ourSide(us.name, team.name);
  const home = weHost ? ourName : opponent;
  const away = weHost ? opponent : ourName;
  const { data: copy, error } = await db.from('matches').insert({
    club_id: us.id,
    title: `${home} vs ${away}`,
    match_type: 'friendly',
    competition: source.competition || 'Club Friendly',
    season: season?.name || source.season,
    opponent_name: opponent,
    opponent_short_name: shortName(opponent).slice(0, 8),
    home_team_name: home,
    away_team_name: away,
    home_team_logo: weHost ? ourLogo : theirLogo,
    away_team_logo: weHost ? theirLogo : ourLogo,
    is_club_home: weHost,
    match_date: source.match_date,
    match_time: source.match_time,
    venue: source.venue,
    status: source.status,
    home_score: source.home_score,
    away_score: source.away_score,
    period: source.period,
    current_minute: source.current_minute,
    half_minutes: source.half_minutes,
    ground_id: source.ground_id,
    pitch_label: source.pitch_label,
    match_format: team.match_format === '7v7' || team.match_format === '9v9' ? team.match_format : source.match_format,
    team_id: team.id,
    door_qr_checkin_enabled: false,
    linked_match_id: source.id,
  }).select('*').single();
  if (error || !copy) {
    console.error('[fixture-offers] copy failed:', error?.message);
    return NextResponse.json({ error: 'The fixture couldn’t be added. Try again.' }, { status: 500 });
  }
  await db.from('matches').update({ linked_match_id: copy.id }).eq('id', source.id);
  await db.from('fixture_offers').update({ status: 'accepted', to_match_id: copy.id, answered_at: new Date().toISOString() }).eq('id', offer.id);
  return NextResponse.json({ ok: true, matchId: copy.id, match: { ...copy, linked_match_id: source.id } });
}
