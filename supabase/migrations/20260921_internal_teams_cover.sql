-- ==============================================================================
-- 20260921_internal_teams_cover.sql
-- Add cover photo column to internal_teams
-- ==============================================================================

ALTER TABLE internal_teams
    ADD COLUMN IF NOT EXISTS cover_url TEXT;
