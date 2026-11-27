-- ==============================================================================
-- Migration: Tournament game length and knockout timing
-- Date: 2026-11-27
--
-- A one-day cup plays short games (2 x 10 in the groups, 2 x 15 for the semis and final). Until now
-- every tournament fixture was made as a 2 x 45 game, so the Match Centre clock called half time at
-- 45', second-half goals were saved as 46'+ and the timetable gave the knockouts the same slot as a
-- group game, straight after the last one.
--
--   half_minutes      half length of group (or league) games
--   ko_half_minutes   half length of knockout games (empty = same as half_minutes)
--   ko_match_minutes  timetable slot for a knockout game, game plus changeover (empty = match_minutes)
--   ko_break_minutes  minutes between the last group game and the first knockout game
--
-- The app copies the half length onto each fixture's matches.half_minutes when the draw is made.
-- Until this runs those settings stay hidden and every cup game is 2 x 45 as before.
--
-- Safe to run more than once.
-- ==============================================================================

ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS half_minutes INTEGER;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS ko_half_minutes INTEGER;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS ko_match_minutes INTEGER;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS ko_break_minutes INTEGER;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournaments_game_length_check') THEN
        ALTER TABLE tournaments ADD CONSTRAINT tournaments_game_length_check CHECK (
            (half_minutes IS NULL OR half_minutes BETWEEN 1 AND 60)
            AND (ko_half_minutes IS NULL OR ko_half_minutes BETWEEN 1 AND 60)
            AND (ko_match_minutes IS NULL OR ko_match_minutes BETWEEN 5 AND 180)
            AND (ko_break_minutes IS NULL OR ko_break_minutes BETWEEN 0 AND 240)
        );
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
