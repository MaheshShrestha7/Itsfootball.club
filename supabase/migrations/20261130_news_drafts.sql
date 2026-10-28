-- ==============================================================================
-- F27-4: draft and scheduled news posts, with a private preview link
--
-- * news_articles.is_draft: saved but not public. A post whose published_at is in the future is
--   scheduled: it goes live by itself at that time (the public read policy compares with NOW(),
--   so nothing has to run).
-- * news_articles.preview_token: the private link (/club/news/slug?preview=token) the committee
--   can open without signing in. news_preview() returns the post only with the right token.
-- * The public read policy now hides drafts and scheduled posts. Staff with the Content area keep
--   seeing them through "Staff read" (20261023_access_roles.sql).
--
-- Safe to run more than once.
-- ==============================================================================

ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS is_draft BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS preview_token UUID NOT NULL DEFAULT gen_random_uuid();

DROP POLICY IF EXISTS "Public news read" ON news_articles;
CREATE POLICY "Public news read" ON news_articles FOR SELECT
    USING (NOT is_draft AND published_at <= NOW());

-- The scheduled-post lookups (and the sitemap's published_at filter) use this
CREATE INDEX IF NOT EXISTS idx_news_live ON news_articles (club_id, published_at DESC) WHERE NOT is_draft;

CREATE OR REPLACE FUNCTION news_preview(p_club_id UUID, p_slug TEXT, p_token UUID)
RETURNS SETOF news_articles AS $$
    SELECT * FROM news_articles
    WHERE club_id = p_club_id AND slug = p_slug AND preview_token = p_token
    LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION news_preview(UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION news_preview(UUID, TEXT, UUID) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
