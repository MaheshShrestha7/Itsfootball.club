import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server-auth';
import { getServiceClient } from '@/lib/supabase/service';

// DELETE: the signed-in user deletes their own account (required by the App Store and Google Play).
// Club records about them (squad entry, payments, attendance) belong to the club and stay, unlinked
// from the account. Club owners must hand over or close their club first: a club without an owner
// would have nobody able to run it.

export async function DELETE(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: 'Account deletion is not configured on the server.' }, { status: 503 });

  const { data: owned, error: ownedError } = await db.from('clubs').select('name').eq('owner_id', auth.userId);
  if (ownedError) return NextResponse.json({ error: 'Could not delete your account. Please try again.' }, { status: 500 });
  if (owned?.length) {
    return NextResponse.json({
      error: `You own ${owned.map(c => c.name).join(', ')}. Contact itsfootball.club support to hand the club over or close it, then delete your account.`,
    }, { status: 409 });
  }

  const { error: unlinkError } = await db.from('club_members').update({ user_id: null }).eq('user_id', auth.userId);
  if (unlinkError) return NextResponse.json({ error: 'Could not delete your account. Please try again.' }, { status: 500 });

  const { error } = await db.auth.admin.deleteUser(auth.userId);
  if (error) {
    console.error('[account] delete failed:', error.message);
    return NextResponse.json({ error: 'Could not delete your account. Please try again.' }, { status: 500 });
  }
  return NextResponse.json({ deleted: true });
}
