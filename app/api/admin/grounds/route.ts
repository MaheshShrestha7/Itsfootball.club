import { NextRequest, NextResponse } from 'next/server';
import { requireClubPerm } from '@/lib/supabase/server-auth';
import { getServiceClient } from '@/lib/supabase/service';
import { pingIndexNow } from '@/lib/indexnow';
import { isUuid } from '@/lib/ids';
import { councilFromPin } from '@/lib/council-lookup';
import {
  GROUNDS_PATH, cleanGroundInput, groundPath, slugify, suburbPath, type GroundInput, type GroundRow,
} from '@/lib/grounds';

// Admin -> Branding -> Home ground guide. Needs edit rights on the club's Branding.
//   GET  ?clubId=            the club's home ground (if any), whether this club looks after its facts,
//                            and whether the club is listed by name on ground pages
//   GET  ?clubId=&q=         published grounds matching a name or suburb (to pick an existing one)
//   GET  ?clubId=&lat=&lng=  the council that map pin is in (ABS boundaries, lib/council-lookup.ts)
//   POST { clubId, action: 'save', groundId?, ground, listed }
//          groundId of a ground this club looks after: update its facts (a new name or suburb keeps a
//          redirect from the old address); of another club's ground: just make it this club's home
//          ground; none: add a new ground looked after by this club
//   POST { clubId, action: 'listed', listed }   the "show our club on ground pages" switch
//   POST { clubId, action: 'unlink' }           this club no longer has a home ground in the directory

const COLUMNS =
  'id,steward_club_id,name,slug,suburb,suburb_slug,state,postcode,address,lat,lng,council_key,council_name,pitches,parking,toilets,canteen,accessibility,notes,is_published,previous_paths,facts_checked_at,updated_at';

const MIGRATION_HINT = 'The grounds directory needs the 20261109_grounds.sql database migration.';

/** Fills in the council from the map pin when the admin left it blank */
async function withCouncil<T extends { lat: number | null; lng: number | null; council_key: string | null; council_name: string | null }>(row: T): Promise<T> {
  if (row.council_key || row.lat == null || row.lng == null) return row;
  const match = await councilFromPin(row.lat, row.lng);
  return match ? { ...row, council_key: match.key, council_name: match.key === 'other' ? match.name : null } : row;
}

