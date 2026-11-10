-- ==============================================================================
-- Migration: Player of the Match on the public match page, whether or not ClubScore is on
--
-- The match page read Player of the Match from the ClubScore points log (match_motm), and that log
-- gets no row while ClubScore is switched off, so the award vanished from the page, the match
-- report and the share card. The stats saved at full time (match_player_stats, staff-only to read)
-- always hold it. This returns just the player's id for one finished match; the page shows the name
-- the way it already does (shortened for a junior).
--
-- Safe to run more than once.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public_match_motm(p_match_id UUID)
RETURNS UUID
AS $$
    SELECT s.member_id
      FROM match_player_stats s
      JOIN matches m ON m.id = s.match_id
     WHERE s.match_id = p_match_id
       AND s.motm
       AND m.status = 'completed'
     LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public_match_motm(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public_match_motm(UUID) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
