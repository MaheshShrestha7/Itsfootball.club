import { NextRequest, NextResponse } from 'next/server';
import { requireClubPerm } from '@/lib/supabase/server-auth';
import { getServiceClient } from '@/lib/supabase/service';
import { CLUB_BRAND_COLUMNS, clubBaseUrl, type ClubBrandRow } from '@/lib/email/club-brand';
import { isSponsorKey, sponsorPageUrl } from '@/lib/sponsors';
import { isUuid } from '@/lib/ids';

// The link to a sponsor's own page. Its secret (sponsors.access_key) never reaches the browser's
// Supabase session (migration 20261138), so club admins who can edit Sponsors get it here.
//   POST { clubId, sponsorId, rotate?: true }
//   rotate  a new secret: their old page, invoice, payment and renewal links stop working
const noStore = { 'Cache-Control': 'no-store' };

export async function POST(req: NextRequest) {
  const input = await req.json().catch(() => null);
  if (!isUuid(input?.clubId) || !isUuid(input?.sponsorId)) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  const auth = await requireClubPerm(req, input.clubId, ['sponsors'], 'edit');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: 'Links are not available right now.' }, { status: 503 });
  const [{ data: sponsor }, { data: club }] = await Promise.all([
    db.from('sponsors').select('id, access_key').eq('id', input.sponsorId).eq('club_id', input.clubId).maybeSingle(),
    db.from('clubs').select(CLUB_BRAND_COLUMNS).eq('id', input.clubId).maybeSingle(),
  ]);
  if (!sponsor || !club) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  let key: unknown = sponsor.access_key;
  if (input.rotate === true) {
    // 64 lowercase hex characters, as the database makes them (isSponsorKey)
    key = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
    const { error } = await db.from('sponsors').update({ access_key: key }).eq('id', sponsor.id);
    if (error) return NextResponse.json({ error: 'A new link could not be made. Please try again.' }, { status: 500 });
  }
  if (!isSponsorKey(key)) {
    return NextResponse.json({ error: 'Sponsor links need the sponsor renewals update (migration 20261132) first.' }, { status: 409 });
  }
  return NextResponse.json({ link: sponsorPageUrl(clubBaseUrl(club as ClubBrandRow), key) }, { headers: noStore });
}
