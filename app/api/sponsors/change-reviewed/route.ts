import { NextRequest, NextResponse } from 'next/server';
import { requireClubPerm } from '@/lib/supabase/server-auth';
import { getServiceClient } from '@/lib/supabase/service';
import { emailSponsorChangeReviewed } from '@/lib/email/sponsor-notices';
import { isUuid } from '@/lib/ids';

// SPE-17: after an admin taps Use it or Keep the old one on a logo or website a sponsor sent from their
// own page, this notes which on the sponsor (shown on their page) and emails them.
//   POST { clubId, sponsorId, used: boolean, logo: boolean, website: boolean }   club admins who can edit Sponsors
// The change itself is saved by the admin page as usual; this never changes the logo or website.
export async function POST(req: NextRequest) {
  const input = await req.json().catch(() => null);
  if (!isUuid(input?.clubId) || !isUuid(input?.sponsorId) || typeof input?.used !== 'boolean') {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const auth = await requireClubPerm(req, input.clubId, ['sponsors'], 'edit');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: 'Not available right now.' }, { status: 503 });
  const { data: sponsor } = await db.from('sponsors').select('*').eq('id', input.sponsorId).eq('club_id', input.clubId).maybeSingle();
  if (!sponsor) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  // change_reviewed is from migration 20261136; before it runs this quietly does nothing
  await db.from('sponsors').update({ change_reviewed: input.used ? 'used' : 'kept', change_reviewed_at: new Date().toISOString() })
    .eq('id', sponsor.id).then(() => undefined, () => undefined);

  const what = input.logo && input.website ? 'logo and website' : input.website ? 'website' : 'logo';
  const emailed = await emailSponsorChangeReviewed(db, sponsor, input.used, what);
  return NextResponse.json({ emailed });
}
