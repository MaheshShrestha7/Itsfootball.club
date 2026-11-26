import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin, type AuthCheck } from '@/lib/supabase/server-auth';
import { getServiceClient } from '@/lib/supabase/service';
import { logPlatformAction } from '@/lib/platform-audit';
import { newClubRow } from '@/lib/new-club';
import { isUuid, newId } from '@/lib/ids';
import { CLUB_FEATURES, configWithFeaturesOff, featuresOff, type ClubFeatureKey } from '@/lib/club-features';
import { getDefaultClubScoreRules } from '@/lib/clubscore-defaults';
import { stableId } from '@/lib/ids';

// Mission Control -> Clubs -> New club (components/admin/platform/NewClubForm.tsx).
//   POST { name, short_name, slug, colours, logo_url, stadium_*, contact_email, contact_phone }
// Makes the club as the signed-in platform admin, who becomes its Owner (the same database rule
// as the public Create club page: owner_id = auth.uid()). The form then sends the Owner invite
// (/api/platform/club-invites) and links the home ground (/api/admin/grounds) itself.
// Operators and Super admins only.
//   POST { action: 'hidden', clubId, hidden }   the "Test club" switch in the club panel: sets clubs.config.hidden, which
//                              keeps the club out of lists, the sitemap and search (lib/public-tournaments.ts)
//   POST { action: 'feature', clubId, feature, on }   a switch in the club panel's Features: sets clubs.config.features_off,
//                              the same setting as the club's own Admin -> Features page (lib/club-features.ts)
//   POST { action: 'clubscore', clubId, on }   the ClubScore switch there: clubscore_rules.is_active

export async function POST(req: NextRequest) {
  const auth = await requirePlatformAdmin(req, true);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Nothing was sent.' }, { status: 400 });
  if (body.action === 'hidden') return setHidden(auth, body);
  if (body.action === 'feature') return setFeature(auth, body);
  if (body.action === 'clubscore') return setClubScore(auth, body);

  const made = newClubRow(body, { id: newId(), ownerId: auth.userId });
  if ('error' in made) return NextResponse.json({ error: made.error }, { status: 400 });
  const { row } = made;

  const { data: free } = await auth.supabase.rpc('club_slug_available', { p_slug: row.slug, p_club_id: null });
  if (free === false) return NextResponse.json({ error: `itsfootball.club/${row.slug} is already taken. Pick another web address.` }, { status: 409 });

  const { error } = await auth.supabase.from('clubs').insert(row);
  if (error) {
    const taken = error.code === '23505';
    return NextResponse.json({ error: taken ? `itsfootball.club/${row.slug} is already taken. Pick another web address.` : error.message }, { status: taken ? 409 : 400 });
  }

  const db = getServiceClient();
  if (db) {
    await logPlatformAction(db, auth, {
      clubId: row.id as string,
      action: 'club_created',
      table: 'clubs',
      targetId: row.id as string,
      summary: `Made the club ${row.name} (/${row.slug}) from Mission Control`,
      details: { owner_email: made.ownerEmail || null },
    });
  }
  return NextResponse.json({ ok: true, id: row.id, slug: row.slug });
}

async function setHidden(auth: Extract<AuthCheck, { ok: true }>, body: { clubId?: unknown; hidden?: unknown }) {
  const clubId = body?.clubId;
  if (!isUuid(clubId) || typeof body?.hidden !== 'boolean') return NextResponse.json({ error: 'Send a club and hidden true or false.' }, { status: 400 });
  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: 'Not configured on the server.' }, { status: 503 });

  const { data: club, error: readErr } = await db.from('clubs').select('name, slug, config').eq('id', clubId).maybeSingle();
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });
  if (!club) return NextResponse.json({ error: 'Club not found.' }, { status: 404 });
  // Merged into the club's other settings (time zone, sponsor spots...), never replacing them
  const config = { ...(club.config && typeof club.config === 'object' ? club.config : {}) } as Record<string, unknown>;
  if (body.hidden) config.hidden = true; else delete config.hidden;
  const { error } = await db.from('clubs').update({ config, updated_at: new Date().toISOString() }).eq('id', clubId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logPlatformAction(db, auth, {
    clubId,
    action: body.hidden ? 'club_hidden' : 'club_unhidden',
    table: 'clubs',
    targetId: clubId,
    summary: body.hidden ? `Made ${club.name} (/${club.slug}) a hidden test club` : `Made ${club.name} (/${club.slug}) public again`,
  });
  return NextResponse.json({ ok: true, hidden: body.hidden });
}

async function setFeature(auth: Extract<AuthCheck, { ok: true }>, body: { clubId?: unknown; feature?: unknown; on?: unknown }) {
  const clubId = body?.clubId;
  const feature = CLUB_FEATURES.find(f => f.key === body?.feature);
  if (!isUuid(clubId) || !feature || typeof body?.on !== 'boolean') return NextResponse.json({ error: 'Send a club, a feature and on true or false.' }, { status: 400 });
  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: 'Not configured on the server.' }, { status: 503 });

  const { data: club, error: readErr } = await db.from('clubs').select('name, slug, config').eq('id', clubId).maybeSingle();
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });
  if (!club) return NextResponse.json({ error: 'Club not found.' }, { status: 404 });
  const current = featuresOff(club).filter(k => k !== feature.key);
  const off: ClubFeatureKey[] = body.on ? current : [...current, feature.key];
  // Merged into the club's other settings (time zone, test club...), never replacing them
  const config = configWithFeaturesOff(club.config, off);
  const { error } = await db.from('clubs').update({ config, updated_at: new Date().toISOString() }).eq('id', clubId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logPlatformAction(db, auth, {
    clubId,
    action: body.on ? 'club_feature_on' : 'club_feature_off',
    table: 'clubs',
    targetId: clubId,
    summary: `Switched ${feature.label} ${body.on ? 'on' : 'off'} for ${club.name} (/${club.slug})`,
  });
  return NextResponse.json({ ok: true, featuresOff: featuresOff({ config }) });
}

async function setClubScore(auth: Extract<AuthCheck, { ok: true }>, body: { clubId?: unknown; on?: unknown }) {
  const clubId = body?.clubId;
  if (!isUuid(clubId) || typeof body?.on !== 'boolean') return NextResponse.json({ error: 'Send a club and on true or false.' }, { status: 400 });
  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: 'Not configured on the server.' }, { status: 503 });

  const { data: club, error: readErr } = await db.from('clubs').select('name, slug').eq('id', clubId).maybeSingle();
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });
  if (!club) return NextResponse.json({ error: 'Club not found.' }, { status: 404 });
  const { data: updated, error } = await db.from('clubscore_rules').update({ is_active: body.on }).eq('club_id', clubId).select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated?.length) {
    // A club still on the default rules has no row yet: save the defaults, with the id the app would give it (lib/supabase/sync.ts)
    const { error: insertErr } = await db.from('clubscore_rules').insert({ ...getDefaultClubScoreRules(clubId), id: stableId(`clubscore-rules-${clubId}`), is_active: body.on });
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  await logPlatformAction(db, auth, {
    clubId,
    action: body.on ? 'club_feature_on' : 'club_feature_off',
    table: 'clubscore_rules',
    targetId: clubId,
    summary: `Switched ClubScore ${body.on ? 'on' : 'off'} for ${club.name} (/${club.slug})`,
  });
  return NextResponse.json({ ok: true, on: body.on });
}
