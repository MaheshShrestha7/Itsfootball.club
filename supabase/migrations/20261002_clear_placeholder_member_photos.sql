-- ==============================================================================
-- Clear placeholder member photos, so avatars fall back to the member's initials.
-- Older builds saved one stock Unsplash image as the photo of every member added without
-- one (and bulk imports did the same), so most of a squad showed the same face.
-- Clears:
--   1. that stock image (any size variant), and
--   2. any photo URL shared by more than one member of the same club - a shared image is a
--      placeholder, not anyone's real photo.
-- Genuine, individually uploaded photos are untouched. Safe to run more than once.
-- ==============================================================================

UPDATE club_members m
SET photo_url = NULL
WHERE m.photo_url IS NOT NULL
  AND (
    m.photo_url LIKE 'https://images.unsplash.com/photo-1534528741775-53994a69daeb%'
    OR EXISTS (
      SELECT 1 FROM club_members o
      WHERE o.club_id = m.club_id
        AND o.photo_url = m.photo_url
        AND o.id <> m.id
    )
  );
