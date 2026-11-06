import { NextRequest, NextResponse } from 'next/server';
import { requireClubPerm } from '@/lib/supabase/server-auth';
import { getServiceClient } from '@/lib/supabase/service';
import { getStripe } from '@/lib/stripe';
import { closeOpenCheckout } from '@/lib/payments-server';
import { packageIsFull, PACKAGE_TAKEN, sendInstalmentInvoice, type InvoiceSponsor } from '@/lib/sponsor-invoice-server';
import { invoiceIsDue, parseSchedule } from '@/lib/sponsor-instalments';
import { isSponsorKey, localDateISO, matchSponsorPackage } from '@/lib/sponsors';
import { isUuid } from '@/lib/ids';
import type { Payment } from '@/lib/supabase/types';

// A sponsor paying by instalments (club admins who can edit Sponsors or Finance):
//   POST { clubId, sponsorId, action: 'create', instalments: [{ amountCents, dueOn }] }
//   POST { clubId, sponsorId, action: 'cancel' }   stops what's still to come; what was paid stays paid
// Each instalment is its own invoice. The first goes out now if it's due within 14 days; the daily
// reminders job sends each later one as its due date comes up (app/api/cron/reminders).

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!isUuid(body?.clubId) || !isUuid(body?.sponsorId) || !['create', 'cancel'].includes(body?.action)) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const auth = await requireClubPerm(req, body.clubId, ['sponsors', 'finance'], 'edit');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: 'Instalments are not available right now.' }, { status: 503 });

  const { data: sponsor } = await db.from('sponsors').select('*').eq('id', body.sponsorId).eq('club_id', body.clubId).maybeSingle();
  if (!sponsor) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  // What's open for this sponsor (the instalment columns need migration 20261153)
  const { data: open, error: openError } = await db.from('payments').select('id, status, due_on, instalment_plan_id, stripe_session_id')
    .eq('sponsor_id', sponsor.id).eq('kind', 'sponsorship').in('status', ['pending', 'awaiting_review']);
  if (openError) return NextResponse.json({ error: 'Instalments need the latest database update (migration 20261153) first.' }, { status: 409 });

  return body.action === 'cancel'
    ? cancel(body.clubId, sponsor, open || [], auth.userId, db)
    : create(body, sponsor, open || [], db);
}

type Db = NonNullable<ReturnType<typeof getServiceClient>>;
type OpenRow = { id: string; status: string; due_on: string | null; instalment_plan_id: string | null; stripe_session_id: string | null };

async function create(body: { clubId: string; instalments?: unknown }, sponsor: InvoiceSponsor & { tier: string; package_value: number | null }, open: OpenRow[], db: Db) {
  if (sponsor.package_status === 'cancelled') return NextResponse.json({ error: 'This sponsorship was cancelled. Bring them back first.' }, { status: 409 });
  if (!isSponsorKey(sponsor.access_key)) return NextResponse.json({ error: 'Instalments need the sponsor renewals update (migration 20261132) first.' }, { status: 409 });

  // Decided here, not just hidden in the browser, so a double tap can't make two plans
  if (open.some(r => r.instalment_plan_id)) return NextResponse.json({ error: 'They are already paying by instalments. Cancel what\'s left before starting a new plan.' }, { status: 409 });
  if (open.some(r => r.status === 'awaiting_review')) return NextResponse.json({ error: 'They sent a bank transfer receipt that is waiting to be checked. Check it in Finance first.' }, { status: 409 });
  if (open.some(r => r.due_on)) return NextResponse.json({ error: 'They have an unpaid invoice. Cancel it in Finance first, so they aren\'t asked to pay twice.' }, { status: 409 });

  const parsed = parseSchedule(body.instalments, localDateISO());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const [{ data: packages }, { data: settings }, { data: paidBefore }] = await Promise.all([
    db.from('sponsorship_packages').select('*').eq('club_id', sponsor.club_id).eq('is_active', true),
    db.from('club_payment_settings').select('currency').eq('club_id', sponsor.club_id).maybeSingle(),
    db.from('payments').select('id').eq('sponsor_id', sponsor.id).eq('kind', 'sponsorship').eq('status', 'paid').limit(1).maybeSingle(),
  ]);
  const priced = (packages || []).filter(p => p.price_cents > 0);
  const pkg = priced.find(p => p.id === sponsor.package_id) || matchSponsorPackage({ tier: sponsor.tier as never, package_value: sponsor.package_value }, priced);
  if (pkg && sponsor.package_id !== pkg.id && await packageIsFull(db, sponsor.club_id, pkg, sponsor.id)) {
    return NextResponse.json({ error: PACKAGE_TAKEN }, { status: 409 });
  }

  const planId = crypto.randomUUID();
  const name = `${pkg?.name || 'Sponsorship'}${paidBefore ? ' renewal' : ''}`;
  const of = parsed.value.length;
  const { data: rows, error } = await db.from('payments').insert(parsed.value.map((item, i) => ({
    club_id: sponsor.club_id, kind: 'sponsorship', category: 'sponsorship',
    sponsor_id: sponsor.id, package_id: pkg?.id ?? null,
    instalment_plan_id: planId, instalment_no: i + 1, instalment_of: of,
    // The pay page shows request_title, as it does for a fee request
    request_title: `${name}, instalment ${i + 1} of ${of}`,
    description: `${name}, instalment ${i + 1} of ${of} (${sponsor.name})`,
    amount_cents: item.amountCents, currency: settings?.currency || 'AUD',
    method: 'bank_transfer', status: 'pending', due_on: item.dueOn,
    payer_name: sponsor.contact_name || sponsor.name, payer_email: sponsor.contact_email || null,
  }))).select('*');
  if (error || !rows) {
    console.error('[sponsor-instalments] create:', error?.message);
    return NextResponse.json({ error: 'The plan could not be saved. Please try again.' }, { status: 500 });
  }
  // The package they're paying for is the one they hold (SPP-4). Best effort.
  if (pkg && !sponsor.package_id) await db.from('sponsors').update({ package_id: pkg.id }).eq('id', sponsor.id).then(() => undefined, () => undefined);

  // Never fails the request: the plan is saved, and pressing the button again would be refused
  const today = localDateISO();
  const firstPayment = (rows as Payment[]).find(r => r.instalment_no === 1)!;
  const sent = invoiceIsDue(firstPayment.due_on!, today)
    ? await sendInstalmentInvoice(db, sponsor, firstPayment).catch(err => {
      console.error('[sponsor-instalments] first invoice:', err);
      return { emailed: false, note: 'The plan is saved, but the first invoice could not be emailed. Use Send invoice again.' };
    })
    : { emailed: false, note: undefined, later: true };
  return NextResponse.json({ planId, count: rows.length, ...sent });
}

