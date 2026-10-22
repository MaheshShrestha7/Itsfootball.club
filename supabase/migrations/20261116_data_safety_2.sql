-- ==============================================================================
-- Migration: data safety fixes from the project audit (2026-10-22)
--
--   SEC1  A public membership application can no longer mark its own fee as waived, and a waiver
--         only lets an unpaid application be approved when the club's policy allows waivers
--   SEC2  Platform admin by email only counts once that email is confirmed on the signed-in account
--   SEC3  Platform roles mean something: Super admins manage admins, Operators run clubs and
--         announcements, Analysts only look
--   SEC4  Platform announcement links must be web addresses or paths on this site
--   S9    The Stripe account id is no longer public (payers only see whether card payments are on),
--         and seed_club_default_team() can't be called from outside
--
-- Safe to run more than once.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- SEC1. Fee waivers are the club's decision, never the applicant's
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION clean_public_application()
RETURNS TRIGGER AS $$
BEGIN
    IF current_user IN ('anon', 'authenticated')
       AND NOT has_club_perm(NEW.club_id, '{squad,members,committee}', 'edit') THEN
        NEW.membership_starts_at := NULL;
        -- Only a placeholder until the club approves it or it's paid for (fulfil_payment)
        NEW.membership_expires_at := membership_term_end(NEW.club_id, CURRENT_DATE, 12);
        NEW.reviewed_at := NULL;
        NEW.reviewed_by := NULL;
        NEW.rejection_reason := NULL;
        NEW.executive_title := NULL;
        NEW.executive_bio := NULL;
        NEW.executive_order := NULL;
        NEW.executive_season := NULL;
        -- Set when an admin approves with a waiver (lib/club-context.tsx reviewMembership)
        NEW.fee_waived_at := NULL;
        NEW.fee_waived_by := NULL;
        NEW.fee_waiver_reason := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- The admin screen sets the waiver and the approval in one update, so a pending application that
-- already carries a waiver was filled in by the applicant
UPDATE club_members
   SET fee_waived_at = NULL, fee_waived_by = NULL, fee_waiver_reason = NULL
 WHERE membership_status = 'pending' AND fee_waived_at IS NOT NULL;

CREATE OR REPLACE FUNCTION guard_membership_approval()
RETURNS TRIGGER AS $$
DECLARE
    v_policy TEXT;
    v_plan_price INTEGER := 0;
    v_is_paid BOOLEAN := FALSE;
    v_waived BOOLEAN;
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

        -- A waiver only counts where the club allows waivers (lib/finance.ts policyAllowsWaiver)
        v_waived := NEW.fee_waived_at IS NOT NULL AND v_policy IN ('allow_waiver', 'auto_approve_with_waiver');

        IF COALESCE(v_plan_price, 0) > 0 AND NOT v_waived THEN
            SELECT EXISTS (
                SELECT 1 FROM payments pay
                 WHERE pay.member_id = NEW.id
                   AND pay.club_id = NEW.club_id
                   AND pay.kind = 'membership_signup'
                   AND pay.status = 'paid'
            ) INTO v_is_paid;

            IF NOT v_is_paid THEN
                RAISE EXCEPTION 'Payment required: the membership fee of $% has not been paid. Unpaid applications cannot be approved under this club''s policy.',
                    to_char(v_plan_price / 100.0, 'FM999999990.00') USING ERRCODE = '22023';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ------------------------------------------------------------------------------
-- SEC2 / SEC3. Platform admin roles
--   super_admin  everything, including adding and removing platform admins
--   operator     suspend clubs, announcements, grounds (everything except managing admins)
--   analyst      look only
-- An admin added by email before they had an account matches once they sign in with that email
-- confirmed; after that their account id is what counts.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION platform_admin_role()
RETURNS TEXT AS $$
    SELECT pa.role
      FROM platform_admins pa
     WHERE auth.uid() IS NOT NULL
       AND pa.is_active = TRUE
       AND (
           pa.user_id = auth.uid()
           OR (
               pa.user_id IS NULL
               AND EXISTS (
                   SELECT 1 FROM auth.users u
                    WHERE u.id = auth.uid()
                      AND u.email_confirmed_at IS NOT NULL
                      AND lower(u.email) = lower(pa.email)
               )
           )
       )
     ORDER BY CASE pa.role WHEN 'super_admin' THEN 0 WHEN 'operator' THEN 1 ELSE 2 END
     LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION platform_admin_role() TO authenticated, anon;

CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN AS $$
    SELECT platform_admin_role() IS NOT NULL;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION is_platform_admin() TO authenticated, anon;

CREATE OR REPLACE FUNCTION is_platform_operator()
RETURNS BOOLEAN AS $$
    SELECT COALESCE(platform_admin_role() IN ('super_admin', 'operator'), FALSE);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION is_platform_operator() TO authenticated, anon;

CREATE OR REPLACE FUNCTION is_platform_super_admin()
RETURNS BOOLEAN AS $$
    SELECT COALESCE(platform_admin_role() = 'super_admin', FALSE);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION is_platform_super_admin() TO authenticated, anon;

-- Link invited admins who have since signed up and confirmed that email
UPDATE platform_admins pa
   SET user_id = u.id, updated_at = NOW()
  FROM auth.users u
 WHERE pa.user_id IS NULL
   AND u.email_confirmed_at IS NOT NULL
   AND lower(u.email) = lower(pa.email);

