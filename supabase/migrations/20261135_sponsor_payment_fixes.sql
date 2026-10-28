-- ==============================================================================
-- Migration: sponsor payment fixes from the 28 Oct 2026 end-to-end test
--
--   SPE-2  A website sign-up gets an end date when it's paid: a year from the payment, unless the admin
--          already set one. Until now it got none, so it never came up for renewal. Paid sign-ups
--          already on the site with no end date get a year from their last payment here, when that
--          is still in the future (older ones are left for the admin to set, so nobody disappears).
--          A renewal paid by a sponsor with no end date now runs a year from today.
--   SPE-5  payments.invoice_gst_registered / invoice_abn: the club's GST registration and ABN when a
--          sponsorship was paid. The invoice prints these, so ticking "Registered for GST" later
--          never turns an invoice already issued into a tax invoice (or back). Sponsorship payments
--          already paid are given today's settings, which is what their invoices showed until now.
--   (SPE-1, a second payment through an old link, is stopped in the app: lib/payments-server.ts.)
--
-- fulfil_payment is otherwise unchanged from 20261132_sponsor_renewals.sql. The app works before this
-- runs (invoices then follow today's settings, as before). Run after 20261134. Safe to run more than once.
-- ==============================================================================

ALTER TABLE payments ADD COLUMN IF NOT EXISTS invoice_gst_registered BOOLEAN;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS invoice_abn VARCHAR(14);

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
        -- SPE-2: a new sign-up (still 'prospect') runs a year from the day it's paid, unless the admin
        -- already gave it an end date. A renewal moves the end date a year on from the old one, or
        -- from today if it has passed (or there was none), as Renew does in admin
        -- (lib/sponsors.ts renewedEndDate). SET expressions read the row as it was before.
        UPDATE sponsors
           SET ends_on = CASE
                   WHEN package_status = 'prospect'
                   THEN COALESCE(ends_on, (v_today + INTERVAL '1 year')::date)
                   ELSE (GREATEST(COALESCE(ends_on, v_today), v_today) + INTERVAL '1 year')::date
               END,
               package_status = 'paid',
               package_value = v_pay.amount_cents / 100.0,
               tier = COALESCE(v_tier, tier),
               season = CASE
                   WHEN package_status IS DISTINCT FROM 'prospect' AND ends_on IS NOT NULL THEN COALESCE(v_pay.season, season)
                   ELSE COALESCE(season, v_pay.season)
               END
          WHERE id = v_pay.sponsor_id AND club_id = v_pay.club_id;

        -- SPE-5: the invoice keeps the GST registration and ABN the club had when this was paid
        UPDATE payments p
           SET invoice_gst_registered = COALESCE(s.gst_registered, FALSE),
               invoice_abn = s.abn
          FROM (SELECT v_pay.club_id AS club_id) c
          LEFT JOIN club_payment_settings s ON s.club_id = c.club_id
         WHERE p.id = v_pay.id AND p.invoice_gst_registered IS NULL
        RETURNING p.* INTO v_pay;
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

-- The payment's invoice number, giving it the club's next one if it has none yet. Also keeps the
-- club's GST registration and ABN on the payment if it has none yet (paid before 20261135)
CREATE OR REPLACE FUNCTION assign_invoice_number(p_payment_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_club UUID;
    v_number INTEGER;
BEGIN
    SELECT club_id, invoice_number INTO v_club, v_number FROM payments WHERE id = p_payment_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment not found';
    END IF;
    UPDATE payments p
       SET invoice_gst_registered = COALESCE(s.gst_registered, FALSE),
           invoice_abn = s.abn
      FROM (SELECT v_club AS club_id) c
      LEFT JOIN club_payment_settings s ON s.club_id = c.club_id
     WHERE p.id = p_payment_id AND p.invoice_gst_registered IS NULL;
    IF v_number IS NOT NULL THEN
        RETURN v_number;
    END IF;
    -- One number at a time per club, so two invoices opened together never get the same one
    PERFORM pg_advisory_xact_lock(hashtext('invoice:' || v_club::text));
    SELECT invoice_number INTO v_number FROM payments WHERE id = p_payment_id FOR UPDATE;
    IF v_number IS NOT NULL THEN
        RETURN v_number;
    END IF;
    SELECT COALESCE(MAX(invoice_number), 0) + 1 INTO v_number FROM payments WHERE club_id = v_club;
    UPDATE payments SET invoice_number = v_number WHERE id = p_payment_id;
    RETURN v_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION assign_invoice_number(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION assign_invoice_number(UUID) TO service_role;

-- SPE-5: sponsorship payments already paid keep the settings their invoices show today
UPDATE payments p
   SET invoice_gst_registered = COALESCE(s.gst_registered, FALSE),
       invoice_abn = s.abn
  FROM payments p2
  LEFT JOIN club_payment_settings s ON s.club_id = p2.club_id
 WHERE p.id = p2.id
   AND p.kind = 'sponsorship' AND p.status = 'paid' AND p.invoice_gst_registered IS NULL;

-- SPE-2: paid website sign-ups with no end date run a year from their last payment, if that's still ahead
UPDATE sponsors s
   SET ends_on = last_paid.ends_on
  FROM (
      SELECT sponsor_id, (MAX(COALESCE(paid_at, created_at)) AT TIME ZONE 'Australia/Sydney')::date + INTERVAL '1 year' AS ends_on
        FROM payments
       WHERE kind = 'sponsorship' AND status = 'paid' AND sponsor_id IS NOT NULL
       GROUP BY sponsor_id
  ) last_paid
 WHERE s.id = last_paid.sponsor_id
   AND s.ends_on IS NULL
   AND s.package_status = 'paid'
   AND last_paid.ends_on >= (NOW() AT TIME ZONE 'Australia/Sydney')::date;

NOTIFY pgrst, 'reload schema';
