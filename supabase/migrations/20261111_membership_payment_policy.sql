-- ==============================================================================
-- Migration: membership signup payment policy & approval controls
-- Date: 2026-11-11
--
-- Clubs configure how member applications are approved:
--   1. require_payment (Default):
--      Priced membership tiers must be paid (Stripe or Finance verified) before
--      an application can be approved. Approving unpaid applications is blocked.
--   2. allow_waiver:
--      Payment required by default, but admins can waive fees with a recorded reason
--      (hardship, scholarship, life member) and approve.
--   3. auto_approve / auto_approve_with_waiver:
--      Automatically approves the application and activates digital turnstile pass
--      immediately when the signup payment is fulfilled. Unpaid manual approval is blocked.
--
-- Safe to run more than once.
-- ==============================================================================

-- 1. Club policy column
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS membership_payment_policy TEXT NOT NULL DEFAULT 'require_payment';
ALTER TABLE clubs DROP CONSTRAINT IF EXISTS clubs_membership_payment_policy_check;
ALTER TABLE clubs ADD CONSTRAINT clubs_membership_payment_policy_check
    CHECK (membership_payment_policy IN ('require_payment', 'allow_waiver', 'auto_approve', 'auto_approve_with_waiver'));

-- 2. Audit columns for fee waivers on member records
ALTER TABLE club_members ADD COLUMN IF NOT EXISTS fee_waived_at TIMESTAMPTZ;
ALTER TABLE club_members ADD COLUMN IF NOT EXISTS fee_waived_by TEXT;
ALTER TABLE club_members ADD COLUMN IF NOT EXISTS fee_waiver_reason TEXT;

-- 3. Setting function with permission check (finance, members, or committee edit)
CREATE OR REPLACE FUNCTION set_membership_payment_policy(p_club_id UUID, p_policy TEXT)
RETURNS VOID AS $$
BEGIN
    IF NOT (has_club_perm(p_club_id, '{finance,members,committee}', 'edit') OR is_club_admin(p_club_id)) THEN
        RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
    END IF;
    IF p_policy NOT IN ('require_payment', 'allow_waiver', 'auto_approve', 'auto_approve_with_waiver') THEN
        RAISE EXCEPTION 'Invalid policy' USING ERRCODE = '22023';
    END IF;
    UPDATE clubs
       SET membership_payment_policy = p_policy
     WHERE id = p_club_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION set_membership_payment_policy(UUID, TEXT) TO authenticated;

-- 4. Guard policy column from unprivileged updates on clubs table
CREATE OR REPLACE FUNCTION keep_club_admin_fields()
RETURNS TRIGGER AS $$
BEGIN
    IF current_user = 'authenticated' AND NOT is_club_admin(OLD.id) THEN
        NEW.slug := OLD.slug;
        NEW.previous_slugs := OLD.previous_slugs;
        NEW.custom_domain := OLD.custom_domain;
        NEW.is_active := OLD.is_active;
        NEW.email_settings := OLD.email_settings;
        -- Set through set_membership_renewal() (Finance edit)
        NEW.membership_renewal := OLD.membership_renewal;
        NEW.fiscal_year_start_month := OLD.fiscal_year_start_month;
        NEW.fiscal_grace_days := OLD.fiscal_grace_days;
        -- Set through set_membership_payment_policy() (Finance/Members edit)
        NEW.membership_payment_policy := OLD.membership_payment_policy;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 5. Fulfilment handles auto-approval if the club has configured setting 3
CREATE OR REPLACE FUNCTION fulfil_payment(p_payment_id UUID)
RETURNS payments AS $$
DECLARE
    v_pay payments;
    v_months INTEGER;
    v_plan_name TEXT;
    v_tier TEXT;
    v_qty INTEGER;
    v_policy TEXT;
    v_auto_approve BOOLEAN := FALSE;
