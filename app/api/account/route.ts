import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server-auth';
import { getServiceClient } from '@/lib/supabase/service';
import { deleteAccount } from '@/lib/account-delete';

// DELETE: the signed-in user deletes their own account (required by the App Store and Google Play).
// Rules in lib/account-delete.ts. A club Owner is refused, and support gets a request in Mission
// Control to hand the club over (one open request per person).

export async function DELETE(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: 'Account deletion is not configured on the server.' }, { status: 503 });

  const result = await deleteAccount(db, auth.userId);
  if (result.ok) return NextResponse.json({ deleted: true });
  if (result.status === 500) {
    console.error('[account] delete failed:', result.error);
    return NextResponse.json({ error: 'Could not delete your account. Please try again.' }, { status: 500 });
  }

  const names = result.owned.map(c => c.name).join(', ');
  const { data: open } = await db.from('support_requests').select('id')
    .eq('user_id', auth.userId).eq('topic', 'Account deletion').neq('status', 'done').limit(1);
  if (!open?.length) {
    const { data: u } = await db.auth.admin.getUserById(auth.userId);
    const { error } = await db.from('support_requests').insert({
      club_id: result.owned[0].id,
      user_id: auth.userId,
      from_email: u.user?.email || auth.confirmedEmail || 'unknown',
      from_name: (u.user?.user_metadata?.full_name as string | undefined) || null,
      topic: 'Account deletion',
      message: `Wants to delete their account but owns ${names}. Hand the club over (or close it), then delete the account.`,
    });
    // Before migration 20261146 there's no table; the person still gets the message below
    if (error) console.warn('[account] support request not saved:', error.message);
  }
  return NextResponse.json({
    error: `You own ${names}. We've let itsfootball.club support know: we'll email you to hand the club over to another admin, then delete your account.`,
  }, { status: 409 });
}
