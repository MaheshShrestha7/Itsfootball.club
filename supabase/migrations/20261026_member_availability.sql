-- ==============================================================================
-- Migration: signed-in members answer availability in the app
-- Date: 2026-10-26
--
-- Players could only answer through the personal link in their reminder email. The club app's
-- home (/[club]/app) now lets a signed-in member see and set their own answer for upcoming
-- matches and events. Members never read other people's answers; coaches still see everyone's
-- through the staff policies.
--
-- Safe to run more than once.
-- ==============================================================================

-- The caller's approved member record at a club
CREATE OR REPLACE FUNCTION my_member_id(p_club_id UUID)
RETURNS UUID AS $$
    SELECT id FROM club_members
     WHERE club_id = p_club_id
       AND user_id = auth.uid()
       AND COALESCE(membership_status, 'approved') = 'approved'
     ORDER BY created_at
     LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION my_availability(p_club_id UUID)
RETURNS TABLE (match_id UUID, event_id UUID, status TEXT, note TEXT) AS $$
    SELECT a.match_id, a.event_id, a.status::TEXT, a.note
      FROM player_availabilities a
     WHERE a.club_id = p_club_id
       AND a.member_id = my_member_id(p_club_id);
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION set_my_availability(
    p_club_id UUID, p_match_id UUID, p_event_id UUID, p_status TEXT, p_note TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_member UUID := my_member_id(p_club_id);
    v_id UUID;
BEGIN
    IF v_member IS NULL THEN
        RAISE EXCEPTION 'Sign in as an approved member of this club first' USING ERRCODE = '42501';
    END IF;
    IF p_status NOT IN ('available', 'unavailable', 'maybe') THEN
        RAISE EXCEPTION 'Answer available, maybe or unavailable' USING ERRCODE = '22023';
    END IF;
    IF (p_match_id IS NULL) = (p_event_id IS NULL) THEN
        RAISE EXCEPTION 'Answer for one match or one event' USING ERRCODE = '22023';
    END IF;
    IF (p_match_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM matches WHERE id = p_match_id AND club_id = p_club_id))
       OR (p_event_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM events WHERE id = p_event_id AND club_id = p_club_id)) THEN
        RAISE EXCEPTION 'That fixture is not this club''s' USING ERRCODE = '22023';
    END IF;

    SELECT id INTO v_id FROM player_availabilities
     WHERE member_id = v_member
       AND (match_id = p_match_id OR event_id = p_event_id)
     LIMIT 1;
    IF v_id IS NULL THEN
        INSERT INTO player_availabilities (club_id, member_id, match_id, event_id, status, note, responded_at)
        VALUES (p_club_id, v_member, p_match_id, p_event_id, p_status, LEFT(p_note, 500), NOW());
    ELSE
        UPDATE player_availabilities
           SET status = p_status, note = LEFT(p_note, 500), responded_at = NOW(), updated_at = NOW()
         WHERE id = v_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION my_member_id(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION my_availability(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION set_my_availability(UUID, UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION my_member_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION my_availability(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION set_my_availability(UUID, UUID, UUID, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