-- Everyone on the list can see it; only Super admins change it
DROP POLICY IF EXISTS "Platform admins manage platform_admins" ON platform_admins;
DROP POLICY IF EXISTS "Super admins insert platform_admins" ON platform_admins;
DROP POLICY IF EXISTS "Super admins update platform_admins" ON platform_admins;
DROP POLICY IF EXISTS "Super admins delete platform_admins" ON platform_admins;
CREATE POLICY "Super admins insert platform_admins" ON platform_admins FOR INSERT
    WITH CHECK (is_platform_super_admin());
CREATE POLICY "Super admins update platform_admins" ON platform_admins FOR UPDATE
    USING (is_platform_super_admin()) WITH CHECK (is_platform_super_admin());
CREATE POLICY "Super admins delete platform_admins" ON platform_admins FOR DELETE
    USING (is_platform_super_admin());

CREATE OR REPLACE FUNCTION add_platform_admin(p_email TEXT, p_full_name TEXT DEFAULT NULL, p_role TEXT DEFAULT 'super_admin')
RETURNS VOID AS $$
DECLARE
    v_user_id UUID;
BEGIN
    IF NOT is_platform_super_admin() THEN
        RAISE EXCEPTION 'Only a Super admin can add platform admins.' USING ERRCODE = '42501';
    END IF;
    IF p_role NOT IN ('super_admin', 'operator', 'analyst') THEN
        RAISE EXCEPTION 'Pick Super admin, Operator or Analyst.' USING ERRCODE = '22023';
    END IF;

    -- Only an account that has confirmed this email is linked now; otherwise it links when they sign in
    SELECT id INTO v_user_id FROM auth.users
     WHERE lower(email) = lower(trim(p_email)) AND email_confirmed_at IS NOT NULL
     LIMIT 1;

    INSERT INTO platform_admins (user_id, email, full_name, role, is_active)
    VALUES (v_user_id, lower(trim(p_email)), p_full_name, p_role, TRUE)
    ON CONFLICT (email) DO UPDATE
       SET user_id = COALESCE(EXCLUDED.user_id, platform_admins.user_id),
           full_name = COALESCE(EXCLUDED.full_name, platform_admins.full_name),
           role = EXCLUDED.role,
           is_active = TRUE,
           updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION add_platform_admin(TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION remove_platform_admin(p_email TEXT)
RETURNS VOID AS $$
BEGIN
    IF NOT is_platform_super_admin() THEN
        RAISE EXCEPTION 'Only a Super admin can remove platform admins.' USING ERRCODE = '42501';
    END IF;

    -- Somebody must always be able to manage the list
    IF NOT EXISTS (
        SELECT 1 FROM platform_admins
         WHERE is_active = TRUE AND role = 'super_admin' AND lower(email) <> lower(trim(p_email))
    ) THEN
        RAISE EXCEPTION 'Cannot remove the last Super admin.' USING ERRCODE = '42501';
    END IF;

    UPDATE platform_admins
       SET is_active = FALSE,
           updated_at = NOW()
     WHERE lower(email) = lower(trim(p_email));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION remove_platform_admin(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION toggle_platform_club_status(p_club_id UUID, p_is_active BOOLEAN)
RETURNS BOOLEAN AS $$
BEGIN
    IF NOT is_platform_operator() THEN
        RAISE EXCEPTION 'Analysts can view clubs but not suspend or reactivate them.' USING ERRCODE = '42501';
    END IF;

    UPDATE clubs
       SET is_active = p_is_active,
           updated_at = NOW()
     WHERE id = p_club_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION toggle_platform_club_status(UUID, BOOLEAN) TO authenticated;

-- ------------------------------------------------------------------------------
-- SEC3 / SEC4. Announcements: Operators and Super admins post them, links must be safe
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Super admins manage platform announcements" ON platform_announcements;
DROP POLICY IF EXISTS "Operators insert platform announcements" ON platform_announcements;
DROP POLICY IF EXISTS "Operators update platform announcements" ON platform_announcements;
DROP POLICY IF EXISTS "Operators delete platform announcements" ON platform_announcements;
CREATE POLICY "Operators insert platform announcements" ON platform_announcements FOR INSERT
    WITH CHECK (is_platform_operator());
CREATE POLICY "Operators update platform announcements" ON platform_announcements FOR UPDATE
    USING (is_platform_operator()) WITH CHECK (is_platform_operator());
CREATE POLICY "Operators delete platform announcements" ON platform_announcements FOR DELETE
    USING (is_platform_operator());

-- https://… / http://… or a path on this site (/tools); NOT VALID leaves any older row as it is
ALTER TABLE platform_announcements DROP CONSTRAINT IF EXISTS platform_announcements_link_url_check;
ALTER TABLE platform_announcements ADD CONSTRAINT platform_announcements_link_url_check
    CHECK (link_url IS NULL OR link_url = '' OR link_url ~* '^(https?://[^\s]+|/[^/\s][^\s]*|/)$') NOT VALID;

-- ------------------------------------------------------------------------------
-- S9. Payment settings: payers see the currency, bank details and whether cards are on. The Stripe
-- account id is for the server only; the Finance page reads stripe_connected instead.
-- ------------------------------------------------------------------------------
ALTER TABLE club_payment_settings
    ADD COLUMN IF NOT EXISTS stripe_connected BOOLEAN GENERATED ALWAYS AS (stripe_account_id IS NOT NULL) STORED;

REVOKE SELECT ON club_payment_settings FROM anon, authenticated;
GRANT SELECT (club_id, currency, bank_details, stripe_charges_enabled, stripe_connected, updated_at)
    ON club_payment_settings TO anon, authenticated;

-- Only the club insert trigger (trg_seed_club_default_team, SECURITY DEFINER) needs this
REVOKE EXECUTE ON FUNCTION seed_club_default_team(UUID) FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