async function cancel(clubId: string, sponsor: { id: string; package_status?: string | null }, open: OpenRow[], userId: string, db: Db) {
  const stopping = open.filter(r => r.instalment_plan_id && r.status === 'pending');
  if (!stopping.length) return NextResponse.json({ error: 'There is nothing left to cancel.' }, { status: 409 });
  const planId = stopping[0].instalment_plan_id!;

  // A checkout left open would take money for an instalment that's no longer owed
  const withCheckout = stopping.filter(r => r.stripe_session_id);
  if (withCheckout.length) {
    const stripe = getStripe();
    const { data: settings } = await db.from('club_payment_settings').select('stripe_account_id').eq('club_id', clubId).maybeSingle();
    if (!stripe || !settings?.stripe_account_id) return NextResponse.json({ error: 'Card payments can\'t be reached right now. Please try again.' }, { status: 503 });
    for (const row of withCheckout) {
      const closed = await closeOpenCheckout(stripe, row.stripe_session_id!, settings.stripe_account_id).catch(() => null);
      if (closed === 'paid') return NextResponse.json({ error: 'They have just paid an instalment by card. Wait for it to show here, then cancel the rest.' }, { status: 409 });
      if (!closed) return NextResponse.json({ error: 'Card payments can\'t be reached right now. Please try again.' }, { status: 502 });
    }
  }

  const { error } = await db.from('payments')
    .update({ status: 'rejected', stripe_session_id: null, rejection_reason: 'Instalment plan cancelled', reviewed_by: userId, reviewed_at: new Date().toISOString() })
    .in('id', stopping.map(r => r.id)).eq('status', 'pending');
  if (error) return NextResponse.json({ error: 'The plan could not be cancelled. Please try again.' }, { status: 500 });

  // The deal is now worth what was paid. Nothing paid: the sponsor is left as they were.
  const { data: paid } = await db.from('payments').select('amount_cents').eq('instalment_plan_id', planId).eq('status', 'paid');
  const paidCents = (paid || []).reduce((n, r) => n + r.amount_cents, 0);
  const receiptWaiting = open.some(r => r.instalment_plan_id === planId && r.status === 'awaiting_review');
  if (paidCents > 0 && !receiptWaiting) {
    await db.from('sponsors').update({ package_value: paidCents / 100, ...(sponsor.package_status === 'confirmed' ? { package_status: 'paid' } : {}) }).eq('id', sponsor.id);
  }
  return NextResponse.json({ cancelled: stopping.length, paidCents });
}
