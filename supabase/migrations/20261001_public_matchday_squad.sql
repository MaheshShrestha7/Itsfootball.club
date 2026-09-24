-- ==============================================================================
-- Public matchday squad: the public match center lists only players marked
-- "available" for a fixture, but player_availabilities is admin-only (see
-- 20260924_live_analytics_storage.sql). This public-safe view exposes just who is
-- available for which match - never the player's note, their private response
-- token, or who answered unavailable/maybe. Same pattern as sponsors_public.
-- Safe to run more than once.
-- ==============================================================================

CREATE OR REPLACE VIEW player_availabilities_public AS
    SELECT id, club_id, match_id, event_id, member_id, status
    FROM player_availabilities
    WHERE status = 'available' AND match_id IS NOT NULL;

GRANT SELECT ON player_availabilities_public TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
