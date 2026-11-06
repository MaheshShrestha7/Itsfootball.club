-- ==============================================================================
-- Migration: fee requests (ask a squad for money) and expense claims (members ask for money back)
-- Date: 2026-11-06
--
-- Fee requests   One 'fee_request' row in payments per person, sharing a request_id. They always have
--                a due_on, which is what the Stripe webhook and the Income tab already treat as "a bill
--                the club sent": an abandoned card checkout leaves it open instead of failing it.
--                fulfil_payment needs no change: it marks them paid and has nothing else to apply.
-- Expense claims Separate from expenses until approved, because everything that adds up expenses
--                (Finance, Club Overview, Mission Control) must not count money nobody has agreed to.
--                Approving creates the expenses row. expense_claims is read with RLS and only written
--                by the server: the claim route (service role) and review_expense_claim().
--
-- The app works before this migration: the new tabs and panels just stay empty.
-- Safe to run more than once.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Fee requests
-- ------------------------------------------------------------------------------
ALTER TABLE payments ADD COLUMN IF NOT EXISTS request_id UUID;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS request_title VARCHAR(120);
CREATE INDEX IF NOT EXISTS idx_payments_request ON payments (request_id) WHERE request_id IS NOT NULL;

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_kind_check;
ALTER TABLE payments ADD CONSTRAINT payments_kind_check
    CHECK (kind IN ('membership_signup', 'membership_renewal', 'sponsorship', 'shop_order', 'event_ticket', 'fee_request', 'income_other'));

-- ------------------------------------------------------------------------------
-- 2. Expense claims
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expense_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    member_id UUID REFERENCES club_members(id) ON DELETE SET NULL,
    submitted_by UUID NOT NULL,
    claimant_name VARCHAR(255) NOT NULL,
    claimant_email VARCHAR(255),
    -- Same keys as expenses.category (lib/finance.ts EXPENSE_CATEGORIES)
    category VARCHAR(48) NOT NULL DEFAULT 'other',
    description TEXT NOT NULL,
    vendor VARCHAR(255),
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    currency CHAR(3) NOT NULL DEFAULT 'AUD',
    spent_on DATE NOT NULL,
    receipt_key TEXT NOT NULL, -- private storage key, never a public URL
    -- Where to send the money. Erased once the claim is paid or turned down.
    payout_details TEXT,
    status VARCHAR(16) NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved', 'rejected', 'paid')),
    rejection_reason TEXT,
    expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_expense_claims_club ON expense_claims (club_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expense_claims_expense ON expense_claims (expense_id) WHERE expense_id IS NOT NULL;

ALTER TABLE expense_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Finance or claimant read claims" ON expense_claims;
CREATE POLICY "Finance or claimant read claims" ON expense_claims FOR SELECT TO authenticated
    USING (submitted_by = auth.uid() OR has_club_perm(club_id, '{finance}', 'view'));
-- Holds bank details: signed-out visitors get no access at all, and nobody writes to it directly
REVOKE ALL ON expense_claims FROM PUBLIC, anon, authenticated;
GRANT SELECT ON expense_claims TO authenticated;

-- Approve or turn down a claim. Approving is what puts it in the books, as money owed to the member.
CREATE OR REPLACE FUNCTION review_expense_claim(p_claim_id UUID, p_approve BOOLEAN, p_reason TEXT DEFAULT NULL, p_category TEXT DEFAULT NULL)
RETURNS expense_claims AS $$
DECLARE
    v_claim expense_claims;
    v_expense_id UUID;
BEGIN
    SELECT * INTO v_claim FROM expense_claims WHERE id = p_claim_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Claim not found';
    END IF;
    IF NOT has_club_perm(v_claim.club_id, '{finance}', 'edit') THEN
        RAISE EXCEPTION 'Not allowed';
    END IF;
    IF v_claim.status <> 'submitted' THEN
        RAISE EXCEPTION 'This claim has already been reviewed';
    END IF;

    IF p_approve THEN
        INSERT INTO expenses (club_id, category, description, vendor, amount_cents, currency, spent_on, method, receipt_key, paid_by_member_id, reimbursed)
        VALUES (v_claim.club_id, COALESCE(NULLIF(p_category, ''), v_claim.category), v_claim.description, v_claim.vendor, v_claim.amount_cents,
                v_claim.currency, v_claim.spent_on, 'bank_transfer', v_claim.receipt_key, v_claim.member_id, FALSE)
        RETURNING id INTO v_expense_id;
        UPDATE expense_claims
           SET status = 'approved', category = COALESCE(NULLIF(p_category, ''), category), expense_id = v_expense_id,
               reviewed_by = auth.uid(), reviewed_at = NOW()
         WHERE id = p_claim_id
        RETURNING * INTO v_claim;
    ELSE
        UPDATE expense_claims
           SET status = 'rejected', rejection_reason = NULLIF(trim(COALESCE(p_reason, '')), ''), payout_details = NULL,
               reviewed_by = auth.uid(), reviewed_at = NOW()
         WHERE id = p_claim_id
        RETURNING * INTO v_claim;
    END IF;
    RETURN v_claim;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION review_expense_claim(UUID, BOOLEAN, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION review_expense_claim(UUID, BOOLEAN, TEXT, TEXT) TO authenticated;

-- The expense is the record of whether the member was paid: ticking Reimbursed anywhere settles the
-- claim, and deleting the expense withdraws an unpaid one so the member isn't left waiting.
CREATE OR REPLACE FUNCTION sync_expense_claim()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        UPDATE expense_claims
           SET status = 'rejected', rejection_reason = 'Removed by the club', payout_details = NULL
         WHERE expense_id = OLD.id AND status = 'approved';
        RETURN OLD;
    END IF;
    UPDATE expense_claims
       SET status = CASE WHEN NEW.reimbursed THEN 'paid' ELSE 'approved' END,
           payout_details = CASE WHEN NEW.reimbursed THEN NULL ELSE payout_details END
     WHERE expense_id = NEW.id AND status IN ('approved', 'paid');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION sync_expense_claim() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_expense_claim_paid ON expenses;
CREATE TRIGGER trg_expense_claim_paid AFTER UPDATE OF reimbursed ON expenses
    FOR EACH ROW WHEN (OLD.reimbursed IS DISTINCT FROM NEW.reimbursed) EXECUTE FUNCTION sync_expense_claim();
-- BEFORE: by AFTER DELETE the foreign key has already blanked expense_claims.expense_id
DROP TRIGGER IF EXISTS trg_expense_claim_removed ON expenses;
CREATE TRIGGER trg_expense_claim_removed BEFORE DELETE ON expenses
    FOR EACH ROW EXECUTE FUNCTION sync_expense_claim();

NOTIFY pgrst, 'reload schema';
