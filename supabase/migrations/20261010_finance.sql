-- ==============================================================================
-- Migration: club finance - Stripe Connect / bank transfer payments, income & expenses
-- Date: 2026-10-10
--
-- club_payment_settings  one row per club: currency, bank details, connected Stripe account
-- membership_plans       priced membership tiers (name is written to club_members.membership_tier)
-- sponsorship_packages   priced sponsorship tiers for the public /sponsor page
-- payments               income ledger: every inflow, whatever the method
-- expenses               expenditure ledger
-- fulfil_payment()       marks a payment paid and applies it (membership expiry / sponsor status);
--                        called by the Stripe webhook (service role) and by admins verifying transfers
--
-- Payments are only created by the API routes (service role), never directly by visitors.
-- Receipts live in a private bucket and are only handed out as short-lived signed URLs.
--
-- Safe to run more than once.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Per-club payment settings
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS club_payment_settings (
    club_id UUID PRIMARY KEY REFERENCES clubs(id) ON DELETE CASCADE,
    currency CHAR(3) NOT NULL DEFAULT 'AUD' CHECK (currency ~ '^[A-Z]{3}$'),
    -- Free text shown to people paying by bank transfer (account name, BSB / IBAN, etc.)
    bank_details TEXT,
    -- Set by the server only (Stripe Connect onboarding + account.updated webhook)
    stripe_account_id TEXT UNIQUE,
    stripe_charges_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE club_payment_settings ENABLE ROW LEVEL SECURITY;

-- Payers need the currency, bank details and whether card payments are on
DROP POLICY IF EXISTS "Public payment settings read" ON club_payment_settings;
CREATE POLICY "Public payment settings read" ON club_payment_settings FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Club admin payment settings write" ON club_payment_settings;
CREATE POLICY "Club admin payment settings write" ON club_payment_settings FOR INSERT
    WITH CHECK (is_club_admin(club_id));
DROP POLICY IF EXISTS "Club admin payment settings update" ON club_payment_settings;
CREATE POLICY "Club admin payment settings update" ON club_payment_settings FOR UPDATE
    USING (is_club_admin(club_id)) WITH CHECK (is_club_admin(club_id));

-- Admins may only change currency and bank details; the Stripe columns belong to the server
REVOKE INSERT, UPDATE ON club_payment_settings FROM anon, authenticated;
GRANT INSERT (club_id, currency, bank_details, updated_at) ON club_payment_settings TO authenticated;
GRANT UPDATE (currency, bank_details, updated_at) ON club_payment_settings TO authenticated;

-- ------------------------------------------------------------------------------
-- 2. Membership plans and sponsorship packages
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS membership_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
    duration_months INTEGER NOT NULL DEFAULT 12 CHECK (duration_months BETWEEN 1 AND 60),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_membership_plans_club ON membership_plans (club_id, sort_order);

CREATE TABLE IF NOT EXISTS sponsorship_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    tier VARCHAR(32) NOT NULL DEFAULT 'gold' CHECK (tier IN ('platinum', 'gold', 'silver', 'bronze', 'grassroots')),
    price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
    benefits TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sponsorship_packages_club ON sponsorship_packages (club_id, sort_order);

ALTER TABLE membership_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsorship_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public membership plans read" ON membership_plans;
CREATE POLICY "Public membership plans read" ON membership_plans FOR SELECT
    USING (is_active OR is_club_admin(club_id));
DROP POLICY IF EXISTS "Club admin membership plans manage" ON membership_plans;
CREATE POLICY "Club admin membership plans manage" ON membership_plans FOR ALL
    USING (is_club_admin(club_id)) WITH CHECK (is_club_admin(club_id));

DROP POLICY IF EXISTS "Public sponsorship packages read" ON sponsorship_packages;
CREATE POLICY "Public sponsorship packages read" ON sponsorship_packages FOR SELECT
    USING (is_active OR is_club_admin(club_id));
DROP POLICY IF EXISTS "Club admin sponsorship packages manage" ON sponsorship_packages;
CREATE POLICY "Club admin sponsorship packages manage" ON sponsorship_packages FOR ALL
    USING (is_club_admin(club_id)) WITH CHECK (is_club_admin(club_id));

-- ------------------------------------------------------------------------------
-- 3. Income ledger
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    kind VARCHAR(32) NOT NULL CHECK (kind IN ('membership_signup', 'membership_renewal', 'sponsorship', 'income_other')),
    category VARCHAR(48) NOT NULL DEFAULT 'other' CHECK (category IN (
        'membership', 'sponsorship', 'match_fees', 'registration_fees', 'merchandise', 'events_tickets',
        'fundraising', 'donations', 'grants', 'bar_canteen', 'facility_hire', 'prize_money', 'other')),
    member_id UUID REFERENCES club_members(id) ON DELETE SET NULL,
    sponsor_id UUID REFERENCES sponsors(id) ON DELETE SET NULL,
    plan_id UUID REFERENCES membership_plans(id) ON DELETE SET NULL,
    package_id UUID REFERENCES sponsorship_packages(id) ON DELETE SET NULL,
    description TEXT,
    amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
    currency CHAR(3) NOT NULL DEFAULT 'AUD',
    method VARCHAR(16) NOT NULL CHECK (method IN ('stripe', 'bank_transfer', 'cash', 'other')),
    status VARCHAR(16) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'awaiting_review', 'paid', 'rejected', 'refunded', 'failed')),
    stripe_session_id TEXT UNIQUE,
    stripe_payment_intent_id TEXT,
    payer_name VARCHAR(255),
    payer_email VARCHAR(255),
    reference VARCHAR(64),
    receipt_key TEXT, -- private storage key, never a public URL
    season VARCHAR(32),
    notes TEXT,
    rejection_reason TEXT,
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_club ON payments (club_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_member ON payments (member_id);
CREATE INDEX IF NOT EXISTS idx_payments_intent ON payments (stripe_payment_intent_id);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Club admin payments manage" ON payments;
CREATE POLICY "Club admin payments manage" ON payments FOR ALL
    USING (is_club_admin(club_id)) WITH CHECK (is_club_admin(club_id));

-- Members see their own payment history
DROP POLICY IF EXISTS "Members read own payments" ON payments;
CREATE POLICY "Members read own payments" ON payments FOR SELECT
    USING (EXISTS (SELECT 1 FROM club_members m WHERE m.id = payments.member_id AND m.user_id = auth.uid()));

-- ------------------------------------------------------------------------------
-- 4. Expenditure ledger
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    category VARCHAR(48) NOT NULL DEFAULT 'other' CHECK (category IN (
        'facility_hire', 'referees', 'league_fees', 'insurance', 'kit_equipment', 'medical',
        'travel', 'coaching', 'events', 'catering', 'marketing', 'software', 'bank_fees',
        'utilities', 'maintenance', 'player_welfare', 'reimbursements', 'other')),
    description TEXT NOT NULL,
    vendor VARCHAR(255),
    amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
    currency CHAR(3) NOT NULL DEFAULT 'AUD',
    spent_on DATE NOT NULL DEFAULT CURRENT_DATE,
    method VARCHAR(16) NOT NULL DEFAULT 'bank_transfer' CHECK (method IN ('bank_transfer', 'card', 'cash', 'other')),
    receipt_key TEXT,
    paid_by_member_id UUID REFERENCES club_members(id) ON DELETE SET NULL,
    reimbursed BOOLEAN NOT NULL DEFAULT FALSE,
    season VARCHAR(32),
    created_by UUID DEFAULT auth.uid(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_expenses_club ON expenses (club_id, spent_on DESC);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Club admin expenses manage" ON expenses;
CREATE POLICY "Club admin expenses manage" ON expenses FOR ALL
    USING (is_club_admin(club_id)) WITH CHECK (is_club_admin(club_id));

-- Rows land in the club's current season unless one is given
CREATE OR REPLACE FUNCTION finance_default_season()
RETURNS TRIGGER AS $$
BEGIN
    NEW.season := COALESCE(NULLIF(trim(NEW.season), ''), club_current_season(NEW.club_id));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_payments_season ON payments;
CREATE TRIGGER trg_payments_season BEFORE INSERT ON payments
    FOR EACH ROW EXECUTE FUNCTION finance_default_season();
DROP TRIGGER IF EXISTS trg_expenses_season ON expenses;
CREATE TRIGGER trg_expenses_season BEFORE INSERT ON expenses
    FOR EACH ROW EXECUTE FUNCTION finance_default_season();

-- ------------------------------------------------------------------------------
-- 5. Fulfilment: one place that turns a payment into membership time / a paid sponsor.
--    Idempotent: a payment already marked paid is left alone, so replayed webhooks and
--    double clicks never extend a membership twice.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fulfil_payment(p_payment_id UUID)
RETURNS payments AS $$
DECLARE
    v_pay payments;
    v_months INTEGER;
    v_plan_name TEXT;
    v_tier TEXT;
BEGIN
    SELECT * INTO v_pay FROM payments WHERE id = p_payment_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment not found';
    END IF;
    -- The webhook runs as service_role; anyone else must administer the payment's club
    IF COALESCE(auth.role(), '') <> 'service_role' AND NOT is_club_admin(v_pay.club_id) THEN
        RAISE EXCEPTION 'Not allowed';
    END IF;
    IF v_pay.status = 'paid' THEN
        RETURN v_pay;
    END IF;
    IF v_pay.status IN ('refunded', 'rejected') AND COALESCE(auth.role(), '') = 'service_role' THEN
        RETURN v_pay; -- a late webhook never revives a payment an admin already closed
    END IF;

    UPDATE payments
       SET status = 'paid',
           paid_at = COALESCE(paid_at, NOW()),
           reviewed_by = CASE WHEN method = 'stripe' THEN reviewed_by ELSE auth.uid() END,
           reviewed_at = CASE WHEN method = 'stripe' THEN reviewed_at ELSE NOW() END,
           rejection_reason = NULL
     WHERE id = p_payment_id
    RETURNING * INTO v_pay;

    IF v_pay.kind IN ('membership_signup', 'membership_renewal') AND v_pay.member_id IS NOT NULL THEN
        SELECT duration_months, name INTO v_months, v_plan_name FROM membership_plans WHERE id = v_pay.plan_id;
        v_months := COALESCE(v_months, 12);
        UPDATE club_members
           SET membership_expires_at = CASE
                   -- A new member's time starts today (the application pre-fills a placeholder expiry)
                   WHEN v_pay.kind = 'membership_signup' THEN CURRENT_DATE
                   -- Renewing early keeps the remaining days
                   ELSE GREATEST(CURRENT_DATE, COALESCE(membership_expires_at, CURRENT_DATE))
               END + make_interval(months => v_months),
               membership_tier = COALESCE(v_plan_name, membership_tier),
               updated_at = NOW()
         WHERE id = v_pay.member_id AND club_id = v_pay.club_id;
    ELSIF v_pay.kind = 'sponsorship' AND v_pay.sponsor_id IS NOT NULL THEN
        SELECT tier INTO v_tier FROM sponsorship_packages WHERE id = v_pay.package_id;
        UPDATE sponsors
           SET package_status = 'paid',
               package_value = v_pay.amount_cents / 100.0,
               tier = COALESCE(v_tier, tier),
               season = COALESCE(season, v_pay.season)
         WHERE id = v_pay.sponsor_id AND club_id = v_pay.club_id;
    END IF;

    RETURN v_pay;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION fulfil_payment(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fulfil_payment(UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 6. Private receipts bucket (Supabase Storage fallback when R2 isn't configured).
--    No policies: only the service role reads or writes it.
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('receipts', 'receipts', FALSE, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = FALSE;

NOTIFY pgrst, 'reload schema';
