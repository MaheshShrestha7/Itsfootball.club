-- ==============================================================================
-- Migration: applicants can see (and redo) their own membership application
-- Date: 2026-10-29
--
-- A pending or rejected applicant who signed in only saw "no approved membership": their row
-- isn't linked to their account until it is approved, so row-level security hid it. These read
-- it (and reopen a rejected one) by the account's confirmed email, like claim_member_profile().
--
-- Safe to run more than once.
-- ==============================================================================

-- 1. The signed-in user's pending or rejected application at a club, if any
CREATE OR REPLACE FUNCTION my_membership_application(p_club_id UUID)
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    email TEXT,
    phone TEXT,
    membership_tier TEXT,
    membership_status TEXT,
    rejection_reason TEXT,
    application_notes TEXT,
    player_position TEXT,
    jersey_number INTEGER,
    applied_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    -- Sign-up fee paid by card, or a bank receipt waiting for the treasurer
    signup_paid BOOLEAN
) AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
        SELECT m.id, m.full_name::TEXT, m.email::TEXT, m.phone::TEXT, m.membership_tier::TEXT,
               m.membership_status::TEXT, m.rejection_reason, m.application_notes,
               m.player_position::TEXT, m.jersey_number, m.applied_at, m.reviewed_at,
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

-- 2. Apply again after a rejection: the same row goes back to the committee as pending.
--    (A second row isn't possible: one application per email per club.)
CREATE OR REPLACE FUNCTION reapply_for_membership(
    p_club_id UUID,
    p_full_name TEXT,
    p_phone TEXT,
    p_tier TEXT,
    p_position TEXT,
    p_jersey INTEGER,
    p_notes TEXT
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

    UPDATE club_members m
       SET full_name = left(trim(p_full_name), 255),
           phone = NULLIF(left(trim(COALESCE(p_phone, '')), 64), ''),
           membership_tier = left(trim(p_tier), 32),
           -- Same rule as applyForMembership() in lib/club-context.tsx
           role = CASE WHEN lower(p_tier) LIKE '%supporter%' THEN 'supporter' ELSE 'player' END,
           roles = '[]'::jsonb,
           player_position = NULLIF(p_position, ''),
           jersey_number = p_jersey,
           application_notes = NULLIF(left(COALESCE(p_notes, ''), 2000), ''),
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

REVOKE ALL ON FUNCTION reapply_for_membership(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION reapply_for_membership(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
