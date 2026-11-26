-- ==============================================================================
-- Migration: Facebook and Instagram posting (Admin > Social media, phase 2)
--
--   * social_accounts: the Facebook Page (and the Instagram business account linked to it) a club
--     posts to. The Page's access token is encrypted by the server before it is saved. Only the
--     server reads or writes this table (row-level security on, no policies): admins see the
--     Page name through /api/social/meta.
--     pending_*: a sign-in with Facebook that the admin who started it hasn't finished yet.
--   * social_post_marks gets two more statuses: 'posting' (the site is posting it now, so a second
--     admin's screen doesn't post it again) and 'failed' (it stays in the to-do list). results
--     says where it went: {"facebook": "<post id>", "instagram": "<media id>", "errors": [...]}.
--   * post_key may now hold a second part, for birthday posts ("birthday:<member id>:<year>").
--
-- Safe to run more than once.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS social_accounts (
    club_id UUID PRIMARY KEY REFERENCES clubs(id) ON DELETE CASCADE,
    fb_user_id TEXT,
    page_id TEXT,
    page_name TEXT CHECK (page_name IS NULL OR char_length(page_name) <= 200),
    page_token_enc TEXT,
    ig_user_id TEXT,
    ig_username TEXT CHECK (ig_username IS NULL OR char_length(ig_username) <= 100),
    connected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    connected_by_name TEXT CHECK (connected_by_name IS NULL OR char_length(connected_by_name) <= 120),
    connected_at TIMESTAMPTZ,
    pending_enc TEXT,
    pending_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    pending_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS social_accounts_fb_user ON social_accounts (fb_user_id);
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON social_accounts FROM anon, authenticated;

ALTER TABLE social_post_marks ADD COLUMN IF NOT EXISTS results JSONB
    CHECK (results IS NULL OR (jsonb_typeof(results) = 'object' AND pg_column_size(results) < 4000));

ALTER TABLE social_post_marks DROP CONSTRAINT IF EXISTS social_post_marks_post_key_check;
ALTER TABLE social_post_marks ADD CONSTRAINT social_post_marks_post_key_check
    CHECK (post_key ~ '^[a-z]{3,10}:[A-Za-z0-9-]{1,64}(:[0-9]{4})?$');
ALTER TABLE social_post_marks DROP CONSTRAINT IF EXISTS social_post_marks_status_check;
ALTER TABLE social_post_marks ADD CONSTRAINT social_post_marks_status_check
    CHECK (status IN ('shared', 'skipped', 'posting', 'failed'));
