-- ==============================================================================
-- Migration: Season review (end of season report for members, parents and sponsors)
--
-- The review itself is worked out from records the app already keeps. This table holds only what
-- the committee adds by hand, one row per club and season:
--   * awards: Best and Fairest, Coach's award and the like. These are voted or chosen, so the app
--     can't work them out (most Player of the Match awards is not "best player").
--   * thanks: volunteers to thank by name who have no role in the app (canteen, line marking).
--   * hide_money / hide_replies: leave the money summary or the availability replies out.
--   * share_token / share_report / shared_at: the share link, like the cup report's. Opening the
--     link shows the saved copy through shared_season_review(token); the table stays committee-only.
-- Stopping the share clears the token, so the old link shows nothing.
-- The app hides the awards, thanks and Share boxes until this has run.
--
-- Safe to run more than once.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS season_reviews (
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    season TEXT NOT NULL CHECK (char_length(trim(season)) BETWEEN 1 AND 64),
    awards JSONB NOT NULL DEFAULT '[]'::jsonb,
    thanks JSONB NOT NULL DEFAULT '[]'::jsonb,
    hide_money BOOLEAN NOT NULL DEFAULT FALSE,
    hide_replies BOOLEAN NOT NULL DEFAULT FALSE,
    share_token TEXT,
    share_report JSONB,
    shared_at TIMESTAMPTZ,
    updated_by_name TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (club_id, season),
    CONSTRAINT season_reviews_lists CHECK (
        jsonb_typeof(awards) = 'array' AND jsonb_array_length(awards) <= 60
        AND jsonb_typeof(thanks) = 'array' AND jsonb_array_length(thanks) <= 300
        AND pg_column_size(awards) < 40000 AND pg_column_size(thanks) < 60000
    ),
    -- A token is all or nothing: long enough that it can't be guessed, and always with its report
    CONSTRAINT season_reviews_share_shape CHECK (
        (share_token IS NULL AND share_report IS NULL)
        OR (share_token ~ '^[A-Za-z0-9]{32,64}$' AND jsonb_typeof(share_report) = 'object' AND pg_column_size(share_report) < 400000)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_season_reviews_share_token ON season_reviews(share_token) WHERE share_token IS NOT NULL;

ALTER TABLE season_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Committee read" ON season_reviews;
CREATE POLICY "Committee read" ON season_reviews FOR SELECT
    USING (has_club_perm(club_id, '{committee}', 'view'));

DROP POLICY IF EXISTS "Committee insert" ON season_reviews;
CREATE POLICY "Committee insert" ON season_reviews FOR INSERT
    WITH CHECK (has_club_perm(club_id, '{committee}', 'edit'));

DROP POLICY IF EXISTS "Committee update" ON season_reviews;
CREATE POLICY "Committee update" ON season_reviews FOR UPDATE
    USING (has_club_perm(club_id, '{committee}', 'edit'))
    WITH CHECK (has_club_perm(club_id, '{committee}', 'edit'));

DROP POLICY IF EXISTS "Committee delete" ON season_reviews;
CREATE POLICY "Committee delete" ON season_reviews FOR DELETE
    USING (has_club_perm(club_id, '{committee}', 'full'));

-- The saved copy behind a share link, for anyone who has the link. Nothing else from the row.
CREATE OR REPLACE FUNCTION shared_season_review(p_token TEXT)
RETURNS JSONB
AS $$
    SELECT jsonb_build_object(
               'report', r.share_report,
               'shared_at', r.shared_at,
               'club', jsonb_build_object('name', c.name, 'slug', c.slug, 'logo_url', c.logo_url, 'primary_color', c.primary_color))
      FROM season_reviews r
      JOIN clubs c ON c.id = r.club_id
     WHERE p_token ~ '^[A-Za-z0-9]{32,64}$'
       AND r.share_token = p_token
       AND c.is_active;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION shared_season_review(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION shared_season_review(TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
