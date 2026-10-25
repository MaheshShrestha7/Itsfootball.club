-- ==============================================================================
-- Migration: players answer once for their tournament team's day
-- Date: 2026-11-26
--
--   * match_squad_member_ids(match): a tournament game asks only the players of the club's own
--     team(s) in it (the internal participant's roster), not the whole club. Same rule as
--     clubSidePlayers in lib/tournament-engine.ts: a team with no roster yet still asks the whole
--     squad, and so does a side that is the club itself. Everything else is unchanged.
--   * respond_availability(token): answering one tournament game from a personal link also answers
--     the player's other upcoming games in that tournament, as the club app and the Availability
--     hub already do. Other fixtures still answer one game per link.
--
-- Safe to run more than once.
-- ==============================================================================

CREATE OR REPLACE FUNCTION match_squad_member_ids(p_match_id UUID)
RETURNS SETOF UUID AS $$
DECLARE
    m RECORD;
    v_team UUID;
    v_roster TEXT[];
    v_open BOOLEAN := FALSE;
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

    -- A tournament game: the rosters of the club's own teams playing in it. A side that is one of
    -- the club's teams with no roster (or the club itself) leaves the game open to the whole squad.
    IF m.tournament_id IS NOT NULL THEN
        SELECT COALESCE(array_agg(DISTINCT r.id), '{}'),
               bool_or(it.id IS NULL OR jsonb_array_length(COALESCE(it.player_ids, '[]'::jsonb)) = 0)
          INTO v_roster, v_open
          FROM tournament_participants p
          LEFT JOIN internal_teams it ON it.id = p.internal_team_id
          LEFT JOIN LATERAL jsonb_array_elements_text(COALESCE(it.player_ids, '[]'::jsonb)) AS r(id) ON TRUE
         WHERE p.tournament_id = m.tournament_id
           AND p.team_type = 'internal'
           AND lower(trim(p.name)) IN (lower(trim(m.home_team_name)), lower(trim(m.away_team_name)));
        v_open := COALESCE(v_open, TRUE)
            OR lower(trim(m.home_team_name)) = (SELECT lower(trim(name)) FROM clubs WHERE id = m.club_id)
            OR lower(trim(m.away_team_name)) = (SELECT lower(trim(name)) FROM clubs WHERE id = m.club_id);
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
       AND (m.tournament_id IS NULL OR v_open OR cm.id::text = ANY(v_roster))
       AND (
            v_team IS NULL
         OR NOT EXISTS (SELECT 1 FROM club_team_members tm WHERE tm.team_id = v_team AND tm.is_active AND tm.team_role = 'player')
         OR EXISTS (SELECT 1 FROM club_team_members tm WHERE tm.team_id = v_team AND tm.is_active AND tm.team_role = 'player' AND tm.member_id = cm.id)
       );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION respond_availability(p_token TEXT, p_status TEXT, p_note TEXT DEFAULT NULL)
RETURNS SETOF player_availabilities AS $$
    WITH target AS (
        SELECT a.member_id, m.tournament_id
          FROM player_availabilities a
          LEFT JOIN matches m ON m.id = a.match_id
         WHERE a.response_token = p_token
         LIMIT 1
    )
    UPDATE player_availabilities pa
       SET status = p_status,
           note = LEFT(p_note, 500),
           responded_at = NOW(),
           updated_at = NOW()
      FROM target t
     WHERE p_status IN ('available', 'unavailable', 'maybe')
       AND (
            pa.response_token = p_token
         OR (t.tournament_id IS NOT NULL
             AND pa.member_id = t.member_id
             AND pa.match_id IN (SELECT id FROM matches WHERE tournament_id = t.tournament_id AND status = 'upcoming'))
       )
    RETURNING pa.*;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION match_squad_member_ids(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION respond_availability(TEXT, TEXT, TEXT) TO anon, authenticated;
