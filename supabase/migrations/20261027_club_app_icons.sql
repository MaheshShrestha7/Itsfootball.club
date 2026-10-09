-- ==============================================================================
-- Migration: club home-screen icons
-- Date: 2026-10-27
--
-- The club app (per-club manifest and iPhone icon) showed the itsfootball icon. The admin area
-- now draws the club crest into PNG icons (192, 512 and a maskable 512 with safe-zone padding),
-- uploads them and keeps their URLs here, with the crest URL they were made from:
--   { "source": "<logo_url>", "icon192": "...", "icon512": "...", "maskable512": "..." }
-- Written like the rest of the branding (clubs update policy).
--
-- Safe to run more than once.
-- ==============================================================================

ALTER TABLE clubs ADD COLUMN IF NOT EXISTS app_icons JSONB;

NOTIFY pgrst, 'reload schema';
