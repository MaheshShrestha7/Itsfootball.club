-- ==============================================================================
-- Migration: membership payment fixes
-- Date: 2026-11-18
--
-- 1. fulfil_payment() failed for every membership payment on Supabase: 20261111 made it call
--    gen_random_bytes() (pgcrypto), which Supabase installs in the `extensions` schema, while the
--    function runs with search_path = public ("function gen_random_bytes(integer) does not exist").
--    That broke Finance -> Record income (membership), Verify on bank-transfer receipts and the
--    Stripe webhook for memberships. The new pass token now comes from gen_random_uuid(), which is
--    built into Postgres 13+ and needs no extension.
--
-- 2. A membership payment recorded by hand for someone whose application is still pending is their
--    sign-up payment, not a renewal: fulfil_payment now files it as 'membership_signup', so the
--    application counts as paid (guard_membership_approval) and the term starts today instead of
--    extending the placeholder expiry the application pre-filled.
--
-- 3. Repairs rows the bug above left behind: renewals recorded for still-pending applicants become
--    sign-ups, and the ones already paid get the term a sign-up would have given them.
--
-- Safe to run more than once. Needs 20261111_membership_payment_policy.sql.
-- ==============================================================================

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

REVOKE ALL ON FUNCTION fulfil_payment(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fulfil_payment(UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- Repairs
-- ------------------------------------------------------------------------------

-- Paid "renewals" for applications that are still pending: give them the term a sign-up payment
-- sets (from the day it was paid, not from the placeholder expiry)
UPDATE club_members m
   SET membership_starts_at = p.paid_at::date,
       membership_expires_at = membership_term_end(m.club_id, p.paid_at::date, COALESCE(pl.duration_months, 12)),
       updated_at = NOW()
  FROM payments p
  LEFT JOIN membership_plans pl ON pl.id = p.plan_id
 WHERE p.member_id = m.id
   AND p.club_id = m.club_id
   AND p.kind = 'membership_renewal'
   AND p.status = 'paid'
   AND p.paid_at IS NOT NULL
   AND m.membership_status = 'pending';

-- Then file every renewal recorded for a still-pending applicant as their sign-up payment
UPDATE payments p
   SET kind = 'membership_signup'
  FROM club_members m
 WHERE p.member_id = m.id
   AND p.club_id = m.club_id
   AND p.kind = 'membership_renewal'
   AND m.membership_status = 'pending';
