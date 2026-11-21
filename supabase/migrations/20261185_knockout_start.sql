-- ==============================================================================
-- Migration: Start the knockout stage
--
-- Group stage + knockout tournaments: knockout games stay locked until every group game is played
-- and the host taps "Start the knockout stage". This column remembers that tap.
-- Tournaments whose knockout games are already being played count as started (backfilled below),
-- so nothing in progress gets locked.
-- Until this runs, the app opens knockout games by itself once every group game is played.
--
-- Safe to run more than once.
-- ==============================================================================

ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS knockout_started_at TIMESTAMPTZ;

UPDATE tournaments t SET knockout_started_at = now()
WHERE t.knockout_started_at IS NULL
  AND EXISTS (
    SELECT 1 FROM matches m
    WHERE m.tournament_id = t.id
      AND m.tournament_stage IS NOT NULL AND m.tournament_stage <> 'group'
      AND m.status <> 'upcoming'
  );

NOTIFY pgrst, 'reload schema';
