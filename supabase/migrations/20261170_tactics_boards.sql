-- ==============================================================================
-- Migration: Tactics boards on the lineup workbench
--
-- A coach draws runs, passes and set pieces over the line-up, one board per situation (open play,
-- our corner, ...). The boards live in their own table, not on draft_lineups: a published draft is
-- readable by anyone, and a club's set-piece plans are not for the other team.
--   * Staff with the Lineups or Match Centre area read and edit them.
--   * Players never read the table. member_match_tactics() hands a signed-in member of the club
--     only the boards the coach switched on ("Show to players"), and only once the line-up is published.
-- The app hides the Tactics board switch until this has run.
--
-- Safe to run more than once.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS match_tactics (
    match_id UUID PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    boards JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Ten boards of drawings is a few kilobytes; this stops the column being used as a file store
    CONSTRAINT match_tactics_boards_size CHECK (jsonb_typeof(boards) = 'array' AND pg_column_size(boards) < 300000)
);

CREATE INDEX IF NOT EXISTS idx_match_tactics_club ON match_tactics(club_id);

ALTER TABLE match_tactics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read" ON match_tactics;
CREATE POLICY "Staff read" ON match_tactics FOR SELECT
    USING (has_club_perm(club_id, '{lineup,match-center}', 'view'));

-- The row must belong to the club that owns the fixture, so one club can't write over another's game
DROP POLICY IF EXISTS "Staff insert" ON match_tactics;
CREATE POLICY "Staff insert" ON match_tactics FOR INSERT
    WITH CHECK (has_club_perm(club_id, '{lineup}', 'edit')
                AND EXISTS (SELECT 1 FROM matches m WHERE m.id = match_id AND m.club_id = match_tactics.club_id));

DROP POLICY IF EXISTS "Staff update" ON match_tactics;
CREATE POLICY "Staff update" ON match_tactics FOR UPDATE
    USING (has_club_perm(club_id, '{lineup}', 'edit'))
    WITH CHECK (has_club_perm(club_id, '{lineup}', 'edit')
                AND EXISTS (SELECT 1 FROM matches m WHERE m.id = match_id AND m.club_id = match_tactics.club_id));

DROP POLICY IF EXISTS "Staff delete" ON match_tactics;
CREATE POLICY "Staff delete" ON match_tactics FOR DELETE
    USING (has_club_perm(club_id, '{lineup}', 'full'));

GRANT SELECT, INSERT, UPDATE, DELETE ON match_tactics TO authenticated;

-- The boards a player may see for one game: only those marked show, only for a current member of
-- the club (or its staff), and only once the game has a published line-up.
CREATE OR REPLACE FUNCTION member_match_tactics(p_match_id UUID)
RETURNS JSONB
AS $$
    SELECT COALESCE(jsonb_agg(b ORDER BY ord), '[]'::jsonb)
      FROM match_tactics t
      CROSS JOIN LATERAL jsonb_array_elements(t.boards) WITH ORDINALITY AS e(b, ord)
     WHERE t.match_id = p_match_id
       AND (b ->> 'show') = 'true'
       AND (is_active_club_member(t.club_id) OR has_club_perm(t.club_id, '{lineup,match-center}', 'view'))
       AND EXISTS (SELECT 1 FROM matches m
                    WHERE m.id = t.match_id
                      AND (COALESCE(m.home_lineup_coords, '[]'::jsonb) NOT IN ('[]'::jsonb, 'null'::jsonb)
                           OR COALESCE(m.away_lineup_coords, '[]'::jsonb) NOT IN ('[]'::jsonb, 'null'::jsonb)));
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION member_match_tactics(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION member_match_tactics(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
