-- ==============================================================================
-- Migration: Tournament tie-breakers
--
-- How teams level on points are split, in order, chosen per tournament in its setup / Edit form:
--   gd = goal difference, gf = goals scored, h2h = head-to-head, wins = most wins,
--   fair_play = fewest card points, lots = drawing lots (the app draws once and keeps it).
-- NULL (every existing tournament) = the standard order: goal difference, goals scored, head-to-head.
-- An empty array = points only; teams level on points share the place.
-- The app hides the Tie-breakers section until this has run.
--
-- Safe to run more than once.
-- ==============================================================================

ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS tie_breakers TEXT[];

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournaments_tie_breakers_check') THEN
    ALTER TABLE tournaments ADD CONSTRAINT tournaments_tie_breakers_check
      CHECK (tie_breakers IS NULL OR (tie_breakers <@ ARRAY['gd', 'gf', 'h2h', 'wins', 'fair_play', 'lots']::TEXT[] AND cardinality(tie_breakers) <= 6));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
