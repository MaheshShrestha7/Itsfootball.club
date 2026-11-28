-- ==============================================================================
-- Migration: Tournament prizes and organiser contact
-- Date: 2026-11-28
--
-- Shown on the public tournament page's Overview tab before and during the tournament.
--
--   prizes           [{ "label": "Winner", "prize": "$500 and the trophy" }, ...] in the host's order
--   organiser_name   who runs it (empty = the host club's name)
--   organiser_phone  public contact phone
--   organiser_email  public contact email
--
-- Until this runs the admin form hides these fields and never sends them, so saving keeps working.
-- Safe to run more than once.
-- ==============================================================================

ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS prizes JSONB;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS organiser_name TEXT;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS organiser_phone TEXT;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS organiser_email TEXT;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournaments_prizes_check') THEN
        ALTER TABLE tournaments ADD CONSTRAINT tournaments_prizes_check CHECK (
            prizes IS NULL OR (jsonb_typeof(prizes) = 'array' AND jsonb_array_length(prizes) <= 20 AND length(prizes::text) <= 4000)
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournaments_organiser_check') THEN
        ALTER TABLE tournaments ADD CONSTRAINT tournaments_organiser_check CHECK (
            coalesce(length(organiser_name), 0) <= 120 AND coalesce(length(organiser_phone), 0) <= 40 AND coalesce(length(organiser_email), 0) <= 200
        );
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
