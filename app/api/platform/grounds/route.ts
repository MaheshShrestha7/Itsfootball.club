import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/supabase/server-auth';
import { getServiceClient } from '@/lib/supabase/service';
import { pingIndexNow } from '@/lib/indexnow';
import { isUuid } from '@/lib/ids';
import { councilFromPin } from '@/lib/council-lookup';
import { CURATED_GROUNDS } from '@/lib/curated-grounds';
import { STATES, type AuState } from '@/lib/councils';
import { councilAreas, findGroundsInCouncil } from '@/lib/ground-import-server';
import { findExisting } from '@/lib/ground-import';
import {
  GROUNDS_PATH, cleanGroundInput, groundPath, isIndexableGround, slugify, suburbPath, type GroundInput, type GroundRow,
} from '@/lib/grounds';

// Mission Control -> Grounds (components/admin/platform/GroundsTab.tsx). Platform admins only.
//   GET                          every ground, drafts included, with who looks after it and how many clubs use it
//   GET ?areas=1&state=NSW       the state's council areas (ABS) for "Import from map"
//   GET ?find=<ABS LGA code>     ground candidates in that council area (OpenStreetMap), matched to the directory
//   GET ?lat=&lng=               the council a map pin is in
//   POST { action: 'save', groundId?, ground, publish? }  add a ground with no club, or edit any ground
//   POST { action: 'publish', id, published }             publish a draft, or take a ground down
//   POST { action: 'delete', id }                         delete a draft
//   POST { action: 'import', council, items }             add ticked candidates as drafts
// Analysts (platform_admins.role) can read but not write.

const MIGRATION_HINT = 'Run the 20261114_grounds_platform.sql database migration to import grounds.';

