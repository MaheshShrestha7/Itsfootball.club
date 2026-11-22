-- ==============================================================================
-- Migration: Social media posts (Admin > Social media, phase 1)
--
-- The posts themselves are worked out in the browser from fixtures and events, so only two small
-- things are saved:
--   * social_settings: one row per club. rules = which posts to make and when
--     ({"fixture": {"on": true, "when": "day"}, ...}); hashtags = added to every caption.
--   * social_post_marks: what an admin did with each post ("shared" or "skipped"), so it leaves
--     the to-do list for every admin. post_key is "<trigger>:<match or event id>".
--     caption keeps their edited wording.
-- Both are for admins who can edit News (the content area). The screen keeps working without this
-- migration, saving in that browser only, and says so.
--
-- Safe to run more than once.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS social_settings (
    club_id UUID PRIMARY KEY REFERENCES clubs(id) ON DELETE CASCADE,
    rules JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(rules) = 'object' AND pg_column_size(rules) < 4000),
    hashtags TEXT NOT NULL DEFAULT '' CHECK (char_length(hashtags) <= 300),
    updated_by_name TEXT CHECK (updated_by_name IS NULL OR char_length(updated_by_name) <= 120),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS social_post_marks (
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    post_key TEXT NOT NULL CHECK (post_key ~ '^[a-z]{3,10}:[A-Za-z0-9-]{1,64}$'),
    status TEXT NOT NULL CHECK (status IN ('shared', 'skipped')),
    caption TEXT CHECK (caption IS NULL OR char_length(caption) <= 2200),
    by_name TEXT CHECK (by_name IS NULL OR char_length(by_name) <= 120),
    at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (club_id, post_key)
);
CREATE INDEX IF NOT EXISTS social_post_marks_recent ON social_post_marks (club_id, at DESC);

ALTER TABLE social_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_post_marks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Content read" ON social_settings;
CREATE POLICY "Content read" ON social_settings FOR SELECT USING (has_club_perm(club_id, '{content}', 'view'));
DROP POLICY IF EXISTS "Content insert" ON social_settings;
CREATE POLICY "Content insert" ON social_settings FOR INSERT WITH CHECK (has_club_perm(club_id, '{content}', 'edit'));
DROP POLICY IF EXISTS "Content update" ON social_settings;
CREATE POLICY "Content update" ON social_settings FOR UPDATE
    USING (has_club_perm(club_id, '{content}', 'edit')) WITH CHECK (has_club_perm(club_id, '{content}', 'edit'));

DROP POLICY IF EXISTS "Content read" ON social_post_marks;
CREATE POLICY "Content read" ON social_post_marks FOR SELECT USING (has_club_perm(club_id, '{content}', 'view'));
DROP POLICY IF EXISTS "Content insert" ON social_post_marks;
CREATE POLICY "Content insert" ON social_post_marks FOR INSERT WITH CHECK (has_club_perm(club_id, '{content}', 'edit'));
DROP POLICY IF EXISTS "Content update" ON social_post_marks;
CREATE POLICY "Content update" ON social_post_marks FOR UPDATE
    USING (has_club_perm(club_id, '{content}', 'edit')) WITH CHECK (has_club_perm(club_id, '{content}', 'edit'));
DROP POLICY IF EXISTS "Content delete" ON social_post_marks;
CREATE POLICY "Content delete" ON social_post_marks FOR DELETE USING (has_club_perm(club_id, '{content}', 'edit'));
