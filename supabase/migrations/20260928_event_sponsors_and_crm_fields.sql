-- ==============================================================================
-- Adds:
--   1. Event-scoped sponsors (a sponsor can be tied to one event instead of the
--      whole club) so event detail pages can show their own sponsor list.
--   2. Sponsorship CRM fields: contact details and package (value/status/season).
--      These are admin-only - never exposed on the public site - so the public
--      "Public sponsors read" policy is replaced with a public-safe view, the
--      same pattern already used for club_members_public.
-- ==============================================================================

ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS size_scale VARCHAR(16) DEFAULT 'auto';
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS contact_name VARCHAR(255);
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(64);
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS package_value NUMERIC(12, 2);
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS package_status VARCHAR(32) DEFAULT 'confirmed';
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS season VARCHAR(32);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'sponsors_package_status_check'
    ) THEN
        ALTER TABLE sponsors ADD CONSTRAINT sponsors_package_status_check
            CHECK (package_status IN ('prospect', 'confirmed', 'paid', 'expired', 'cancelled'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sponsors_event ON sponsors (event_id);

-- Sponsorship deal details (contact info, package value/status) are admin-only.
-- The public site instead reads sponsors_public, which excludes those columns.
DROP POLICY IF EXISTS "Public sponsors read" ON sponsors;

CREATE OR REPLACE VIEW sponsors_public AS
    SELECT
        id, club_id, event_id, name, logo_url, website_url, tier, size_scale,
        display_order, is_active, season
    FROM sponsors
    WHERE is_active = TRUE;

GRANT SELECT ON sponsors_public TO anon, authenticated;