async function authorise(req: NextRequest, write: boolean) {
  const auth = await requirePlatformAdmin(req, write);
  if (!auth.ok) return { error: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  const db = getServiceClient();
  if (!db) return { error: NextResponse.json({ error: 'Saving grounds is not configured on the server.' }, { status: 503 }) };
  return { db };
}

type Db = NonNullable<ReturnType<typeof getServiceClient>>;
type Row = GroundRow & { source?: string | null; source_ref?: string | null; created_at?: string };

/** Every ground (any status) with a pin, plus the built-in list, to spot duplicates */
async function directoryForMatching(db: Db) {
  const { data } = await db.from('grounds').select('id, name, slug, lat, lng, source_ref').limit(10000);
  const curated = CURATED_GROUNDS.map(g => ({ id: g.id, name: g.name, slug: g.slug, lat: g.lat, lng: g.lng, source_ref: null }));
  return [...((data || []) as { id: string; name: string; slug: string; lat: number | null; lng: number | null; source_ref?: string | null }[]), ...curated];
}

async function list(db: Db) {
  // select=* so the list still loads before migration 20261114 adds source/source_ref
  const { data, error } = await db.from('grounds').select('*').order('updated_at', { ascending: false }).limit(2000);
  if (error) return NextResponse.json({ error: 'The grounds directory needs the 20261109_grounds.sql database migration.' }, { status: 500 });
  const grounds = (data || []) as Row[];
  const ids = grounds.map(g => g.id);
  const stewardIds = [...new Set(grounds.map(g => g.steward_club_id).filter((id): id is string => !!id))];
  const [{ data: stewards }, { data: users }] = await Promise.all([
    stewardIds.length ? db.from('clubs').select('id, name, slug').in('id', stewardIds) : Promise.resolve({ data: [] }),
    ids.length ? db.from('clubs').select('home_ground_id').eq('is_active', true).in('home_ground_id', ids) : Promise.resolve({ data: [] }),
  ]);
  const stewardName = new Map(((stewards || []) as { id: string; name: string }[]).map(c => [c.id, c.name]));
  const using = new Map<string, number>();
  for (const c of (users || []) as { home_ground_id: string }[]) using.set(c.home_ground_id, (using.get(c.home_ground_id) || 0) + 1);
  return NextResponse.json({
    migrated: grounds.length === 0 || 'source' in grounds[0],
    grounds: grounds.map(g => ({
      ...g,
      steward_name: g.steward_club_id ? stewardName.get(g.steward_club_id) || 'A club' : null,
      clubs_using: using.get(g.id) || 0,
      indexable: isIndexableGround(g, using.get(g.id) || 0),
    })),
  });
}

export async function GET(req: NextRequest) {
  const a = await authorise(req, false);
  if ('error' in a) return a.error;
  const { db } = a;
  const p = req.nextUrl.searchParams;

  if (p.has('areas')) {
    const state = (p.get('state') || '').toUpperCase() as AuState;
    if (!STATES.some(s => s.code === state)) return NextResponse.json({ error: 'Pick a state.' }, { status: 400 });
    try {
      return NextResponse.json({ areas: await councilAreas(state) });
    } catch {
      return NextResponse.json({ error: 'Couldn’t load the council list from the ABS right now. Try again in a minute.' }, { status: 502 });
    }
  }

  if (p.has('find')) {
    const code = (p.get('find') || '').replace(/[^0-9]/g, '');
    if (!code) return NextResponse.json({ error: 'Pick a council area.' }, { status: 400 });
    try {
      const [search, existing] = await Promise.all([findGroundsInCouncil(code), directoryForMatching(db)]);
      return NextResponse.json({
        council: search.council,
        candidates: search.candidates.map(c => ({ ...c, existing: findExisting(c, existing, slugify) })),
      });
    } catch (e) {
      const message = e instanceof Error && !/^ABS /.test(e.message) ? e.message : 'Couldn’t reach the map services right now. Try again in a minute.';
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  if (p.has('lat') && p.has('lng')) {
    const lat = Number(p.get('lat'));
    const lng = Number(p.get('lng'));
    return NextResponse.json({ council: isFinite(lat) && isFinite(lng) ? await councilFromPin(lat, lng) : null });
  }

  return list(db);
}

/** Fills in the council from the map pin when it was left blank */
async function withCouncil<T extends { lat: number | null; lng: number | null; council_key: string | null; council_name: string | null }>(row: T): Promise<T> {
  if (row.council_key || row.lat == null || row.lng == null) return row;
  const match = await councilFromPin(row.lat, row.lng);
  return match ? { ...row, council_key: match.key, council_name: match.key === 'other' ? match.name : null } : row;
}

const pathsFor = (g: Pick<GroundRow, 'slug' | 'suburb_slug'>) => [groundPath(g), suburbPath(g.suburb_slug), GROUNDS_PATH];

async function save(db: Db, body: Record<string, unknown>) {
  const cleaned = cleanGroundInput((body.ground || {}) as GroundInput);
  if ('error' in cleaned) return NextResponse.json({ error: cleaned.error }, { status: 400 });
  const row = await withCouncil(cleaned.row);
  if (!row.slug || !row.suburb_slug) return NextResponse.json({ error: 'Use letters or numbers in the ground and suburb names.' }, { status: 400 });
  const publish = typeof body.publish === 'boolean' ? body.publish : undefined;
  const groundId = typeof body.groundId === 'string' && isUuid(body.groundId) ? body.groundId : null;
  const now = new Date().toISOString();

  if (!groundId) {
    const { data: clash } = await db.from('grounds').select('id').eq('suburb_slug', row.suburb_slug).eq('slug', row.slug).maybeSingle();
    if (clash) return NextResponse.json({ error: `${row.name} in ${row.suburb} is already in the directory.` }, { status: 409 });
    const { data, error } = await db.from('grounds').insert({ ...row, steward_club_id: null, is_published: publish ?? true }).select('*').single();
    if (error) return NextResponse.json({ error: 'Could not add the ground. Check the details and try again.' }, { status: 500 });
    const saved = data as GroundRow;
    if (saved.is_published) await pingIndexNow(pathsFor(saved));
    return NextResponse.json({ ground: saved });
  }

  const { data: existing } = await db.from('grounds').select('*').eq('id', groundId).maybeSingle();
  if (!existing) return NextResponse.json({ error: 'That ground no longer exists.' }, { status: 404 });
  const current = existing as GroundRow;
  const oldPath = `${current.suburb_slug}/${current.slug}`;
  const moved = row.suburb_slug !== current.suburb_slug || row.slug !== current.slug;
  if (moved) {
    const { data: clash } = await db.from('grounds').select('id').eq('suburb_slug', row.suburb_slug).eq('slug', row.slug).neq('id', groundId).maybeSingle();
    if (clash) return NextResponse.json({ error: `There is already a ground called ${row.name} in ${row.suburb}.` }, { status: 409 });
  }
  // A published ground that moves keeps a redirect from its old address
  const previous = moved && current.is_published
    ? [...new Set([...(current.previous_paths || []), oldPath])].filter(p => p !== `${row.suburb_slug}/${row.slug}`)
    : current.previous_paths || [];
  const { data, error } = await db
    .from('grounds')
    .update({ ...row, previous_paths: previous, ...(publish !== undefined ? { is_published: publish } : {}), facts_checked_at: now, updated_at: now })
    .eq('id', groundId)
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: 'Could not save the ground. Check the details and try again.' }, { status: 500 });
  const saved = data as GroundRow;
  if (saved.is_published || current.is_published) {
    await pingIndexNow([...pathsFor(saved), ...(moved ? [`${GROUNDS_PATH}/${oldPath}`, suburbPath(current.suburb_slug)] : [])]);
  }
  return NextResponse.json({ ground: saved });
}

interface ImportItem { ref?: unknown; name?: unknown; suburb?: unknown; postcode?: unknown; lat?: unknown; lng?: unknown; pitches?: unknown }

async function importGrounds(db: Db, body: Record<string, unknown>) {
  const council = (body.council || {}) as { key?: unknown; councilName?: unknown; state?: unknown };
  const state = typeof council.state === 'string' ? council.state : '';
  const items = (Array.isArray(body.items) ? body.items : []).slice(0, 150) as ImportItem[];
  if (!items.length) return NextResponse.json({ error: 'Tick at least one ground.' }, { status: 400 });

  const existing = await directoryForMatching(db);
  const added: { id: string; name: string; ref: string }[] = [];
  const skipped: { name: string; reason: string }[] = [];
  for (const item of items) {
    const ref = typeof item.ref === 'string' && /^osm:(node|way|relation)\/\d+$/.test(item.ref) ? item.ref : null;
    const label = typeof item.name === 'string' && item.name.trim() ? item.name.trim() : 'A ground with no name';
    const lat = typeof item.lat === 'number' ? item.lat : null;
    const lng = typeof item.lng === 'number' ? item.lng : null;
    if (!ref || lat == null || lng == null) { skipped.push({ name: label, reason: 'Missing map details' }); continue; }
    const cleaned = cleanGroundInput({
      name: typeof item.name === 'string' ? item.name : '',
      suburb: typeof item.suburb === 'string' ? item.suburb : '',
      state,
      postcode: typeof item.postcode === 'string' ? item.postcode : '',
      lat, lng,
      council_key: typeof council.key === 'string' ? council.key : '',
      council_name: typeof council.councilName === 'string' ? council.councilName : '',
      pitches: Array.isArray(item.pitches) ? item.pitches : [],
    } as GroundInput);
    if ('error' in cleaned) { skipped.push({ name: label, reason: cleaned.error }); continue; }
    const row = cleaned.row;
    const dupe = findExisting({ ref, name: row.name, lat, lng }, existing, slugify);
    if (dupe) { skipped.push({ name: row.name, reason: `Already listed as ${dupe.name}` }); continue; }
    const { data, error } = await db
      .from('grounds')
      .insert({ ...row, steward_club_id: null, is_published: false, source: 'osm', source_ref: ref })
      .select('id, name, slug, lat, lng')
      .single();
    if (error) {
      if (/source/.test(error.message || '')) return NextResponse.json({ error: MIGRATION_HINT, added, skipped }, { status: 500 });
      skipped.push({ name: row.name, reason: error.code === '23505' ? `There is already a ground called ${row.name} in ${row.suburb}` : 'Could not be saved' });
      continue;
    }
    added.push({ id: data.id, name: data.name, ref });
    existing.push({ id: data.id, name: data.name, slug: data.slug, lat: data.lat, lng: data.lng, source_ref: ref });
  }
  return NextResponse.json({ added, skipped });
}

export async function POST(req: NextRequest) {
  const a = await authorise(req, true);
  if ('error' in a) return a.error;
  const { db } = a;
  const body = ((await req.json().catch(() => null)) || {}) as Record<string, unknown>;

  if (body.action === 'save') return save(db, body);
  if (body.action === 'import') return importGrounds(db, body);

  if (body.action === 'publish' || body.action === 'delete') {
    if (typeof body.id !== 'string' || !isUuid(body.id)) return NextResponse.json({ error: 'Unknown ground.' }, { status: 400 });
    const { data: g } = await db.from('grounds').select('id, slug, suburb_slug, is_published').eq('id', body.id).maybeSingle();
    if (!g) return NextResponse.json({ error: 'That ground no longer exists.' }, { status: 404 });
    if (body.action === 'delete') {
      if (g.is_published) return NextResponse.json({ error: 'Only drafts can be deleted. Take the ground down first.' }, { status: 400 });
      const [{ count: clubs }, { count: fixtures }] = await Promise.all([
        db.from('clubs').select('id', { count: 'exact', head: true }).eq('home_ground_id', g.id),
        db.from('matches').select('id', { count: 'exact', head: true }).eq('ground_id', g.id), // errors (null) before 20261110
      ]);
      if ((clubs || 0) > 0 || (fixtures || 0) > 0) return NextResponse.json({ error: 'A club or fixture uses this ground, so it can’t be deleted.' }, { status: 400 });
      const { error } = await db.from('grounds').delete().eq('id', g.id);
      if (error) return NextResponse.json({ error: 'Could not delete the draft.' }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
    const published = !!body.published;
    const { error } = await db.from('grounds').update({ is_published: published, updated_at: new Date().toISOString() }).eq('id', g.id);
    if (error) return NextResponse.json({ error: 'Could not update the ground.' }, { status: 500 });
    await pingIndexNow(pathsFor(g));
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
