-- ==============================================================================
-- Migration: a player's recent games on their public page (UX30-6, 30 Oct 2026)
--
-- /club/squad/{id} counted games from player_stats ("4 games") but listed recent games only from
-- published line-ups, so most players read "4 games" and then "No games yet". The per-match stats
-- saved at full time (match_player_stats, staff-only to read) are the real record. This returns a
-- player's last finished games from them, for adult players only: nothing for a junior
-- (member_is_junior), the same rule the public pages already use.
--
-- Safe to run more than once.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public_player_games(p_member_id UUID, p_limit INT DEFAULT 5)
RETURNS TABLE (match_id UUID, goals INT, assists INT, motm BOOLEAN)
AS $$
    SELECT s.match_id, COALESCE(s.goals, 0), COALESCE(s.assists, 0), COALESCE(s.motm, FALSE)
      FROM match_player_stats s
      JOIN matches m ON m.id = s.match_id
     WHERE s.member_id = p_member_id
       AND COALESCE(s.played, TRUE)
       AND m.status = 'completed'
       AND NOT member_is_junior(p_member_id)
     ORDER BY m.match_date DESC
     LIMIT LEAST(GREATEST(COALESCE(p_limit, 5), 1), 20);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public_player_games(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public_player_games(UUID, INT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
