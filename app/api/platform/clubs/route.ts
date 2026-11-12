import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/supabase/server-auth';
import { getServiceClient } from '@/lib/supabase/service';
import { logPlatformAction } from '@/lib/platform-audit';
import { newClubRow } from '@/lib/new-club';
import { newId } from '@/lib/ids';

// Mission Control -> Clubs -> New club (components/admin/platform/NewClubForm.tsx).
//   POST { name, short_name, slug, colours, logo_url, stadium_*, contact_email, contact_phone }
// Makes the club as the signed-in platform admin, who becomes its Owner (the same database rule
// as the public Create club page: owner_id = auth.uid()). The form then sends the Owner invite
// (/api/platform/club-invites) and links the home ground (/api/admin/grounds) itself.
// Operators and Super admins only.

export async function POST(req: NextRequest) {
  const auth = await requirePlatformAdmin(req, true);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Nothing was sent.' }, { status: 400 });

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
