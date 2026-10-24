-- ==============================================================================
-- Migration: parents and guardians manage their children's club life (GRD section)
-- Date: 2026-11-23
--
--   1. club_members.medical_notes: allergies, asthma and the like, written by the parent (or the
--      club). Not in club_members_public, so it is never shown publicly; staff who can read
--      members see it.
--   2. membership_plans.audience: who can choose a plan on the Join page (all / junior = under 18 /
--      adult). Filled in once from the plan's team (a junior team's plan is junior) and its name.
--   3. Availability for a child: set_member_availability() holds the rules set_my_availability had;
--      set_my_availability and the new set_child_availability call it. family_availability and
--      family_squad_matches give a guardian their children's answers and fixtures.
--   4. update_child_details(): photo consent, emergency contact and medical notes, by the guardian.
--   5. mark_messages_read(): the member (or their guardian) has read the club's messages to them.
--   6. Guardians can read their children's team rows (junior squads are hidden from the public view).
--
-- Safe to run more than once.
-- ==============================================================================

-- 1. Medical notes
ALTER TABLE club_members ADD COLUMN IF NOT EXISTS medical_notes TEXT;

-- 2. Who a plan is for
ALTER TABLE membership_plans ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'all';
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'membership_plans_audience_check') THEN
        ALTER TABLE membership_plans ADD CONSTRAINT membership_plans_audience_check CHECK (audience IN ('all', 'junior', 'adult'));
        UPDATE membership_plans p SET audience = 'junior'
         WHERE EXISTS (SELECT 1 FROM club_teams t WHERE t.id = p.team_id AND t.is_junior)
            OR p.name ~* '(junior|youth|\mu[0-9]{1,2}\M|kids|mini)';
        UPDATE membership_plans SET audience = 'adult'
         WHERE audience = 'all' AND name ~* '(senior|adult|over 18|masters|veteran)';
    END IF;
END $$;

-- 3. Availability
CREATE OR REPLACE FUNCTION set_member_availability(
    p_club_id UUID, p_member_id UUID, p_match_id UUID, p_event_id UUID, p_status TEXT, p_note TEXT
)
RETURNS VOID AS $$
DECLARE
    v_id UUID;
