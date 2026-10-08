-- ==============================================================================
-- Migration: gallery album covers
-- Date: 2026-10-22
--
-- Albums are the album_name of media_gallery rows, so the chosen cover is a flag on one
-- of the album's photos. Admins pick it from the album (app/[clubSlug]/admin/gallery);
-- an album with no flagged photo shows its newest one.
--
-- Safe to run more than once.
-- ==============================================================================

ALTER TABLE media_gallery ADD COLUMN IF NOT EXISTS is_album_cover BOOLEAN NOT NULL DEFAULT FALSE;

NOTIFY pgrst, 'reload schema';
