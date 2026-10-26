-- ==============================================================================
-- Migration: pitch surface only when the club chose one
-- Date: 2026-11-28
--
--   * clubs.stadium_pitch_type: no default. Every club was created with 'Natural Hybrid Turf'
--     and the Branding form preselected it too, so the home page told fans "Built with Natural
--     Hybrid Turf" for grounds that are plain grass.
--   * Clubs still on that old default go back to "not set". An admin whose ground really is
--     hybrid turf can pick it again in Branding.
--
-- Safe to run more than once.
-- ==============================================================================

ALTER TABLE clubs ALTER COLUMN stadium_pitch_type DROP DEFAULT;

UPDATE clubs SET stadium_pitch_type = NULL WHERE stadium_pitch_type = 'Natural Hybrid Turf';
