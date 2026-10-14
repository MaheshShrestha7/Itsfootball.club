-- ==============================================================================
-- Migration: availability follows each fixture's squad, and reminders no longer wait for a coach
-- Date: 2026-11-07
--
--   * match_squad_member_ids(match): the players asked about a fixture. Same rule as squadForMatch
--     in lib/teams.ts: once a club has two or more active teams, a fixture's team (its own, else the
--     main team for league/cup/friendly games) asks only its players; tournament and internal games,
--     and teams with no players yet, ask the whole squad. Another club's game in a cup the club hosts
--     (both sides outside teams) asks nobody.
--   * set_my_availability refuses another team's fixture (a U12 player answering for the First XI),
--     and keeps the saved note when the app sends none ("Maybe, back Thursday" survives tapping In).
--   * my_squad_matches(club): the caller's fixtures, so the app only shows In/Maybe/Out on those.
--   * ensure_match_availability(matches): the daily reminder job creates the pending rows (and so
--     the personal links) itself. Before, they only existed once an admin opened the fixture on the
--     Availability page, and nobody was reminded otherwise.
--
-- Safe to run more than once.
-- ==============================================================================

-- Whether a team name in a tournament is an outside team (not the club itself), as clubPlaysIn in lib/fixtures.ts
CREATE OR REPLACE FUNCTION outside_team(p_tournament_id UUID, p_club_id UUID, p_name TEXT)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM tournament_participants p
         WHERE p.tournament_id = p_tournament_id
           AND p.team_type = 'external'
           AND lower(trim(p.name)) = lower(trim(p_name))
    ) AND lower(trim(p_name)) <> (SELECT lower(trim(name)) FROM clubs WHERE id = p_club_id);
$$ LANGUAGE sql STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION match_squad_member_ids(p_match_id UUID)
RETURNS SETOF UUID AS $$
DECLARE
    m RECORD;
    v_team UUID;
BEGIN
    SELECT id, club_id, team_id, match_type, tournament_id, home_team_name, away_team_name
      INTO m FROM matches WHERE id = p_match_id;
    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- Another club's game in a tournament this club hosts: both sides are outside teams
    IF m.tournament_id IS NOT NULL
       AND outside_team(m.tournament_id, m.club_id, m.home_team_name)
       AND outside_team(m.tournament_id, m.club_id, m.away_team_name) THEN
        RETURN;
    END IF;

    IF (SELECT COUNT(*) FROM club_teams WHERE club_id = m.club_id AND is_active) > 1 THEN
        v_team := COALESCE(m.team_id, CASE
            WHEN m.tournament_id IS NULL AND COALESCE(m.match_type, 'friendly') <> 'internal'
            THEN (SELECT id FROM club_teams WHERE club_id = m.club_id AND is_default LIMIT 1)
        END);
    END IF;

    RETURN QUERY
    SELECT cm.id
      FROM club_members cm
     WHERE cm.club_id = m.club_id
       AND COALESCE(cm.membership_status, 'approved') = 'approved'
       AND COALESCE(cm.status, 'active') <> 'alumni'
       AND (
            (jsonb_typeof(cm.roles) = 'array' AND jsonb_array_length(cm.roles) > 0
             AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(cm.roles) r WHERE lower(r) = 'player'))
         OR ((cm.roles IS NULL OR jsonb_typeof(cm.roles) <> 'array' OR jsonb_array_length(cm.roles) = 0)
             AND EXISTS (SELECT 1 FROM unnest(string_to_array(COALESCE(cm.role, ''), ',')) r WHERE lower(trim(r)) = 'player'))
       )
       AND (
            v_team IS NULL
         OR NOT EXISTS (SELECT 1 FROM club_team_members tm WHERE tm.team_id = v_team AND tm.is_active AND tm.team_role = 'player')
         OR EXISTS (SELECT 1 FROM club_team_members tm WHERE tm.team_id = v_team AND tm.is_active AND tm.team_role = 'player' AND tm.member_id = cm.id)
       );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

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
    IF p_match_id IS NOT NULL AND v_member NOT IN (SELECT match_squad_member_ids(p_match_id)) THEN
        RAISE EXCEPTION 'That fixture is for another team''s squad' USING ERRCODE = '42501';
    END IF;

    SELECT id INTO v_id FROM player_availabilities
     WHERE member_id = v_member
       AND (match_id = p_match_id OR event_id = p_event_id)
     LIMIT 1;
    IF v_id IS NULL THEN
        INSERT INTO player_availabilities (club_id, member_id, match_id, event_id, status, note, responded_at)
        VALUES (p_club_id, v_member, p_match_id, p_event_id, p_status, LEFT(p_note, 500), NOW());
    ELSE
        -- No note sent (the app's In/Maybe/Out buttons): keep the one already given
        UPDATE player_availabilities
           SET status = p_status, note = COALESCE(LEFT(p_note, 500), note), responded_at = NOW(), updated_at = NOW()
         WHERE id = v_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- The caller's upcoming fixtures (the ones the app asks them about)
CREATE OR REPLACE FUNCTION my_squad_matches(p_club_id UUID)
RETURNS SETOF UUID AS $$
    SELECT m.id
      FROM matches m
     WHERE m.club_id = p_club_id
       AND m.status = 'upcoming'
       AND m.match_date >= NOW() - INTERVAL '1 day'
       AND my_member_id(p_club_id) IN (SELECT match_squad_member_ids(m.id));
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Pending rows (with their personal links) for every squad player of these fixtures; returns how many were added
CREATE OR REPLACE FUNCTION ensure_match_availability(p_match_ids UUID[])
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    INSERT INTO player_availabilities (club_id, match_id, member_id, status)
    SELECT m.club_id, m.id, s.member_id, 'pending'
      FROM matches m
     CROSS JOIN LATERAL match_squad_member_ids(m.id) AS s(member_id)
     WHERE m.id = ANY(p_match_ids)
       AND NOT EXISTS (SELECT 1 FROM player_availabilities a WHERE a.match_id = m.id AND a.member_id = s.member_id)
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION outside_team(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION match_squad_member_ids(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION set_my_availability(UUID, UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION my_squad_matches(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION ensure_match_availability(UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION set_my_availability(UUID, UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION my_squad_matches(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION ensure_match_availability(UUID[]) TO service_role;

NOTIFY pgrst, 'reload schema';
