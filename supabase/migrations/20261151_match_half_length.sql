-- ==============================================================================
-- Migration: matches of any length
--
--   Every game is two halves; these say how long a half is, in minutes.
--     club_teams.half_minutes  the team's usual half length (e.g. U9s 20, Seniors 45), copied
--                              onto the team's new fixtures
--     matches.half_minutes     this game's half length (e.g. a 2 x 12 social game)
--
--   Both are optional. Empty means the format's usual length (11v11 45, 9v9 30, 7v7 25, 5v5 20),
--   which is what the Match Centre clock and minutes played already assumed for 11v11, 9v9 and
--   7v7, so existing matches and teams keep working exactly as before. Nothing is back-filled.
--
-- Run after 20261150. Safe to run again.
-- ==============================================================================

ALTER TABLE matches ADD COLUMN IF NOT EXISTS half_minutes SMALLINT;
ALTER TABLE club_teams ADD COLUMN IF NOT EXISTS half_minutes SMALLINT;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'matches_half_minutes_range') THEN
        ALTER TABLE matches ADD CONSTRAINT matches_half_minutes_range
            CHECK (half_minutes IS NULL OR half_minutes BETWEEN 1 AND 60);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'club_teams_half_minutes_range') THEN
        ALTER TABLE club_teams ADD CONSTRAINT club_teams_half_minutes_range
            CHECK (half_minutes IS NULL OR half_minutes BETWEEN 1 AND 60);
    END IF;
END $$;

COMMENT ON COLUMN matches.half_minutes IS 'Minutes in each half; NULL = the usual length for match_format';
COMMENT ON COLUMN club_teams.half_minutes IS 'The team''s usual half length in minutes, copied onto new fixtures; NULL = the usual length for match_format';

NOTIFY pgrst, 'reload schema';
