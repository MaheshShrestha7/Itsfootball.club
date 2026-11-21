-- ==============================================================================
-- Migration: one scoring link per club (Itsfootball.club Bot on Telegram)
--
--   * club_chat_settings.join_code: the code in the club's permanent link (t.me/<bot>?start=<code>).
--     Anyone who taps it asks to score; "Make a new link" replaces the code and the old link stops.
--   * chat_join_requests: one ask per tap. 'naming' until the person says which member they are,
--     then 'waiting' until an admin taps Allow or No (in Telegram or in Match Centre settings).
--     asks = the admins' Telegram messages [{chat_id, message_id}], rewritten once someone answers.
--
-- Server-only like the other chat tables: RLS on, no policies; the API routes use the service role.
-- Needs 20261183_score_by_chat.sql first. Safe to run more than once.
-- ==============================================================================

ALTER TABLE club_chat_settings ADD COLUMN IF NOT EXISTS join_code TEXT;
ALTER TABLE club_chat_settings ADD COLUMN IF NOT EXISTS join_code_made_at TIMESTAMPTZ;
ALTER TABLE club_chat_settings ADD COLUMN IF NOT EXISTS join_code_made_by TEXT CHECK (join_code_made_by IS NULL OR char_length(join_code_made_by) <= 120);
DO $$ BEGIN
    ALTER TABLE club_chat_settings ADD CONSTRAINT club_chat_settings_join_code_ok CHECK (join_code IS NULL OR join_code ~ '^[A-Za-z0-9_-]{8,64}$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS club_chat_settings_join_code ON club_chat_settings (join_code) WHERE join_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS chat_join_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    channel TEXT NOT NULL DEFAULT 'telegram' CHECK (channel IN ('telegram')),
    chat_id TEXT NOT NULL CHECK (char_length(chat_id) <= 40),
    member_id UUID REFERENCES club_members(id) ON DELETE CASCADE,
    -- The person's Telegram name, so admins can see who is asking ("Priya G (@priyag)")
    sender TEXT CHECK (sender IS NULL OR char_length(sender) <= 120),
    status TEXT NOT NULL DEFAULT 'naming' CHECK (status IN ('naming', 'waiting', 'allowed', 'declined')),
    asks JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(asks) = 'array' AND pg_column_size(asks) < 8000),
    answered_by TEXT CHECK (answered_by IS NULL OR char_length(answered_by) <= 120),
    answered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS chat_join_requests_chat ON chat_join_requests (channel, chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS chat_join_requests_club ON chat_join_requests (club_id, status);

ALTER TABLE chat_join_requests ENABLE ROW LEVEL SECURITY;
