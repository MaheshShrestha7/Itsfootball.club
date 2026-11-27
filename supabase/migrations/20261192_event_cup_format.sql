-- ==============================================================================
-- Migration: how an outside cup is played (a club event the club enters, not one it hosts)
--
--   * events.cup_format: 'group_ko' (groups, then knockouts), 'league' or 'knockout'; NULL = not set.
--     After the last group game of a 'group_ko' cup, admin asks "Did we go through?" and helps add the
--     knockout game. Knockout games are tagged with matches.tournament_stage (the column hosted
--     tournaments already use; those games also have tournament_id, event games don't).
-- The app hides the format setting until this has run.
--
-- Safe to run more than once.
-- ==============================================================================

ALTER TABLE events ADD COLUMN IF NOT EXISTS cup_format TEXT;
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_cup_format_check;
ALTER TABLE events ADD CONSTRAINT events_cup_format_check
    CHECK (cup_format IS NULL OR cup_format IN ('group_ko', 'league', 'knockout'));

NOTIFY pgrst, 'reload schema';
