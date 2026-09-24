-- ==============================================================================
-- Migration: real sponsor placement analytics (impressions, viewable impressions,
-- clicks) so the admin Sponsor Hub / Media Kit view reports actual traffic instead
-- of a modeled estimate. Safe to run more than once.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS sponsor_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    sponsor_id UUID NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
    event_type VARCHAR(32) NOT NULL CHECK (event_type IN ('impression', 'viewable_impression', 'click')),
    placement VARCHAR(64),
    device VARCHAR(16),
    -- Resolved server-side from the CDN geo header (see app/api/sponsor-track), never
    -- trusted from the client, so it can't be spoofed to fake a sponsor's audience mix.
    country VARCHAR(8),
    visitor_hash VARCHAR(64),
    -- Only set on 'viewable_impression': how long the placement stayed in view, in ms.
    dwell_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sponsor_analytics_club ON sponsor_analytics (club_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sponsor_analytics_sponsor ON sponsor_analytics (sponsor_id, created_at);

ALTER TABLE sponsor_analytics ENABLE ROW LEVEL SECURITY;

-- Anyone may log a placement event, but only for a real, active sponsor of an active club.
DROP POLICY IF EXISTS "Public sponsor_analytics log" ON sponsor_analytics;
CREATE POLICY "Public sponsor_analytics log" ON sponsor_analytics FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM sponsors s
            JOIN clubs c ON c.id = s.club_id
            WHERE s.id = sponsor_id AND s.club_id = club_id AND s.is_active AND c.is_active
        )
    );

-- Only that club's admins can read the numbers back.
DROP POLICY IF EXISTS "Club admin sponsor_analytics read" ON sponsor_analytics;
CREATE POLICY "Club admin sponsor_analytics read" ON sponsor_analytics FOR SELECT
    USING (is_club_admin(club_id));

-- Durable, per-visitor cooldown (mirrors club_analytics's own rate limit) so a direct-REST
-- flood from a single spoofed visitor_hash can't inflate a sponsor's numbers, regardless of
-- how many edge isolates the app runs behind.
CREATE OR REPLACE FUNCTION enforce_sponsor_analytics_rate_limit()
RETURNS TRIGGER AS $$
BEGIN
    IF (
        SELECT COUNT(*) FROM sponsor_analytics
        WHERE club_id = NEW.club_id
          AND sponsor_id = NEW.sponsor_id
          AND visitor_hash = NEW.visitor_hash
          AND event_type = NEW.event_type
          AND created_at > NOW() - INTERVAL '1 minute'
    ) >= 10 THEN
        RAISE EXCEPTION 'rate limit: too many sponsor analytics events from this visitor';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_sponsor_analytics_rate_limit ON sponsor_analytics;
CREATE TRIGGER trg_sponsor_analytics_rate_limit
    BEFORE INSERT ON sponsor_analytics
    FOR EACH ROW
    EXECUTE FUNCTION enforce_sponsor_analytics_rate_limit();

NOTIFY pgrst, 'reload schema';
