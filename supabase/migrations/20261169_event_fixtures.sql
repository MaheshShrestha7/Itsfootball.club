-- ==============================================================================
-- Migration: fixtures linked to a club event (an outside cup such as "MFC Cup")
-- Date: 2026-11-12
--
--   * matches.event_id: the event a fixture belongs to. One event can have many fixtures. Deleting
--     the event keeps its fixtures and only clears the link.
--   * respond_availability(token): answering one game of a cup from a personal link also answers the
--     player's other upcoming games in that event, as tournaments already do. An admin can still
--     set answers game by game on the Availability page.
--
-- Safe to run more than once.
-- ==============================================================================

ALTER TABLE matches ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_matches_event ON matches (event_id) WHERE event_id IS NOT NULL;

CREATE OR REPLACE FUNCTION respond_availability(p_token TEXT, p_status TEXT, p_note TEXT DEFAULT NULL)
RETURNS SETOF player_availabilities AS $$
    WITH target AS (
        SELECT a.member_id, m.tournament_id, m.event_id
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
         OR (t.event_id IS NOT NULL
             AND pa.member_id = t.member_id
             AND pa.match_id IN (SELECT id FROM matches WHERE event_id = t.event_id AND status = 'upcoming'))
       )
    RETURNING pa.*;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION respond_availability(TEXT, TEXT, TEXT) TO anon, authenticated;
