import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { getServiceClient } from '@/lib/supabase/service';
import { requireClubOwner } from '@/lib/supabase/server-auth';

// Connects a club's own Stripe account (Standard) so card payments go straight to the club.
// Owner only: whoever controls this decides where the club's card money is paid out.
// Returns an onboarding link, or { connected: true } once Stripe says the account can take charges.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const clubId = typeof body?.clubId === 'string' ? body.clubId : '';
  if (!clubId) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });

  const auth = await requireClubOwner(req, clubId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const stripe = getStripe();
  const db = getServiceClient();
  if (!stripe || !db) return NextResponse.json({ error: 'Stripe is not configured on this site.' }, { status: 503 });

  const [{ data: club }, { data: settings }] = await Promise.all([
    db.from('clubs').select('id, slug, name, contact_email').eq('id', clubId).single(),
    db.from('club_payment_settings').select('stripe_account_id').eq('club_id', clubId).maybeSingle(),
  ]);
  if (!club) return NextResponse.json({ error: 'Club not found.' }, { status: 404 });

  try {
    let accountId: string | null = settings?.stripe_account_id ?? null;
    if (accountId) {
      const account = await stripe.accounts.retrieve(accountId);
      await db.from('club_payment_settings')
        .update({ stripe_charges_enabled: Boolean(account.charges_enabled), updated_at: new Date().toISOString() })
        .eq('club_id', clubId);
      if (account.charges_enabled && account.details_submitted) return NextResponse.json({ connected: true });
    } else {
      const account = await stripe.accounts.create({
        type: 'standard',
        email: club.contact_email || undefined,
        business_profile: { name: club.name },
        metadata: { club_id: club.id },
      });
      accountId = account.id;
      const { error } = await db.from('club_payment_settings').upsert(
        { club_id: clubId, stripe_account_id: accountId, updated_at: new Date().toISOString() },
        { onConflict: 'club_id' }
      );
      if (error) throw error;
    }

    const back = `${new URL(req.url).origin}/${club.slug}/admin/finance?tab=settings`;
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: back,
      return_url: back,
      type: 'account_onboarding',
    });
    return NextResponse.json({ url: link.url });
  } catch (err) {
    console.error('Stripe connect error:', err);
    return NextResponse.json({ error: 'Could not reach Stripe. Please try again.' }, { status: 502 });
  }
}

// Disconnects the club's Stripe account here (card payments switch off; bank transfer is unaffected).
// The account itself stays the club's; payments already started still complete via the webhook.
export async function DELETE(req: NextRequest) {
  const clubId = req.nextUrl.searchParams.get('clubId') || '';
  if (!clubId) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });

  const auth = await requireClubOwner(req, clubId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: 'Payments are not configured on this site.' }, { status: 503 });

  const { error } = await db
    .from('club_payment_settings')
    .update({ stripe_account_id: null, stripe_charges_enabled: false, updated_at: new Date().toISOString() })
    .eq('club_id', clubId);
  if (error) return NextResponse.json({ error: 'Could not disconnect Stripe.' }, { status: 500 });
  return NextResponse.json({ disconnected: true });
}
