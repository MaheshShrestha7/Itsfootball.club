-- ==============================================================================
-- Migration: membership application details (consent, guardian, role) and re-applying with them
-- Date: 2026-10-30
--
-- The application form now records when the applicant accepted the club's terms and privacy
-- policy, and when a parent or guardian consented for an applicant under 18. Applicants pick
-- whether they join as a player or a supporter instead of the role being guessed from the tier.
-- my_membership_application / reapply_for_membership (20261029) carry the new fields.
--
-- Safe to run more than once.
-- ==============================================================================

ALTER TABLE club_members ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
ALTER TABLE club_members ADD COLUMN IF NOT EXISTS guardian_consent_at TIMESTAMPTZ;

-- 1. The applicant's own pending or rejected application, now with the new fields
DROP FUNCTION IF EXISTS my_membership_application(UUID);
CREATE FUNCTION my_membership_application(p_club_id UUID)
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    email TEXT,
    phone TEXT,
    role TEXT,
    membership_tier TEXT,
    membership_status TEXT,
    rejection_reason TEXT,
    application_notes TEXT,
    player_position TEXT,
    jersey_number INTEGER,
    date_of_birth DATE,
    emergency_contact TEXT,
    applied_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    signup_paid BOOLEAN
) AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
        SELECT m.id, m.full_name::TEXT, m.email::TEXT, m.phone::TEXT, m.role::TEXT, m.membership_tier::TEXT,
               m.membership_status::TEXT, m.rejection_reason, m.application_notes,
               m.player_position::TEXT, m.jersey_number, m.date_of_birth, m.emergency_contact::TEXT,
               m.applied_at, m.reviewed_at,
               EXISTS (
                   SELECT 1 FROM payments p
                    WHERE p.member_id = m.id AND p.kind = 'membership_signup'
                      AND p.status IN ('paid', 'awaiting_review')
               )
          FROM club_members m
          JOIN auth.users u ON u.id = auth.uid()
         WHERE m.club_id = p_club_id
           AND m.user_id IS NULL
           AND m.membership_status IN ('pending', 'rejected')
           AND u.email_confirmed_at IS NOT NULL
           AND lower(m.email) = lower(u.email)
         LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION my_membership_application(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION my_membership_application(UUID) TO authenticated;

-- 2. Apply again after a rejection, with every field of the application form
DROP FUNCTION IF EXISTS reapply_for_membership(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT);
DROP FUNCTION IF EXISTS reapply_for_membership(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, DATE, TEXT, BOOLEAN, BOOLEAN);
CREATE FUNCTION reapply_for_membership(
    p_club_id UUID,
    p_full_name TEXT,
    p_phone TEXT,
    p_tier TEXT,
    p_role TEXT,
    p_position TEXT,
    p_jersey INTEGER,
    p_notes TEXT,
    p_date_of_birth DATE,
    p_emergency_contact TEXT,
    p_terms_accepted BOOLEAN,
    p_guardian_consent BOOLEAN
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Sign in to apply again' USING ERRCODE = '42501';
    END IF;
    IF COALESCE(trim(p_full_name), '') = '' OR COALESCE(trim(p_tier), '') = '' THEN
        RAISE EXCEPTION 'Name and membership tier are required' USING ERRCODE = '22023';
    END IF;
    IF NOT COALESCE(p_terms_accepted, FALSE) THEN
        RAISE EXCEPTION 'Please accept the terms and privacy policy' USING ERRCODE = '22023';
    END IF;

    UPDATE club_members m
       SET full_name = left(trim(p_full_name), 255),
           phone = NULLIF(left(trim(COALESCE(p_phone, '')), 64), ''),
           membership_tier = left(trim(p_tier), 32),
           -- Only the roles a public application may have (see the insert policy)
           role = CASE WHEN p_role = 'supporter' THEN 'supporter' ELSE 'player' END,
           roles = '[]'::jsonb,
           player_position = CASE WHEN p_role = 'supporter' THEN NULL ELSE NULLIF(p_position, '') END,
           jersey_number = CASE WHEN p_role = 'supporter' THEN NULL ELSE p_jersey END,
           application_notes = NULLIF(left(COALESCE(p_notes, ''), 2000), ''),
           date_of_birth = p_date_of_birth,
           emergency_contact = NULLIF(left(trim(COALESCE(p_emergency_contact, '')), 255), ''),
           terms_accepted_at = NOW(),
           guardian_consent_at = CASE WHEN COALESCE(p_guardian_consent, FALSE) THEN NOW() END,
           membership_status = 'pending',
           rejection_reason = NULL,
           reviewed_at = NULL,
           reviewed_by = NULL,
           applied_at = NOW(),
           updated_at = NOW()
      FROM auth.users u
     WHERE u.id = auth.uid()
       AND u.email_confirmed_at IS NOT NULL
       AND m.club_id = p_club_id
       AND m.user_id IS NULL
       AND m.membership_status = 'rejected'
       AND COALESCE(m.is_executive, FALSE) = FALSE
       AND lower(m.email) = lower(u.email)
    RETURNING m.id INTO v_id;

    IF v_id IS NULL THEN
        RAISE EXCEPTION 'No rejected application to reopen' USING ERRCODE = 'P0002';
    END IF;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION reapply_for_membership(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, DATE, TEXT, BOOLEAN, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION reapply_for_membership(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, DATE, TEXT, BOOLEAN, BOOLEAN) TO authenticated;

NOTIFY pgrst, 'reload schema';
