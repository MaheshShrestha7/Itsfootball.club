-- ==============================================================================
-- Migration: public grounds directory (phase 1)
-- Date: 2026-11-09
--
-- A shared list of community football grounds, one public guide page each at
-- /grounds/{suburb}/{ground} (app/grounds, lib/grounds.ts):
--   * grounds: the facts about a ground (address, pin, council, pitches, parking, toilets, canteen,
--     accessibility). Facts are about a place, not a person, so a published ground is public.
--     Kept up to date by its steward club (the club that added it).
--   * clubs.home_ground_id: the club's home ground in the directory (optional).
--   * clubs.grounds_directory_listed: the club's opt-in to have its NAME and senior home fixtures
--     shown on the ground's page. Off by default, so no existing club is named anywhere until an
--     admin switches it on. Junior teams, hidden-score teams and training are never shown.
--
-- Both clubs columns are deliberately left out of lib/supabase/columns.ts: the admin screen writes
-- them through /api/admin/grounds, so the club sync never sends a stale copy over them.
-- The old free-text columns (clubs.stadium_*, matches.venue) are not touched.
--
-- Safe to run more than once.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS grounds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    steward_club_id UUID REFERENCES clubs(id) ON DELETE SET NULL,
    name VARCHAR(120) NOT NULL CHECK (length(trim(name)) >= 2),
    slug VARCHAR(96) NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    suburb VARCHAR(80) NOT NULL CHECK (length(trim(suburb)) >= 2),
    suburb_slug VARCHAR(96) NOT NULL CHECK (suburb_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    state VARCHAR(3) NOT NULL CHECK (state IN ('NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT')),
    postcode VARCHAR(4) CHECK (postcode IS NULL OR postcode ~ '^[0-9]{4}$'),
    address VARCHAR(200),
    lat DOUBLE PRECISION CHECK (lat IS NULL OR lat BETWEEN -44 AND -9),
    lng DOUBLE PRECISION CHECK (lng IS NULL OR lng BETWEEN 112 AND 154),
    council_key VARCHAR(64),            -- a key from lib/councils.ts, or 'other'
    council_name VARCHAR(120),          -- only for 'other'
    pitches JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(pitches) = 'array' AND jsonb_array_length(pitches) <= 30),
    parking VARCHAR(400),
    toilets VARCHAR(400),
    canteen VARCHAR(400),
    accessibility VARCHAR(400),
    notes VARCHAR(600),
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    previous_paths TEXT[] NOT NULL DEFAULT '{}',   -- 'suburb/ground' paths it moved from (301 redirects)
    facts_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (suburb_slug, slug)
);

CREATE INDEX IF NOT EXISTS idx_grounds_steward ON grounds (steward_club_id);
CREATE INDEX IF NOT EXISTS idx_grounds_previous_paths ON grounds USING GIN (previous_paths);

ALTER TABLE clubs ADD COLUMN IF NOT EXISTS home_ground_id UUID REFERENCES grounds(id) ON DELETE SET NULL;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS grounds_directory_listed BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_clubs_home_ground ON clubs (home_ground_id);

-- Anyone can read published grounds. Writes go through /api/admin/grounds (service role, after a
-- has_club_perm(club, 'branding', 'edit') check); staff of the steward club may also edit directly.
ALTER TABLE grounds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public grounds read" ON grounds;
CREATE POLICY "Public grounds read" ON grounds FOR SELECT USING (is_published = TRUE);

DROP POLICY IF EXISTS "Steward grounds read" ON grounds;
CREATE POLICY "Steward grounds read" ON grounds FOR SELECT
    USING (steward_club_id IS NOT NULL AND has_club_perm(steward_club_id, ARRAY['branding'], 'view'));

DROP POLICY IF EXISTS "Steward grounds update" ON grounds;
CREATE POLICY "Steward grounds update" ON grounds FOR UPDATE
    USING (steward_club_id IS NOT NULL AND has_club_perm(steward_club_id, ARRAY['branding'], 'edit'))
    WITH CHECK (steward_club_id IS NOT NULL AND has_club_perm(steward_club_id, ARRAY['branding'], 'edit'));

GRANT SELECT ON grounds TO anon, authenticated;
GRANT UPDATE ON grounds TO authenticated;