BEGIN
    SELECT * INTO v_pay FROM payments WHERE id = p_payment_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment not found';
    END IF;
    -- The webhook runs as service_role; anyone else must administer the payment's club
    IF COALESCE(auth.role(), '') <> 'service_role' AND NOT has_club_perm(v_pay.club_id, '{finance}', 'edit') THEN
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

        SELECT membership_payment_policy INTO v_policy FROM clubs WHERE id = v_pay.club_id;
        v_auto_approve := (v_policy IN ('auto_approve', 'auto_approve_with_waiver') AND v_pay.kind = 'membership_signup');

        UPDATE club_members
           SET membership_starts_at = CASE
                   WHEN v_pay.kind = 'membership_signup' THEN CURRENT_DATE
                   -- Lapsed (or never set): a new term starts today; otherwise the term continues
                   WHEN membership_expires_at IS NULL OR membership_expires_at < CURRENT_DATE
                        OR membership_starts_at IS NULL THEN CURRENT_DATE
                   ELSE membership_starts_at
               END,
               -- Year to year or fiscal year, as the club has chosen (membership_term_end)
               membership_expires_at = membership_term_end(v_pay.club_id, CASE
                   -- A new member's time starts today (the application pre-fills a placeholder expiry)
                   WHEN v_pay.kind = 'membership_signup' THEN CURRENT_DATE
                   -- Renewing early keeps the remaining days
                   ELSE GREATEST(CURRENT_DATE, COALESCE(membership_expires_at, CURRENT_DATE))
               END, v_months),
               membership_tier = COALESCE(v_plan_name, membership_tier),
               membership_status = CASE WHEN v_auto_approve THEN 'approved' ELSE membership_status END,
               reviewed_at = CASE WHEN v_auto_approve THEN NOW() ELSE reviewed_at END,
               reviewed_by = CASE WHEN v_auto_approve THEN 'Automated (Payment Confirmed)' ELSE reviewed_by END,
               qr_code_token = CASE
                   WHEN v_auto_approve AND (qr_code_token IS NULL OR qr_code_token LIKE 'pass-pending%')
                   THEN 'pass-' || encode(gen_random_bytes(16), 'hex')
                   ELSE qr_code_token
               END,
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
    ELSIF v_pay.kind = 'event_ticket' AND v_pay.event_id IS NOT NULL THEN
        SELECT COALESCE(SUM((i->>'quantity')::INTEGER), 1) INTO v_qty
          FROM jsonb_array_elements(COALESCE(v_pay.items, '[]'::jsonb)) i;
        INSERT INTO event_attendees (event_id, club_id, attendee_name, attendee_email, payment_id)
        SELECT v_pay.event_id, v_pay.club_id, COALESCE(v_pay.payer_name, 'Ticket holder'), v_pay.payer_email, v_pay.id
          FROM generate_series(1, LEAST(GREATEST(v_qty, 1), 50));
    END IF;

    RETURN v_pay;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Trigger enforcing payment requirement before approving membership applications
CREATE OR REPLACE FUNCTION guard_membership_approval()
RETURNS TRIGGER AS $$
DECLARE
    v_policy TEXT;
    v_plan_price INTEGER := 0;
    v_is_paid BOOLEAN := FALSE;
BEGIN
    -- Only check transitions to 'approved'
    IF (OLD.membership_status IS DISTINCT FROM 'approved') AND NEW.membership_status = 'approved' THEN
        -- Automated fulfilment via service_role is trusted
        IF current_user = 'service_role' OR COALESCE(auth.role(), '') = 'service_role' THEN
            RETURN NEW;
        END IF;

        SELECT COALESCE(c.membership_payment_policy, 'require_payment') INTO v_policy
          FROM clubs c WHERE c.id = NEW.club_id;

        -- Plan price check
        SELECT COALESCE(p.price_cents, 0) INTO v_plan_price
          FROM membership_plans p
         WHERE p.club_id = NEW.club_id AND p.name = NEW.membership_tier
         LIMIT 1;

        -- If tier has a cost (> 0) and fee was not waived
        IF v_plan_price > 0 AND NEW.fee_waived_at IS NULL THEN
            SELECT EXISTS (
                SELECT 1 FROM payments pay
                 WHERE pay.member_id = NEW.id
                   AND pay.club_id = NEW.club_id
                   AND pay.kind = 'membership_signup'
                   AND pay.status = 'paid'
            ) INTO v_is_paid;

            IF NOT v_is_paid THEN
                RAISE EXCEPTION 'Payment required: Membership fee of % has not been paid. Unpaid applications cannot be approved under this club''s policy.',
                    (v_plan_price / 100.0)::text USING ERRCODE = '22023';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_guard_membership_approval ON club_members;
CREATE TRIGGER trg_guard_membership_approval
    BEFORE UPDATE OF membership_status ON club_members
    FOR EACH ROW EXECUTE FUNCTION guard_membership_approval();

NOTIFY pgrst, 'reload schema';
