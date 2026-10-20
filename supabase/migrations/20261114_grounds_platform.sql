-- ==============================================================================
-- Migration: grounds added by the platform (Mission Control -> Grounds)
-- Date: 2026-11-14
--
--   * grounds.source / grounds.source_ref: where a ground's first details came from.
--     NULL = typed in by a club or a platform admin. 'osm' = imported from OpenStreetMap through
--     "Import from map" (source_ref like 'osm:way/123', so the same park is never imported twice).
--     Ground pages from OpenStreetMap credit "© OpenStreetMap contributors" (ODbL).
--   * Imported grounds start as drafts (is_published = FALSE): nobody sees them until a platform
--     admin publishes them, and lib/grounds.ts still keeps them out of search engines until they
--     have a pin, a council, 3 facts and a club using them.
--   * A ground with no steward club (steward_club_id NULL) is looked after by the platform. The first
--     club to pick it as its home ground becomes its steward (/api/admin/grounds).
--
-- Writes come through /api/platform/grounds (service role, after is_platform_admin()).
-- Needs 20261109_grounds.sql first. Safe to run more than once.
-- ==============================================================================

ALTER TABLE grounds ADD COLUMN IF NOT EXISTS source VARCHAR(16);
ALTER TABLE grounds ADD COLUMN IF NOT EXISTS source_ref VARCHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS idx_grounds_source_ref ON grounds (source_ref) WHERE source_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_grounds_unpublished ON grounds (created_at DESC) WHERE is_published = FALSE;
