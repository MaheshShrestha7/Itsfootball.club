-- ==============================================================================
-- Migration: gallery photos linked to a club event (e.g. the photos from a cup or a gala)
-- Date: 2026-11-13
--
--   * media_gallery.event_id: the event a photo belongs to. Admin links a whole album at once, and
--     the event page shows its albums. Deleting the event keeps the photos and only clears the link.
--
-- Safe to run more than once.
-- ==============================================================================

ALTER TABLE media_gallery ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_media_gallery_event ON media_gallery (event_id) WHERE event_id IS NOT NULL;
