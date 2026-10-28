-- ==============================================================================
-- Migration: sponsor workflow fixes from the 28 Oct 2026 end-to-end test (SPE-6 to SPE-24)
--
--   SPE-6   sponsors.went_live_at: when a sponsor first went on the site (set by a trigger when
--           is_active turns on). A paid sponsor hidden later is "Hidden", not a new sign-up.
--           Sponsors on the site today get their created_at.
--   SPE-14  payments.covers_from / covers_until: the period a sponsorship payment pays for, set by
--           fulfil_payment, so a renewal shows "7 Nov 2026 to 7 Nov 2027" instead of looking like
--           the first payment again.
--   SPE-16  sponsors.link_kind: whether the last link emailed was a payment or a renewal link.
--   SPE-17  sponsors.change_reviewed / change_reviewed_at: whether the club used or kept the old
--           logo or website the sponsor sent, shown on the sponsor's page.
--   SPE-7   People who can view Sponsors (e.g. Commercial Officer) can read sponsorship payments,
--           so the Sponsors page can say "Receipt to check" and keep a paid sponsor Paid.
--
-- fulfil_payment is otherwise unchanged from 20261135_sponsor_payment_fixes.sql. The app works
-- before this runs (these items then behave as before). Run after 20261135. Safe to run more than once.
-- ==============================================================================

ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS went_live_at TIMESTAMPTZ;
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS link_kind VARCHAR(10);
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS change_reviewed VARCHAR(10);
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS change_reviewed_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS covers_from DATE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS covers_until DATE;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sponsors_link_kind_check') THEN
        ALTER TABLE sponsors ADD CONSTRAINT sponsors_link_kind_check CHECK (link_kind IN ('payment', 'renewal'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sponsors_change_reviewed_check') THEN
        ALTER TABLE sponsors ADD CONSTRAINT sponsors_change_reviewed_check CHECK (change_reviewed IN ('used', 'kept'));
    END IF;
END $$;

DROP POLICY IF EXISTS "Sponsor staff read sponsorship payments" ON payments;
CREATE POLICY "Sponsor staff read sponsorship payments" ON payments FOR SELECT
    USING (kind = 'sponsorship' AND has_club_perm(club_id, '{sponsors}', 'view'));

-- SPE-6: the first time a sponsor is shown on the site, however it happens (Put on site, the Show
-- switch, an admin adding one that is shown straight away)
CREATE OR REPLACE FUNCTION sponsors_mark_went_live()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_active AND NEW.went_live_at IS NULL THEN
        NEW.went_live_at := NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS sponsors_went_live ON sponsors;
CREATE TRIGGER sponsors_went_live BEFORE INSERT OR UPDATE OF is_active ON sponsors
    FOR EACH ROW EXECUTE FUNCTION sponsors_mark_went_live();

UPDATE sponsors SET went_live_at = COALESCE(created_at, NOW()) WHERE is_active AND went_live_at IS NULL;

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
        -- SPE-14: the period this payment pays for, printed on the invoice and the sponsor's page
        SELECT ends_on INTO v_new_end FROM sponsors WHERE id = v_pay.sponsor_id AND club_id = v_pay.club_id;
        UPDATE payments
           SET covers_from = CASE
                   WHEN v_old_status = 'prospect' OR v_old_end IS NULL OR v_old_end < v_today THEN v_today
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

-- SPE-14: sponsorship payments made before this get the period they most likely paid for: the
-- year ending on the sponsor's end date, when that is the latest paid payment
UPDATE payments p
   SET covers_from = (s.ends_on - INTERVAL '1 year')::date,
       covers_until = s.ends_on
  FROM sponsors s
 WHERE p.sponsor_id = s.id AND p.kind = 'sponsorship' AND p.status = 'paid'
   AND p.covers_until IS NULL AND s.ends_on IS NOT NULL
   AND p.id = (SELECT p2.id FROM payments p2 WHERE p2.sponsor_id = s.id AND p2.kind = 'sponsorship' AND p2.status = 'paid'
                ORDER BY COALESCE(p2.paid_at, p2.created_at) DESC LIMIT 1);

NOTIFY pgrst, 'reload schema';
