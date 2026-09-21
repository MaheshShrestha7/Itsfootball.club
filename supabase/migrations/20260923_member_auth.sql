-- ==============================================================================
-- Migration: real member sign-in (Supabase Auth) instead of browser-side passwords / magic links
-- Date: 2026-09-23
--
-- Members now sign in with an emailed link (Supabase Auth). The first time an approved member
-- signs in, claim_member_profile() links their auth account to their club_members row by
-- verified email address. From then on the existing "read own row" policy lets them see it.
--
-- Safe to run more than once.
-- ==============================================================================

-- 1. One application / membership per email per club (also stops duplicate applications)
CREATE UNIQUE INDEX IF NOT EXISTS uq_club_members_club_email
    ON club_members (club_id, lower(email))
    WHERE email IS NOT NULL AND email <> '';

-- 2. Link the signed-in user to their approved member row (matched on a verified email)
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

REVOKE ALL ON FUNCTION claim_member_profile(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION claim_member_profile(UUID) TO authenticated;

-- 3. Members can read and send their own messages (no more anonymous inserts)
DROP POLICY IF EXISTS "Public member message submit" ON member_messages;
DROP POLICY IF EXISTS "Members read own messages" ON member_messages;
DROP POLICY IF EXISTS "Members send own messages" ON member_messages;

CREATE POLICY "Members read own messages" ON member_messages FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM club_members m
         WHERE m.id = member_messages.member_id AND m.user_id = auth.uid()
    ));

CREATE POLICY "Members send own messages" ON member_messages FOR INSERT
    WITH CHECK (
        sender_type = 'member'
        AND EXISTS (
            SELECT 1 FROM club_members m
             WHERE m.id = member_messages.member_id
               AND m.club_id = member_messages.club_id
               AND m.user_id = auth.uid()
        )
    );

NOTIFY pgrst, 'reload schema';
