-- ==============================================================================
-- Migration: sponsors paying by instalments
-- Date: 2026-11-07
--
-- An instalment is an ordinary sponsorship invoice (a 'pending' payments row with a due_on) that shares
-- an instalment_plan_id with the rest of its plan. Each has its own invoice number and pay link.
--
-- fulfil_payment treats the plan as ONE sponsorship term:
--   first instalment paid   sets the term as a normal payment does, the deal's value to the plan's total,
--                           and puts the sponsor on the site, unless an admin had taken them off it
--   later instalments       change nothing about the term, value, tier or site visibility
--   nothing left to pay     'paid'; until then the sponsor stays 'confirmed'
--
-- fulfil_payment is otherwise unchanged from 20261137_sponsor_pain_points.sql. The app works before this
-- migration: instalment plans just can't be created yet.
-- Safe to run more than once.
-- ==============================================================================

ALTER TABLE payments ADD COLUMN IF NOT EXISTS instalment_plan_id UUID;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS instalment_no INTEGER;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS instalment_of INTEGER;
CREATE INDEX IF NOT EXISTS idx_payments_instalment_plan ON payments (instalment_plan_id) WHERE instalment_plan_id IS NOT NULL;

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_instalment_check;
ALTER TABLE payments ADD CONSTRAINT payments_instalment_check CHECK (
    instalment_plan_id IS NULL
    OR (kind = 'sponsorship' AND due_on IS NOT NULL AND instalment_no BETWEEN 1 AND instalment_of AND instalment_of BETWEEN 2 AND 12)
);

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
    -- Days are counted in Sydney time, the site's time zone (lib/dates.ts SITE_TIME_ZONE)
    v_today DATE := (NOW() AT TIME ZONE 'Australia/Sydney')::date;
    v_old_end DATE;
    v_old_status TEXT;
    v_old_live TIMESTAMPTZ;
    v_new_end DATE;
    v_first BOOLEAN;
    -- Instalments: an earlier one is already paid, others are still to come, and what the plan adds up to
    v_later BOOLEAN := FALSE;
    v_more_to_come BOOLEAN := FALSE;
    v_plan_total BIGINT;
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
           rejection_reason = NULL,
           -- Paying for an application that is still pending is the sign-up payment
           kind = CASE
               WHEN kind = 'membership_renewal' AND EXISTS (
                   SELECT 1 FROM club_members m
                    WHERE m.id = payments.member_id AND m.club_id = payments.club_id
                      AND m.membership_status = 'pending'
               ) THEN 'membership_signup'
               ELSE kind
           END
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
                   -- gen_random_uuid() is core Postgres; gen_random_bytes() needs pgcrypto on the path
                   THEN 'pass-' || replace(gen_random_uuid()::text, '-', '')
                   ELSE qr_code_token
               END,
               updated_at = NOW()
         WHERE id = v_pay.member_id AND club_id = v_pay.club_id;
    ELSIF v_pay.kind = 'sponsorship' AND v_pay.sponsor_id IS NOT NULL THEN
        SELECT tier INTO v_tier FROM sponsorship_packages WHERE id = v_pay.package_id;
        -- SPE-14: what the sponsorship looked like before, for the period this payment covers
        SELECT ends_on, package_status, went_live_at INTO v_old_end, v_old_status, v_old_live
          FROM sponsors WHERE id = v_pay.sponsor_id AND club_id = v_pay.club_id;

        IF v_pay.instalment_plan_id IS NOT NULL THEN
            SELECT COALESCE(BOOL_OR(p2.status = 'paid' AND p2.id <> v_pay.id), FALSE),
                   COALESCE(BOOL_OR(p2.status IN ('pending', 'awaiting_review') AND p2.id <> v_pay.id), FALSE),
                   SUM(p2.amount_cents) FILTER (WHERE p2.status IN ('paid', 'pending', 'awaiting_review'))
              INTO v_later, v_more_to_come, v_plan_total
              FROM payments p2 WHERE p2.instalment_plan_id = v_pay.instalment_plan_id;
        END IF;

        IF v_later THEN
            -- The term was set by the first instalment. The last one only finishes paying for it; a
            -- sponsorship the club has since ended stays ended.
            UPDATE sponsors SET package_status = 'paid'
             WHERE id = v_pay.sponsor_id AND club_id = v_pay.club_id
               AND package_status = 'confirmed' AND NOT v_more_to_come;
        ELSE
            -- SPP-3: the first payment of a deal the admin set up by hand ('confirmed', with the end date
            -- they agreed) is not a renewal, so it keeps that end date instead of adding a year to it
            v_first := v_old_status IN ('prospect', 'confirmed') AND NOT EXISTS (
                SELECT 1 FROM payments p2
                 WHERE p2.sponsor_id = v_pay.sponsor_id AND p2.kind = 'sponsorship' AND p2.status = 'paid' AND p2.id <> v_pay.id
            );
            -- SPE-2: a first payment runs a year from the day it's paid, unless the sponsorship already has
            -- an end date still ahead. A renewal moves the end date a year on from the old one, or from
            -- today if it has passed (or there was none), as Renew does in admin (lib/sponsors.ts
            -- renewedEndDate). SET expressions read the row as it was before.
            UPDATE sponsors
               SET ends_on = CASE
                       WHEN v_first AND ends_on >= v_today THEN ends_on
                       WHEN v_first THEN (v_today + INTERVAL '1 year')::date
                       ELSE (GREATEST(COALESCE(ends_on, v_today), v_today) + INTERVAL '1 year')::date
                   END,
                   -- Instalments still to come: the deal is agreed but not yet fully paid
                   package_status = CASE WHEN v_more_to_come THEN 'confirmed' ELSE 'paid' END,
                   -- The whole deal, not this one instalment
                   package_value = COALESCE(v_plan_total, v_pay.amount_cents) / 100.0,
                   tier = COALESCE(v_tier, tier),
                   -- SPP-4: the package this sponsor holds (counts towards its "how many can we sell")
                   package_id = COALESCE(v_pay.package_id, package_id),
                   season = CASE
                       WHEN NOT v_first AND ends_on IS NOT NULL THEN COALESCE(v_pay.season, season)
                       ELSE COALESCE(season, v_pay.season)
                   END,
                   -- A plan's first payment puts them on the site. Not if an admin took them off it: they
                   -- have been live before, and the sponsorship hasn't ended. Without a plan, as before.
                   is_active = CASE
                       WHEN v_pay.instalment_plan_id IS NOT NULL
                            AND (v_old_live IS NULL OR v_old_status IN ('expired', 'cancelled')) THEN TRUE
                       ELSE is_active
                   END
              WHERE id = v_pay.sponsor_id AND club_id = v_pay.club_id;
        END IF;

        -- SPE-5: the invoice keeps the GST registration and ABN the club had when this was paid
        -- (or when the invoice was issued, for one sent before payment: SPP-2)
        UPDATE payments p
           SET invoice_gst_registered = COALESCE(s.gst_registered, FALSE),
               invoice_abn = s.abn
          FROM (SELECT v_pay.club_id AS club_id) c
          LEFT JOIN club_payment_settings s ON s.club_id = c.club_id
         WHERE p.id = v_pay.id AND p.invoice_gst_registered IS NULL
        RETURNING p.* INTO v_pay;
        -- SPE-14: the period this payment pays for, printed on the invoice and the sponsor's page
        SELECT ends_on INTO v_new_end FROM sponsors WHERE id = v_pay.sponsor_id AND club_id = v_pay.club_id;
        UPDATE payments
           SET covers_from = CASE
                   -- Every instalment pays for the term the first one started
                   WHEN v_later THEN (SELECT MIN(p2.covers_from) FROM payments p2
                                       WHERE p2.instalment_plan_id = v_pay.instalment_plan_id AND p2.status = 'paid')
                   WHEN v_first OR v_old_end IS NULL OR v_old_end < v_today THEN v_today
                   ELSE v_old_end
               END,
               covers_until = v_new_end
         WHERE id = v_pay.id AND covers_until IS NULL;
        SELECT * INTO v_pay FROM payments WHERE id = p_payment_id;
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

REVOKE ALL ON FUNCTION fulfil_payment(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fulfil_payment(UUID) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
