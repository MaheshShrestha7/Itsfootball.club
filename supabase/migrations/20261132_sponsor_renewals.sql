-- ==============================================================================
-- Migration: sponsor renewals and end dates (SP-F5, SP-X5 from the 28 Oct 2026 sponsors review)
--
--   ends_on       The last day a sponsor shows on the club site. The day after, the site and
--                 sponsors_public leave them out, and the admin page lists them under Ended.
--                 Existing sponsors get no end date, so nobody comes off the site because of this.
--   link_sent_at  When the admin last emailed them a payment or renewal link.
--   access_key    A long random secret in those links, so only the sponsor can pay to renew
--                 (lib/payments-server.ts). Never shown on the public site.
--   fulfil_payment  A paid renewal moves ends_on a year on (from the old end date, or today if it
--                 has passed). Otherwise unchanged from 20261118_membership_payment_fixes.sql.
--
-- The site works before this runs: the end date, Renew and renewal link stay hidden until then.
-- Run after 20261131_sponsor_fixes.sql (and 20261118). Safe to run more than once.
-- ==============================================================================

ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS ends_on DATE;
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS link_sent_at TIMESTAMPTZ;
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS access_key TEXT;
-- gen_random_uuid() is core Postgres 13+ (no pgcrypto needed); two of them make 64 hex characters
ALTER TABLE sponsors ALTER COLUMN access_key
    SET DEFAULT replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
UPDATE sponsors
   SET access_key = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
 WHERE access_key IS NULL;

-- Same columns as 20261131, plus the end date check. The end day itself still shows; days are
-- counted in Sydney time, the site's time zone (lib/dates.ts SITE_TIME_ZONE).
CREATE OR REPLACE VIEW sponsors_public AS
    SELECT
        id, club_id, event_id, name, logo_url, website_url, tier, size_scale,
        display_order, is_active, season, label
    FROM sponsors
    WHERE is_active = TRUE
      AND COALESCE(package_status, '') NOT IN ('expired', 'cancelled')
      AND (ends_on IS NULL OR ends_on >= (NOW() AT TIME ZONE 'Australia/Sydney')::date);

GRANT SELECT ON sponsors_public TO anon, authenticated;

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
        -- A renewal: a sponsor already set up (not a new 'prospect') with an end date. Their end date
        -- moves a year on from the old one, or from today if it has passed, as Renew does in admin
        -- (lib/sponsors.ts renewedEndDate). SET expressions read the row as it was before.
        UPDATE sponsors
           SET ends_on = CASE
                   WHEN package_status IS DISTINCT FROM 'prospect' AND ends_on IS NOT NULL
                   THEN (GREATEST(ends_on, (NOW() AT TIME ZONE 'Australia/Sydney')::date) + INTERVAL '1 year')::date
                   ELSE ends_on
               END,
               package_status = 'paid',
               package_value = v_pay.amount_cents / 100.0,
               tier = COALESCE(v_tier, tier),
               season = CASE
                   WHEN package_status IS DISTINCT FROM 'prospect' AND ends_on IS NOT NULL THEN COALESCE(v_pay.season, season)
                   ELSE COALESCE(season, v_pay.season)
               END
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
