-- ==============================================================================
-- Migration: owner protection, per-club uploads, durable rate limits, sponsor analytics
-- Date: 2026-10-15
--
-- 1. clubs: any Club Admin could set owner_id to themselves (taking the club from its Owner)
--    or delete the club. Now only the Owner can change owner_id or delete; admins still edit
--    everything else. A non-owner's write keeps the old owner_id instead of failing, so the
--    admin app's upserts carry on working.
-- 2. club-assets uploads must sit under clubs/<club id>/ for a club the caller runs, or
--    new-clubs/<own user id>/ (images picked while creating a club). Was: any path, for an
--    admin of any club.
-- 3. hit_rate_limit(): one counter per key in Postgres, shared by every Worker isolate.
--    Service role only (called by API routes).
-- 4. sponsor_analytics: no more direct inserts with the public key. /api/sponsor-track
--    (service role, rate limited) is the only way in, so sponsor figures can't be padded.
--
-- Safe to run more than once.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Club ownership
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Club admin clubs edit" ON clubs;
DROP POLICY IF EXISTS "Club admin clubs insert" ON clubs;
DROP POLICY IF EXISTS "Club admin clubs update" ON clubs;
DROP POLICY IF EXISTS "Club owner clubs delete" ON clubs;
DROP POLICY IF EXISTS "Club admin clubs read" ON clubs;

-- The old FOR ALL policy also let admins read their inactive clubs; keep that
CREATE POLICY "Club admin clubs read" ON clubs FOR SELECT
    USING (is_club_admin(id));
CREATE POLICY "Club admin clubs insert" ON clubs FOR INSERT
    WITH CHECK (is_club_admin(id) OR owner_id = auth.uid());
CREATE POLICY "Club admin clubs update" ON clubs FOR UPDATE
    USING (is_club_admin(id))
    WITH CHECK (is_club_admin(id) OR owner_id = auth.uid());
CREATE POLICY "Club owner clubs delete" ON clubs FOR DELETE
    USING (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION keep_club_owner()
RETURNS TRIGGER AS $$
BEGIN
    -- auth.uid() is NULL for the service role (server routes, SQL editor): allowed
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id
       AND auth.uid() IS NOT NULL
       AND OLD.owner_id IS DISTINCT FROM auth.uid() THEN
        NEW.owner_id := OLD.owner_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_keep_club_owner ON clubs;
CREATE TRIGGER trg_keep_club_owner BEFORE UPDATE ON clubs
    FOR EACH ROW EXECUTE FUNCTION keep_club_owner();

-- ------------------------------------------------------------------------------
-- 2. Uploads scoped to a club
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION can_upload_club_asset(p_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_parts TEXT[] := storage.foldername(p_name);
BEGIN
    IF v_parts[1] = 'new-clubs' THEN
        RETURN auth.uid() IS NOT NULL AND v_parts[2] = auth.uid()::TEXT;
    END IF;
    IF v_parts[1] = 'clubs' AND v_parts[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RETURN is_club_admin(v_parts[2]::UUID);
    END IF;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;

DROP POLICY IF EXISTS "Club admins upload assets" ON storage.objects;
CREATE POLICY "Club admins upload assets" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'club-assets' AND can_upload_club_asset(name));

-- ------------------------------------------------------------------------------
-- 3. Durable rate limits
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_rate_limits (
    key TEXT PRIMARY KEY,
    hits INTEGER NOT NULL,
    reset_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE api_rate_limits ENABLE ROW LEVEL SECURITY; -- no policies: service role only

-- TRUE while `p_key` has been hit at most p_limit times in its current window
CREATE OR REPLACE FUNCTION hit_rate_limit(p_key TEXT, p_limit INTEGER, p_window_seconds INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    v_hits INTEGER;
BEGIN
    INSERT INTO api_rate_limits AS r (key, hits, reset_at)
    VALUES (p_key, 1, NOW() + make_interval(secs => p_window_seconds))
    ON CONFLICT (key) DO UPDATE SET
        hits = CASE WHEN r.reset_at <= NOW() THEN 1 ELSE r.hits + 1 END,
        reset_at = CASE WHEN r.reset_at <= NOW() THEN NOW() + make_interval(secs => p_window_seconds) ELSE r.reset_at END
    RETURNING hits INTO v_hits;

    -- ponytail: probabilistic cleanup; move to the daily cron if this table ever gets hot
    IF random() < 0.01 THEN
        DELETE FROM api_rate_limits WHERE reset_at < NOW() - INTERVAL '1 day';
    END IF;
    RETURN v_hits <= p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION hit_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION hit_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;

-- ------------------------------------------------------------------------------
-- 4. Sponsor analytics: server route only
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public sponsor_analytics log" ON sponsor_analytics;

NOTIFY pgrst, 'reload schema';
