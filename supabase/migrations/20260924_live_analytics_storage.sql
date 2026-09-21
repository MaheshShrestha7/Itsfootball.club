-- ==============================================================================
-- Migration: live match clock + realtime, analytics, gate scans, file storage, RSVP tokens
-- Date: 2026-09-24
-- Safe to run more than once.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. LIVE MATCH CLOCK
--    Instead of every browser adding a minute on its own timer, the match stores the
--    minute it was at and the moment that period (re)started. Every screen derives the
--    same minute from those two values.
-- ------------------------------------------------------------------------------
ALTER TABLE matches ADD COLUMN IF NOT EXISTS period_started_at TIMESTAMPTZ;

-- ------------------------------------------------------------------------------
-- 2. REALTIME: push match and match-event changes to everyone watching
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                   WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'matches') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE matches;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                   WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'match_events') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE match_events;
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 3. CONTACT INQUIRIES: anyone may send one, but only to an active club and within sane limits
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public contact submit" ON contact_inquiries;
CREATE POLICY "Public contact submit" ON contact_inquiries FOR INSERT
    WITH CHECK (
        status = 'unread'
        AND char_length(message) BETWEEN 1 AND 4000
        AND char_length(sender_name) BETWEEN 1 AND 255
        AND EXISTS (SELECT 1 FROM clubs c WHERE c.id = club_id AND c.is_active)
    );

-- ------------------------------------------------------------------------------
-- 4. ANALYTICS: visitors write page views, only club admins can read them
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public analytics log" ON club_analytics;
CREATE POLICY "Public analytics log" ON club_analytics FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM clubs c WHERE c.id = club_id AND c.is_active));

DROP POLICY IF EXISTS "Club admin analytics read" ON club_analytics;
CREATE POLICY "Club admin analytics read" ON club_analytics FOR SELECT
    USING (is_club_admin(club_id));

-- ------------------------------------------------------------------------------
-- 5. GATE SCANS (turnstile / check-in log)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gate_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    scan_type VARCHAR(32) NOT NULL,
    token VARCHAR(128),
    member_id UUID,
    member_name VARCHAR(255),
    event_id UUID,
    event_title VARCHAR(255),
    match_id UUID,
    match_title VARCHAR(255),
    valid BOOLEAN NOT NULL DEFAULT TRUE,
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gate_scans_club ON gate_scans (club_id, scanned_at DESC);

ALTER TABLE gate_scans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Club admin gate_scans manage" ON gate_scans;
CREATE POLICY "Club admin gate_scans manage" ON gate_scans FOR ALL
    USING (is_club_admin(club_id)) WITH CHECK (is_club_admin(club_id));

-- ------------------------------------------------------------------------------
-- 6. FILE STORAGE (used when Cloudflare R2 is not configured)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_any_club_admin()
RETURNS BOOLEAN AS $$
    SELECT auth.uid() IS NOT NULL AND (
        EXISTS (SELECT 1 FROM clubs c WHERE c.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM club_members m WHERE m.user_id = auth.uid() AND m.role IN ('owner', 'admin'))
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('club-assets', 'club-assets', TRUE, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE
    SET public = TRUE,
        file_size_limit = 5242880,
        allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

DROP POLICY IF EXISTS "Club admins upload assets" ON storage.objects;
CREATE POLICY "Club admins upload assets" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'club-assets' AND is_any_club_admin());

-- ------------------------------------------------------------------------------
-- 7. AVAILABILITY / RSVP: no more world-readable tokens or world-writable rows
--    Players answer through their personal link; the token is checked inside these functions.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public availability read" ON player_availabilities;
DROP POLICY IF EXISTS "Public availability respond by token" ON player_availabilities;

CREATE OR REPLACE FUNCTION get_availability_by_token(p_token TEXT)
RETURNS SETOF player_availabilities AS $$
    SELECT * FROM player_availabilities WHERE response_token = p_token LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION respond_availability(p_token TEXT, p_status TEXT, p_note TEXT DEFAULT NULL)
RETURNS SETOF player_availabilities AS $$
    UPDATE player_availabilities
       SET status = p_status,
           note = LEFT(p_note, 500),
           responded_at = NOW(),
           updated_at = NOW()
     WHERE response_token = p_token
       AND p_status IN ('available', 'unavailable', 'maybe')
    RETURNING *;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION get_availability_by_token(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION respond_availability(TEXT, TEXT, TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
