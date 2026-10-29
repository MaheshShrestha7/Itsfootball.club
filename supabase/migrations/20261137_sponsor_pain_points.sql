-- ==============================================================================
-- Migration: sponsor pain points from the 29 Oct 2026 review (reports/sponsor-pain-points-2026-10-29.md)
--
--   SPP-2  payments.due_on: an invoice the club sent before being paid ("Invoice me first", or Send
--          invoice in admin). It is a 'pending' sponsorship payment with a due date, numbered when
--          it's issued, and the same row becomes paid (by card, bank transfer or Record a payment),
--          so the invoice number never changes.
--   SPP-3  fulfil_payment: the first payment of a deal the admin set up by hand keeps the end date
--          they agreed (it was counted as a renewal and given an extra year). Record a payment in
--          admin calls it for cash, cheque and direct deposits.
--   SPP-4  sponsorship_packages.max_sponsors: how many of a package the club can sell (blank = no
--          limit), and sponsors.package_id: the package a sponsor holds. sponsor_package_spots()
--          tells the public sign-up page how many of each are taken, without showing who.
--
-- fulfil_payment is otherwise unchanged from 20261136_sponsor_workflow_fixes.sql. The app works
-- before this runs (these items stay hidden). Run after 20261136. Safe to run more than once.
-- ==============================================================================

ALTER TABLE payments ADD COLUMN IF NOT EXISTS due_on DATE;
ALTER TABLE sponsorship_packages ADD COLUMN IF NOT EXISTS max_sponsors INTEGER;
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS package_id UUID REFERENCES sponsorship_packages(id) ON DELETE SET NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sponsorship_packages_max_sponsors_check') THEN
        ALTER TABLE sponsorship_packages ADD CONSTRAINT sponsorship_packages_max_sponsors_check CHECK (max_sponsors IS NULL OR max_sponsors BETWEEN 1 AND 999);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS sponsors_package_idx ON sponsors (package_id) WHERE package_id IS NOT NULL;

-- Sponsors who already paid hold the package of their latest paid payment
UPDATE sponsors s
   SET package_id = last_paid.package_id
  FROM (
      SELECT DISTINCT ON (sponsor_id) sponsor_id, package_id
        FROM payments
       WHERE kind = 'sponsorship' AND status = 'paid' AND sponsor_id IS NOT NULL AND package_id IS NOT NULL
       ORDER BY sponsor_id, COALESCE(paid_at, created_at) DESC
  ) last_paid
 WHERE s.id = last_paid.sponsor_id AND s.package_id IS NULL
   AND EXISTS (SELECT 1 FROM sponsorship_packages p WHERE p.id = last_paid.package_id);

-- SPP-4: how many of each of a club's packages are taken. A sponsor holds its package while the
-- sponsorship runs (not ended, not past its end date) and is paid, agreed or on the site. A website
-- sign-up that hasn't paid holds it for 48 hours, or while their invoice or bank transfer receipt
-- is open. Counts only: nothing about who. lib/sponsors.ts holdsPackageSpot is the same rule.
CREATE OR REPLACE FUNCTION sponsor_package_spots(p_club_id UUID)
RETURNS TABLE (package_id UUID, taken INTEGER) AS $$
    SELECT s.package_id, COUNT(*)::INTEGER
      FROM sponsors s
     WHERE s.club_id = p_club_id
       AND s.package_id IS NOT NULL
       AND COALESCE(s.package_status, 'confirmed') NOT IN ('expired', 'cancelled')
       AND (s.ends_on IS NULL OR s.ends_on >= (NOW() AT TIME ZONE 'Australia/Sydney')::date)
       AND (
           s.package_status IN ('paid', 'confirmed')
           OR s.is_active
           OR s.created_at > NOW() - INTERVAL '48 hours'
           OR EXISTS (
               SELECT 1 FROM payments p
                WHERE p.sponsor_id = s.id AND p.kind = 'sponsorship'
                  AND (p.status = 'awaiting_review' OR (p.status = 'pending' AND p.due_on IS NOT NULL))
           )
       )
     GROUP BY s.package_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION sponsor_package_spots(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sponsor_package_spots(UUID) TO anon, authenticated, service_role;

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
    v_new_end DATE;
    v_first BOOLEAN;
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
        SELECT ends_on, package_status INTO v_old_end, v_old_status
          FROM sponsors WHERE id = v_pay.sponsor_id AND club_id = v_pay.club_id;
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
               package_status = 'paid',
               package_value = v_pay.amount_cents / 100.0,
               tier = COALESCE(v_tier, tier),
               -- SPP-4: the package this sponsor holds (counts towards its "how many can we sell")
               package_id = COALESCE(v_pay.package_id, package_id),
               season = CASE
                   WHEN NOT v_first AND ends_on IS NOT NULL THEN COALESCE(v_pay.season, season)
                   ELSE COALESCE(season, v_pay.season)
               END
          WHERE id = v_pay.sponsor_id AND club_id = v_pay.club_id;

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
