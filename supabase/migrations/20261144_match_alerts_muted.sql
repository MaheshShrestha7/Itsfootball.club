-- ==============================================================================
-- Migration: mute follower alerts for a match
-- Date: 2026-11-02
--
-- matches.alerts_muted   true = no kick-off / goal / full-time push alerts for this match
--                        (app/api/push/match checks it). Admins set it from the fixture's edit
--                        form or Match Centre, e.g. to correct a finished match quietly.
--
-- Safe to run more than once.
-- ==============================================================================

ALTER TABLE matches ADD COLUMN IF NOT EXISTS alerts_muted BOOLEAN NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