async function authorise(req: NextRequest, clubId: unknown, level: 'view' | 'edit') {
  if (typeof clubId !== 'string' || !isUuid(clubId)) return { error: NextResponse.json({ error: 'Missing club.' }, { status: 400 }) };
  const auth = await requireClubPerm(req, clubId, ['branding'], level);
  if (!auth.ok) return { error: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  const db = getServiceClient();
  if (!db) return { error: NextResponse.json({ error: 'Saving grounds is not configured on the server.' }, { status: 503 }) };
  return { db, clubId };
}

export async function GET(req: NextRequest) {
  const a = await authorise(req, req.nextUrl.searchParams.get('clubId'), 'view');
  if ('error' in a) return a.error;
  const { db, clubId } = a;

  const lat = Number(req.nextUrl.searchParams.get('lat'));
  const lng = Number(req.nextUrl.searchParams.get('lng'));
  if (req.nextUrl.searchParams.has('lat') && req.nextUrl.searchParams.has('lng')) {
    return NextResponse.json({ council: isFinite(lat) && isFinite(lng) ? await councilFromPin(lat, lng) : null });
  }

  const q = (req.nextUrl.searchParams.get('q') || '').trim();
  if (q) {
    const s = slugify(q);
    if (s.length < 2) return NextResponse.json({ results: [] });
    const { data, error } = await db
      .from('grounds')
      .select(COLUMNS)
      .eq('is_published', true)
      .or(`slug.ilike.%${s}%,suburb_slug.ilike.%${s}%,postcode.eq.${/^\d{4}$/.test(q) ? q : '0000'}`)
      .order('name')
      .limit(8);
    if (error) return NextResponse.json({ error: MIGRATION_HINT }, { status: 500 });
    return NextResponse.json({ results: data || [] });
  }

  const { data: club, error } = await db.from('clubs').select('home_ground_id, grounds_directory_listed').eq('id', clubId).maybeSingle();
  if (error) return NextResponse.json({ migrated: false, error: MIGRATION_HINT });
  let ground: GroundRow | null = null;
  if (club?.home_ground_id) {
    const { data } = await db.from('grounds').select(COLUMNS).eq('id', club.home_ground_id).maybeSingle();
    ground = (data as GroundRow | null) || null;
  }
  return NextResponse.json({
    migrated: true,
    ground,
    steward: !!ground && ground.steward_club_id === clubId,
    listed: !!club?.grounds_directory_listed,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const a = await authorise(req, body?.clubId, 'edit');
  if ('error' in a) return a.error;
  const { db, clubId } = a;
  const action = body?.action;

  if (action === 'listed' || action === 'unlink') {
    const patch = action === 'listed' ? { grounds_directory_listed: !!body?.listed } : { home_ground_id: null };
    const { data: before } = await db.from('clubs').select('home_ground_id').eq('id', clubId).maybeSingle();
    const { error } = await db.from('clubs').update(patch).eq('id', clubId);
    if (error) return NextResponse.json({ error: MIGRATION_HINT }, { status: 500 });
    // The ground page names (or stops naming) this club: ask search engines to look again
    if (before?.home_ground_id) {
      const { data: g } = await db.from('grounds').select('slug, suburb_slug').eq('id', before.home_ground_id).maybeSingle();
      if (g) await pingIndexNow([groundPath(g), suburbPath(g.suburb_slug), GROUNDS_PATH]);
    }
    return NextResponse.json({ ok: true });
  }

  if (action !== 'save') return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });

  const listed = !!body?.listed;
  const groundId = typeof body?.groundId === 'string' && isUuid(body.groundId) ? body.groundId : null;
  let saved: GroundRow | null = null;
  const pinged: string[] = [];

  if (groundId) {
    const { data: existing, error } = await db.from('grounds').select(COLUMNS).eq('id', groundId).maybeSingle();
    if (error) return NextResponse.json({ error: MIGRATION_HINT }, { status: 500 });
    if (!existing) return NextResponse.json({ error: 'That ground no longer exists.' }, { status: 404 });
    const current = existing as GroundRow;

    if (current.steward_club_id === clubId) {
      const cleaned = cleanGroundInput((body?.ground || {}) as GroundInput);
      if ('error' in cleaned) return NextResponse.json({ error: cleaned.error }, { status: 400 });
      const row = await withCouncil(cleaned.row);
      const oldPath = `${current.suburb_slug}/${current.slug}`;
      const moved = row.suburb_slug !== current.suburb_slug || row.slug !== current.slug;
      if (moved) {
        const { data: clash } = await db.from('grounds').select('id').eq('suburb_slug', row.suburb_slug).eq('slug', row.slug).neq('id', groundId).maybeSingle();
        if (clash) return NextResponse.json({ error: `There is already a ground called ${row.name} in ${row.suburb}. Pick it instead of renaming this one.` }, { status: 409 });
      }
      const previous = moved ? [...new Set([...(current.previous_paths || []), oldPath])].filter(p => p !== `${row.suburb_slug}/${row.slug}`) : current.previous_paths || [];
      const { data, error: upErr } = await db
        .from('grounds')
        .update({ ...row, previous_paths: previous, facts_checked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', groundId)
        .select(COLUMNS)
        .single();
      if (upErr) return NextResponse.json({ error: 'Could not save the ground. Check the details and try again.' }, { status: 500 });
      saved = data as GroundRow;
      if (moved) pinged.push(`${GROUNDS_PATH}/${oldPath}`, suburbPath(current.suburb_slug));
    } else {
      saved = current; // another club looks after it: this club just plays there
    }
  } else {
    const cleaned = cleanGroundInput((body?.ground || {}) as GroundInput);
    if ('error' in cleaned) return NextResponse.json({ error: cleaned.error }, { status: 400 });
    const row = await withCouncil(cleaned.row);
    if (!row.slug || !row.suburb_slug) return NextResponse.json({ error: 'Use letters or numbers in the ground and suburb names.' }, { status: 400 });
    const { data: clash, error: clashErr } = await db.from('grounds').select(COLUMNS).eq('suburb_slug', row.suburb_slug).eq('slug', row.slug).maybeSingle();
    if (clashErr) return NextResponse.json({ error: MIGRATION_HINT }, { status: 500 });
    if (clash) return NextResponse.json({ error: `${row.name} in ${row.suburb} is already in the directory.`, existing: clash }, { status: 409 });
    const { data, error } = await db.from('grounds').insert({ ...row, steward_club_id: clubId }).select(COLUMNS).single();
    if (error) return NextResponse.json({ error: 'Could not add the ground. Check the details and try again.' }, { status: 500 });
    saved = data as GroundRow;
  }

  const { error: clubErr } = await db.from('clubs').update({ home_ground_id: saved.id, grounds_directory_listed: listed }).eq('id', clubId);
  if (clubErr) return NextResponse.json({ error: MIGRATION_HINT }, { status: 500 });

  await pingIndexNow([groundPath(saved), suburbPath(saved.suburb_slug), GROUNDS_PATH, ...pinged]);
  return NextResponse.json({ ground: saved, steward: saved.steward_club_id === clubId, listed });
}