BEGIN
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
    IF p_match_id IS NOT NULL AND p_member_id NOT IN (SELECT match_squad_member_ids(p_match_id)) THEN
        RAISE EXCEPTION 'That fixture is for another team''s squad' USING ERRCODE = '42501';
    END IF;

    SELECT id INTO v_id FROM player_availabilities
     WHERE member_id = p_member_id
       AND (match_id = p_match_id OR event_id = p_event_id)
     LIMIT 1;
    IF v_id IS NULL THEN
        INSERT INTO player_availabilities (club_id, member_id, match_id, event_id, status, note, responded_at)
        VALUES (p_club_id, p_member_id, p_match_id, p_event_id, p_status, LEFT(p_note, 500), NOW());
    ELSE
        -- No note sent (the app's In/Maybe/Out buttons): keep the one already given
        UPDATE player_availabilities
           SET status = p_status, note = COALESCE(LEFT(p_note, 500), note), responded_at = NOW(), updated_at = NOW()
         WHERE id = v_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION set_my_availability(
    p_club_id UUID, p_match_id UUID, p_event_id UUID, p_status TEXT, p_note TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_member UUID := my_member_id(p_club_id);
BEGIN
    IF v_member IS NULL THEN
        RAISE EXCEPTION 'Sign in as an approved member of this club first' USING ERRCODE = '42501';
    END IF;
    PERFORM set_member_availability(p_club_id, v_member, p_match_id, p_event_id, p_status, p_note);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- An approved child of the signed-in guardian (their confirmed email is the child's guardian_email)
CREATE OR REPLACE FUNCTION my_approved_child(p_club_id UUID, p_member_id UUID)
RETURNS BOOLEAN AS $$
    SELECT is_guardian_of(p_member_id, p_club_id)
       AND EXISTS (SELECT 1 FROM club_members WHERE id = p_member_id AND COALESCE(membership_status, 'approved') = 'approved');
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION set_child_availability(
    p_club_id UUID, p_member_id UUID, p_match_id UUID, p_event_id UUID, p_status TEXT, p_note TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    IF NOT my_approved_child(p_club_id, p_member_id) THEN
        RAISE EXCEPTION 'You can only answer for your own children at this club' USING ERRCODE = '42501';
    END IF;
    PERFORM set_member_availability(p_club_id, p_member_id, p_match_id, p_event_id, p_status, p_note);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION family_availability(p_club_id UUID)
RETURNS TABLE (member_id UUID, match_id UUID, event_id UUID, status TEXT) AS $$
    SELECT a.member_id, a.match_id, a.event_id, a.status::TEXT
      FROM player_availabilities a
      JOIN my_children(p_club_id) c ON c.id = a.member_id
     WHERE a.club_id = p_club_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION family_squad_matches(p_club_id UUID)
RETURNS TABLE (member_id UUID, match_id UUID) AS $$
    SELECT c.id, m.id
      FROM my_children(p_club_id) c
      JOIN matches m ON m.club_id = p_club_id
     WHERE COALESCE(c.membership_status, 'approved') = 'approved'
       AND m.status = 'upcoming'
       AND m.match_date >= NOW() - INTERVAL '1 day'
       AND c.id IN (SELECT match_squad_member_ids(m.id));
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- 4. Details a guardian keeps up to date (NULL leaves a field as it is; '' clears a text field)
CREATE OR REPLACE FUNCTION update_child_details(
    p_club_id UUID, p_member_id UUID, p_photo_consent BOOLEAN, p_emergency_contact TEXT, p_medical_notes TEXT
)
RETURNS VOID AS $$
BEGIN
    IF NOT is_guardian_of(p_member_id, p_club_id) THEN
        RAISE EXCEPTION 'You can only update your own children at this club' USING ERRCODE = '42501';
    END IF;
    UPDATE club_members
       SET photo_consent = COALESCE(p_photo_consent, photo_consent),
           emergency_contact = CASE WHEN p_emergency_contact IS NULL THEN emergency_contact ELSE NULLIF(LEFT(trim(p_emergency_contact), 200), '') END,
           medical_notes = CASE WHEN p_medical_notes IS NULL THEN medical_notes ELSE NULLIF(LEFT(trim(p_medical_notes), 2000), '') END,
           updated_at = NOW()
     WHERE id = p_member_id AND club_id = p_club_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. The club's messages to a member, read by the member or their guardian
CREATE OR REPLACE FUNCTION mark_messages_read(p_club_id UUID, p_member_id UUID)
RETURNS VOID AS $$
BEGIN
    IF p_member_id IS DISTINCT FROM my_member_id(p_club_id) AND NOT is_guardian_of(p_member_id, p_club_id) THEN
        RAISE EXCEPTION 'Not your messages' USING ERRCODE = '42501';
    END IF;
    UPDATE member_messages SET is_read = TRUE
     WHERE club_id = p_club_id AND member_id = p_member_id AND sender_type = 'admin' AND NOT is_read;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. A parent sees which teams their child is in (junior squads aren't in club_team_members_public)
DROP POLICY IF EXISTS "Guardians read children's teams" ON club_team_members;
CREATE POLICY "Guardians read children's teams" ON club_team_members FOR SELECT TO authenticated
    USING (is_guardian_of(member_id, club_id));

REVOKE ALL ON FUNCTION set_member_availability(UUID, UUID, UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION my_approved_child(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION set_my_availability(UUID, UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION set_child_availability(UUID, UUID, UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION family_availability(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION family_squad_matches(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION update_child_details(UUID, UUID, BOOLEAN, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION mark_messages_read(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION set_my_availability(UUID, UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION set_child_availability(UUID, UUID, UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION family_availability(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION family_squad_matches(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_child_details(UUID, UUID, BOOLEAN, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_messages_read(UUID, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
