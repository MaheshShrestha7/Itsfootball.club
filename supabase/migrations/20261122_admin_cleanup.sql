-- ==============================================================================
-- Admin clean-up (ADM-R4, ADM-R5).
-- 1. Clear the stock photos older builds saved as defaults, so pages show the
-- club's crest and colours instead of the same generic picture on every club.
-- Only the exact default photo of each field is cleared:
--   clubs.banner_url            - the wizard's banner (photo-1522778119026)
--   news_articles.cover_image_url - the news form's cover (photo-1522778119026)
--   matches.match_flyer_url     - the fixture form's flyer (photo-1574629810360)
--   sponsors.logo_url           - the sneaker photo used for a sponsor with no logo
--   clubs.hero_pinned_items     - image_url on pinned slides set to any of the slide defaults
-- Photos picked on purpose from the flyer and cover presets keep a different photo or field,
-- and uploads are untouched. Safe to run more than once.
-- ==============================================================================

UPDATE clubs SET banner_url = NULL
WHERE banner_url LIKE 'https://images.unsplash.com/photo-1522778119026-d647f0596c20%';

UPDATE news_articles SET cover_image_url = NULL
WHERE cover_image_url LIKE 'https://images.unsplash.com/photo-1522778119026-d647f0596c20%';

UPDATE matches SET match_flyer_url = NULL
WHERE match_flyer_url LIKE 'https://images.unsplash.com/photo-1574629810360-7efbbe195018%';

-- logo_url is NOT NULL; an empty logo shows the sponsor's initials
UPDATE sponsors SET logo_url = ''
WHERE logo_url LIKE 'https://images.unsplash.com/photo-1542291026-7eec264c27ff%';

UPDATE clubs c
SET hero_pinned_items = (
  SELECT jsonb_agg(
    CASE WHEN item->>'image_url' ~ '^https://images\.unsplash\.com/photo-(1574629810360-7efbbe195018|1522778119026-d647f0596c20|1517466787929-bc90951d0974)'
      THEN item - 'image_url' ELSE item END
    ORDER BY ord)
  FROM jsonb_array_elements(c.hero_pinned_items) WITH ORDINALITY AS t(item, ord)
)
WHERE jsonb_typeof(c.hero_pinned_items) = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(c.hero_pinned_items) item
    WHERE item->>'image_url' ~ '^https://images\.unsplash\.com/photo-(1574629810360-7efbbe195018|1522778119026-d647f0596c20|1517466787929-bc90951d0974)'
  );

-- ------------------------------------------------------------------------------
-- Tournament sides are now managed on the Tournaments screen (ADM-R4), so people with
-- Tournaments access can add, edit and delete them as well as people with Teams access.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Staff insert" ON internal_teams;
CREATE POLICY "Staff insert" ON internal_teams FOR INSERT
    WITH CHECK (has_club_perm(club_id, '{teams,tournaments}', 'edit'));
DROP POLICY IF EXISTS "Staff update" ON internal_teams;
CREATE POLICY "Staff update" ON internal_teams FOR UPDATE
    USING (has_club_perm(club_id, '{teams,tournaments}', 'edit'))
    WITH CHECK (has_club_perm(club_id, '{teams,tournaments}', 'edit'));
DROP POLICY IF EXISTS "Staff delete" ON internal_teams;
CREATE POLICY "Staff delete" ON internal_teams FOR DELETE
    USING (has_club_perm(club_id, '{teams,tournaments}', 'full'));

-- ------------------------------------------------------------------------------
-- Plain pitch type (ADM-E5): "Hybrid Grass (FIFA Pro Quality)" was shown on public pages
-- ------------------------------------------------------------------------------
UPDATE clubs SET stadium_pitch_type = 'Hybrid Grass'
WHERE stadium_pitch_type = 'Hybrid Grass (FIFA Pro Quality)';
