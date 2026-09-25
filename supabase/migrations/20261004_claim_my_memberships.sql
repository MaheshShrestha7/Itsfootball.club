-- ==============================================================================
-- Migration: link a signed-in user to all of their club memberships at once
-- Date: 2026-10-04
--
-- claim_member_profile(club) only ran when a member opened that club's member page, so a
-- member signing in from the platform never saw "clubs you're in". This does the same claim
-- (approved rows, matched on the account's confirmed email) for every club in one call.
--
-- Safe to run more than once.
-- ==============================================================================

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
       -- the email address must have been confirmed (e.g. by clicking the emailed link)
       AND EXISTS (
           SELECT 1 FROM auth.users u
            WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL
       );

    RETURN QUERY
        SELECT m.club_id, m.role::TEXT FROM club_members m WHERE m.user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION claim_my_memberships() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION claim_my_memberships() TO authenticated;

NOTIFY pgrst, 'reload schema';
