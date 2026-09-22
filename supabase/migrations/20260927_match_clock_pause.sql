-- ==============================================================================
-- Adds a pause/resume state to the live match clock so admins can freeze the
-- clock for an in-play stoppage (injury, VAR check, etc.) without switching
-- the match out of 'live' status/period the way going to halftime would.
-- See lib/match-clock.ts (getLiveMinute) and app/[clubSlug]/admin/match-center.
-- ==============================================================================

ALTER TABLE matches ADD COLUMN IF NOT EXISTS is_paused BOOLEAN DEFAULT FALSE;
