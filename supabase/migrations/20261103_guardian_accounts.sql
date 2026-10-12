-- ==============================================================================
-- Migration: parent / guardian accounts
-- Date: 2026-11-03
--
-- A parent signs in once with their own email and looks after every child whose
-- club_members.guardian_email (20261102_junior_safeguarding.sql) is that email: they see each
-- child's application or pass, message the club about them and pay their fees.
--
-- The link is the guardian's *confirmed* sign-in email, never club_members.user_id: user_id means
-- "this login is this member", and roles, admin rights and my_member_id() all follow it.
--
--   my_confirmed_email()           the signed-in user's confirmed email, lower case (NULL if none)
--   is_guardian_of(member, club)   that email is the member's guardian email
--   my_children(club)              the children a guardian looks after at a club (any status)
--   RLS: guardians read their children's member rows, messages and payments, and send messages
--        about them (sender_type 'member', as the member page does)
--
-- A child applying with the guardian's own email (common before this) must not turn the parent's
-- login into the child's: claim_member_profile, claim_my_memberships and my_membership_application
-- skip rows whose email is their guardian's.
--
-- Needs 20261102_junior_safeguarding.sql. Safe to run more than once.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Helpers
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION my_confirmed_email()
RETURNS TEXT AS $$
    SELECT lower(u.email)
      FROM auth.users u
     WHERE u.id = auth.uid()
       AND u.email_confirmed_at IS NOT NULL
       AND COALESCE(u.email, '') <> '';
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_guardian_of(p_member_id UUID, p_club_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM club_members m
         WHERE m.id = p_member_id
           AND m.club_id = p_club_id
           AND COALESCE(m.guardian_email, '') <> ''
           AND lower(m.guardian_email) = my_confirmed_email()
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION my_confirmed_email() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION is_guardian_of(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION my_confirmed_email() TO authenticated;
GRANT EXECUTE ON FUNCTION is_guardian_of(UUID, UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 2. What a guardian can read and send
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Guardians read children" ON club_members;
CREATE POLICY "Guardians read children" ON club_members FOR SELECT TO authenticated
    USING (COALESCE(guardian_email, '') <> '' AND lower(guardian_email) = (SELECT my_confirmed_email()));

DROP POLICY IF EXISTS "Guardians read children's messages" ON member_messages;
CREATE POLICY "Guardians read children's messages" ON member_messages FOR SELECT TO authenticated
    USING (is_guardian_of(member_id, club_id));

DROP POLICY IF EXISTS "Guardians send children's messages" ON member_messages;
CREATE POLICY "Guardians send children's messages" ON member_messages FOR INSERT TO authenticated
    WITH CHECK (sender_type = 'member' AND is_guardian_of(member_id, club_id));

DROP POLICY IF EXISTS "Guardians read children's payments" ON payments;
CREATE POLICY "Guardians read children's payments" ON payments FOR SELECT TO authenticated
    USING (member_id IS NOT NULL AND is_guardian_of(member_id, club_id));

-- ------------------------------------------------------------------------------
-- 3. The children a guardian looks after at one club: applications, members and lapsed alike.
--    A row the guardian's login already claimed as their own (child applied with the parent's
--    email before this migration) stays on their own pass instead.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION my_children(p_club_id UUID)
RETURNS SETOF club_members AS $$
    SELECT m.*
      FROM club_members m
     WHERE m.club_id = p_club_id
       AND COALESCE(m.guardian_email, '') <> ''
       AND lower(m.guardian_email) = my_confirmed_email()
       AND m.user_id IS DISTINCT FROM auth.uid()
     ORDER BY m.created_at;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION my_children(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION my_children(UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 4. Never link a parent's login to a child's row that shares the parent's email
--    (same as 20260923 / 20261004 / 20261030, plus the guardian condition)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION claim_member_profile(p_club_id UUID)
RETURNS SETOF club_members AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN;
    END IF;

    UPDATE club_members m
       SET user_id = auth.uid(),
           updated_at = NOW()
     WHERE m.club_id = p_club_id
       AND m.user_id IS NULL
       AND COALESCE(m.membership_status, 'approved') = 'approved'
       AND lower(m.email) = lower((SELECT u.email FROM auth.users u WHERE u.id = auth.uid()))
       AND (COALESCE(m.guardian_email, '') = '' OR lower(m.guardian_email) <> lower(m.email))
       -- the email address must have been confirmed (e.g. by clicking the emailed link)
       AND EXISTS (
           SELECT 1 FROM auth.users u
            WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL
       );

    RETURN QUERY
        SELECT * FROM club_members
         WHERE club_id = p_club_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION claim_my_memberships()
RETURNS TABLE (club_id UUID, role TEXT) AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN;
    END IF;

    UPDATE club_members m
       SET user_id = auth.uid(),
           updated_at = NOW()
     WHERE m.user_id IS NULL
       AND COALESCE(m.membership_status, 'approved') = 'approved'
       AND lower(m.email) = lower((SELECT u.email FROM auth.users u WHERE u.id = auth.uid()))
       AND (COALESCE(m.guardian_email, '') = '' OR lower(m.guardian_email) <> lower(m.email))
       -- the email address must have been confirmed (e.g. by clicking the emailed link)
       AND EXISTS (
           SELECT 1 FROM auth.users u
            WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL
       );

    RETURN QUERY
        SELECT m.club_id, m.role::TEXT FROM club_members m WHERE m.user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION my_membership_application(p_club_id UUID)
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
           -- a child's application under the parent's email shows in the parent's family list instead
           AND (COALESCE(m.guardian_email, '') = '' OR lower(m.guardian_email) <> lower(m.email))
         LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

NOTIFY pgrst, 'reload schema';
