-- ==============================================================================
-- Migration: sponsor labels typed by the club admin
-- Date: 2026-11-27
--
--   * sponsors.label: optional text shown on the sponsor's badge on the club site (for example
--     "Front of Shirt Partner"). Blank shows the tier name (Gold Partner, Silver Partner...).
--     The tier still sets the order and the default logo size.
--   * sponsors_public: the public view now includes label.
--
-- Safe to run more than once.
-- ==============================================================================

ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS label VARCHAR(60);

-- Same columns as before plus label at the end (CREATE OR REPLACE can only add columns at the end)
CREATE OR REPLACE VIEW sponsors_public AS
    SELECT
        id, club_id, event_id, name, logo_url, website_url, tier, size_scale,
        display_order, is_active, season, label
    FROM sponsors
    WHERE is_active = TRUE;

GRANT SELECT ON sponsors_public TO anon, authenticated;
