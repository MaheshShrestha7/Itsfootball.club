-- ==============================================================================
-- Migration: auto-approve free supporter sign-ups (club setting)
-- Date: 2026-11-20
--
-- A club can choose to approve free supporter memberships straight away, so nobody waits for the
-- committee to approve a $0 pass. Off by default. Only these applications qualify:
--   * the club has the setting on (Finance -> Settings)
--   * the applicant joined as a supporter (players still need a committee check for teams)
--   * their plan is an active plan costing $0
--   * they are an adult: no parent / guardian email and no date of birth under 18
--   * the application is still pending, unreviewed and less than an hour old (the applicant's own
--     browser asks for it right after applying; it never approves an older or reviewed application)
--
-- Safe to run more than once.
-- ==============================================================================

ALTER TABLE clubs ADD COLUMN IF NOT EXISTS auto_approve_free BOOLEAN NOT NULL DEFAULT FALSE;

-- Setting it needs the same rights as the payment policy (Finance, Members or Committee edit)
CREATE OR REPLACE FUNCTION set_auto_approve_free(p_club_id UUID, p_on BOOLEAN)
RETURNS VOID AS $$
BEGIN
    IF NOT (has_club_perm(p_club_id, '{finance,members,committee}', 'edit') OR is_club_admin(p_club_id)) THEN
        RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
    END IF;
    UPDATE clubs SET auto_approve_free = COALESCE(p_on, FALSE) WHERE id = p_club_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION set_auto_approve_free(UUID, BOOLEAN) TO authenticated;

-- The background sync of the club row can't change it (same as the payment policy)
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
        -- Set through set_auto_approve_free() (Finance/Members edit)
        NEW.auto_approve_free := OLD.auto_approve_free;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Called by the applicant's browser right after applying (they are usually signed out).
-- Returns TRUE when the application was approved, FALSE when it waits for the committee.
CREATE OR REPLACE FUNCTION auto_approve_free_application(p_club_id UUID, p_member_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_member club_members;
    v_months INTEGER;
    v_age INTEGER;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM clubs WHERE id = p_club_id AND auto_approve_free AND is_active) THEN
        RETURN FALSE;
    END IF;

    SELECT * INTO v_member FROM club_members
     WHERE id = p_member_id AND club_id = p_club_id
     FOR UPDATE;
    IF NOT FOUND
       OR v_member.membership_status IS DISTINCT FROM 'pending'
       OR v_member.reviewed_at IS NOT NULL
       OR v_member.user_id IS NOT NULL
       OR lower(COALESCE(v_member.role, '')) <> 'supporter'
       OR COALESCE(v_member.applied_at, v_member.created_at) < NOW() - INTERVAL '1 hour'
       OR NULLIF(trim(COALESCE(v_member.guardian_email, '')), '') IS NOT NULL THEN
        RETURN FALSE;
    END IF;

    IF v_member.date_of_birth IS NOT NULL THEN
        v_age := date_part('year', age(CURRENT_DATE, v_member.date_of_birth::date));
        IF v_age < 18 THEN
            RETURN FALSE;
        END IF;
    END IF;

    SELECT duration_months INTO v_months
      FROM membership_plans
     WHERE club_id = p_club_id
       AND name = v_member.membership_tier
       AND COALESCE(is_active, TRUE)
       AND COALESCE(price_cents, 0) = 0
     LIMIT 1;
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    UPDATE club_members
       SET membership_status = 'approved',
           rejection_reason = NULL,
           reviewed_at = NOW(),
           reviewed_by = 'Automatic (free supporter plan)',
           membership_starts_at = CURRENT_DATE,
           membership_expires_at = membership_term_end(p_club_id, CURRENT_DATE, COALESCE(v_months, 12)),
           -- gen_random_uuid() is core Postgres (gen_random_bytes() needs pgcrypto on the path)
           qr_code_token = 'pass-' || replace(gen_random_uuid()::text, '-', ''),
           updated_at = NOW()
     WHERE id = p_member_id;

    INSERT INTO member_messages (club_id, member_id, sender_type, sender_name, subject, category, content)
    VALUES (p_club_id, p_member_id, 'admin', 'Club Administration', 'Welcome! Your member pass is active', 'Committee',
            'Welcome ' || v_member.full_name || '! Your ' || COALESCE(v_member.membership_tier, 'membership')
            || ' is active. Your member pass is ready in the app: show it at the gate or when you check in.');
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION auto_approve_free_application(UUID, UUID) TO anon, authenticated;
