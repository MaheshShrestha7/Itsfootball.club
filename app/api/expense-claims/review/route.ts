import { NextRequest, NextResponse } from 'next/server';
import { requireClubPerm } from '@/lib/supabase/server-auth';
import { getServiceClient } from '@/lib/supabase/service';
import { CLUB_BRAND_COLUMNS, clubBaseUrl, clubBrand, type ClubBrandRow } from '@/lib/email/club-brand';
import { sendClubEmails, looksLikeEmail } from '@/lib/email/club-emails';
import { expenseClaimUpdate } from '@/lib/email/templates';
import { EXPENSE_CATEGORIES, formatMoney } from '@/lib/finance';
import { isUuid } from '@/lib/ids';
import type { ExpenseClaim } from '@/lib/supabase/types';

// The treasurer's decision on a claim (finance editors):
//   POST { clubId, claimId, action: 'approve', category? } | { action: 'reject', reason? } | { action: 'paid' }
// Writes use the caller's own session, so the database decides whether they may and records who did.
// The claimant is told by email, best effort: a failed email never undoes the decision.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const action: string = body?.action;
  if (!isUuid(body?.clubId) || !isUuid(body?.claimId) || !['approve', 'reject', 'paid'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const category = typeof body.category === 'string' && EXPENSE_CATEGORIES[body.category] ? body.category : null;
  const reason = typeof body.reason === 'string' ? body.reason.replace(/[<>]/g, '').trim().slice(0, 500) : '';

  const auth = await requireClubPerm(req, body.clubId, ['finance'], 'edit');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data: found } = await auth.supabase.from('expense_claims').select('*').eq('id', body.claimId).eq('club_id', body.clubId).maybeSingle();
  if (!found) return NextResponse.json({ error: 'Claim not found.' }, { status: 404 });
  const claim = found as ExpenseClaim;

  if (action === 'paid') {
    if (claim.status !== 'approved' || !claim.expense_id) return NextResponse.json({ error: 'Only an approved claim can be marked paid.' }, { status: 409 });
    // Ticking the expense is what settles the claim (trigger in migration 20261152)
    const { error } = await auth.supabase.from('expenses').update({ reimbursed: true }).eq('id', claim.expense_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await auth.supabase.rpc('review_expense_claim', {
      p_claim_id: claim.id, p_approve: action === 'approve', p_reason: reason || null, p_category: category,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: error.message.includes('already') ? 409 : 500 });
  }

  const outcome = action === 'approve' ? 'approved' as const : action === 'reject' ? 'rejected' as const : 'paid' as const;
  return NextResponse.json({ success: true, emailed: await tellClaimant(claim, outcome, reason) });
}

async function tellClaimant(claim: ExpenseClaim, outcome: 'approved' | 'rejected' | 'paid', reason: string): Promise<boolean> {
  const db = getServiceClient();
  if (!db || !process.env.RESEND_API_KEY || !looksLikeEmail(claim.claimant_email)) return false;
  const { data } = await db.from('clubs').select(`${CLUB_BRAND_COLUMNS}, contact_email`).eq('id', claim.club_id).maybeSingle();
  if (!data) return false;
  const club = data as ClubBrandRow & { contact_email?: string | null };
  const report = await sendClubEmails(db, [{
    key: `expense_claim:${claim.id}:${outcome}`,
    clubId: club.id,
    kind: 'expense_claim',
    refId: claim.id,
    to: claim.claimant_email!.trim(),
    fromName: club.name,
    replyTo: looksLikeEmail(club.contact_email) ? club.contact_email.trim() : undefined,
    email: expenseClaimUpdate({
      brand: clubBrand(club),
      memberName: claim.claimant_name,
      description: claim.description,
      price: formatMoney(claim.amount_cents, claim.currency),
      outcome,
      reason: reason || null,
      link: `${clubBaseUrl(club)}/member`,
    }),
  }]).catch(() => null);
  if (report?.error) console.error('[expense-claims] email failed:', report.error);
  return !!report && report.sent > 0;
}
