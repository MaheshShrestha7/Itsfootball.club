-- ==============================================================================
-- Migration: membership renewal method per club
-- Date: 2026-10-25
--
-- A club chooses how memberships run out (Finance -> Settings):
--   anniversary  year to year from the join date: joined 1 Aug 2025 -> renews 1 Aug 2026
--                (the plan's months; renewing early keeps the remaining days)
--   fiscal       everyone renews at the start of the club's fiscal year: with a July fiscal year,
--                joined 1 Aug 2025 -> renews 1 Jul 2026, renewed then -> 1 Jul 2027
-- The same rule lives in lib/finance.ts (membershipTermEnd) for members added in the app.
--
-- Safe to run more than once.
-- ==============================================================================

ALTER TABLE clubs ADD COLUMN IF NOT EXISTS membership_renewal TEXT NOT NULL DEFAULT 'anniversary';
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS fiscal_year_start_month SMALLINT NOT NULL DEFAULT 7;
ALTER TABLE clubs DROP CONSTRAINT IF EXISTS clubs_membership_renewal_check;
ALTER TABLE clubs ADD CONSTRAINT clubs_membership_renewal_check CHECK (membership_renewal IN ('anniversary', 'fiscal'));
ALTER TABLE clubs DROP CONSTRAINT IF EXISTS clubs_fiscal_year_start_month_check;
ALTER TABLE clubs ADD CONSTRAINT clubs_fiscal_year_start_month_check CHECK (fiscal_year_start_month BETWEEN 1 AND 12);

-- When a membership starting (or renewed) from p_from runs out
CREATE OR REPLACE FUNCTION membership_term_end(p_club_id UUID, p_from DATE, p_months INTEGER DEFAULT 12)
RETURNS DATE AS $$
    SELECT CASE
        WHEN c.membership_renewal = 'fiscal' THEN make_date(
            EXTRACT(YEAR FROM p_from)::INTEGER + CASE WHEN EXTRACT(MONTH FROM p_from) >= c.fiscal_year_start_month THEN 1 ELSE 0 END,
            c.fiscal_year_start_month, 1)
        ELSE (p_from + make_interval(months => COALESCE(p_months, 12)))::DATE
    END
    FROM clubs c WHERE c.id = p_club_id;
$$ LANGUAGE sql STABLE SET search_path = public;

-- Treasurers set it without needing the branding page's rights over the rest of the club row
CREATE OR REPLACE FUNCTION set_membership_renewal(p_club_id UUID, p_mode TEXT, p_fiscal_start_month INTEGER)
RETURNS VOID AS $$
BEGIN
    IF NOT has_club_perm(p_club_id, '{finance}', 'edit') THEN
        RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
    END IF;
    UPDATE clubs
       SET membership_renewal = p_mode,
           fiscal_year_start_month = COALESCE(p_fiscal_start_month, fiscal_year_start_month)
     WHERE id = p_club_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION set_membership_renewal(UUID, TEXT, INTEGER) TO authenticated;

-- Only that function (or a super user) changes the two columns
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
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Paid sign-ups and renewals follow the club's method (body unchanged otherwise)
CREATE OR REPLACE FUNCTION fulfil_payment(p_payment_id UUID)
RETURNS payments AS $$
DECLARE
    v_pay payments;
    v_months INTEGER;
    v_plan_name TEXT;
    v_tier TEXT;
    v_qty INTEGER;
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
        -- One ticket per unit bought. The checkout route caps the quantity at 10; 50 is a backstop.
        SELECT COALESCE(SUM((i->>'quantity')::INTEGER), 1) INTO v_qty
          FROM jsonb_array_elements(COALESCE(v_pay.items, '[]'::jsonb)) i;
        INSERT INTO event_attendees (event_id, club_id, attendee_name, attendee_email, payment_id)
        SELECT v_pay.event_id, v_pay.club_id, COALESCE(v_pay.payer_name, 'Ticket holder'), v_pay.payer_email, v_pay.id
          FROM generate_series(1, LEAST(GREATEST(v_qty, 1), 50));
    END IF;

    RETURN v_pay;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

NOTIFY pgrst, 'reload schema';
