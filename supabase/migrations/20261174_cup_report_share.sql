-- ==============================================================================
-- Migration: Share link for the tournament report
--
-- A coach can share the squad version of a tournament report with a link. The link carries a long
-- random token; opening it shows a saved copy of the report as it was when the coach shared it
-- (or last updated the link). The copy holds no minutes and none of the coach's notes for next time.
--   * cup_reviews gains share_token, share_report (the saved copy) and shared_at.
--   * shared_cup_report(token) hands that copy, with the club's name and colours, to anyone who
--     has the link. It is the only way in: the table itself stays staff-only.
-- Stopping the share clears the token, so the old link shows nothing.
-- The app hides the Share button until this has run.
--
-- Needs 20261173_match_reviews.sql. Safe to run more than once.
-- ==============================================================================

ALTER TABLE cup_reviews ADD COLUMN IF NOT EXISTS share_token TEXT;
ALTER TABLE cup_reviews ADD COLUMN IF NOT EXISTS share_report JSONB;
ALTER TABLE cup_reviews ADD COLUMN IF NOT EXISTS shared_at TIMESTAMPTZ;

-- A token is all or nothing: long enough that it can't be guessed, and always with its report
ALTER TABLE cup_reviews DROP CONSTRAINT IF EXISTS cup_reviews_share_shape;
ALTER TABLE cup_reviews ADD CONSTRAINT cup_reviews_share_shape CHECK (
    (share_token IS NULL AND share_report IS NULL)
    OR (share_token ~ '^[A-Za-z0-9]{32,64}$' AND jsonb_typeof(share_report) = 'object' AND pg_column_size(share_report) < 200000)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cup_reviews_share_token ON cup_reviews(share_token) WHERE share_token IS NOT NULL;

-- The saved copy behind a share link, for anyone who has the link. Nothing else from the row.
CREATE OR REPLACE FUNCTION shared_cup_report(p_token TEXT)
RETURNS JSONB
AS $$
    SELECT jsonb_build_object(
               'report', r.share_report,
               'shared_at', r.shared_at,
               'club', jsonb_build_object('name', c.name, 'slug', c.slug, 'logo_url', c.logo_url, 'primary_color', c.primary_color))
      FROM cup_reviews r
      JOIN clubs c ON c.id = r.club_id
     WHERE p_token ~ '^[A-Za-z0-9]{32,64}$'
       AND r.share_token = p_token
       AND c.is_active;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION shared_cup_report(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION shared_cup_report(TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
