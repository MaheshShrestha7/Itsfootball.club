-- ==============================================================================
-- Anti-abuse cooldowns for the two fully-public write endpoints:
--   1. contact_inquiries : anyone can submit ("Public contact submit" policy),
--      so a durable per-email-per-club cooldown is enforced here in Postgres.
--      This holds regardless of how many edge isolates the app runs behind -
--      unlike an in-memory, per-instance rate limit, this state is centralized.
--   2. club_analytics     : anyone can log a page view ("Public analytics log"
--      policy). A per-visitor-per-club cooldown catches a flood from a single
--      spoofed visitor_hash making direct REST calls (bypassing the app's own
--      client-side sessionStorage throttle).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Contact inquiries: max 1 submission per (club_id, sender_email) per 2 minutes.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_contact_inquiry_cooldown()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM contact_inquiries
        WHERE club_id = NEW.club_id
          AND sender_email = NEW.sender_email
          AND created_at > NOW() - INTERVAL '2 minutes'
    ) THEN
        RAISE EXCEPTION 'rate limit: a message from this email was already submitted to this club in the last 2 minutes';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_contact_inquiry_cooldown ON contact_inquiries;
CREATE TRIGGER trg_contact_inquiry_cooldown
    BEFORE INSERT ON contact_inquiries
    FOR EACH ROW
    EXECUTE FUNCTION enforce_contact_inquiry_cooldown();

-- ------------------------------------------------------------------------------
-- 2. Club analytics: max 20 page-view events per (club_id, visitor_hash) per minute.
--    Generous ceiling - legitimate fast navigation shouldn't trip this - but it
--    stops a direct-REST flood from a single spoofed visitor id.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_club_analytics_rate_limit()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.event_type = 'page_view' AND (
        SELECT COUNT(*) FROM club_analytics
        WHERE club_id = NEW.club_id
          AND visitor_hash = NEW.visitor_hash
          AND event_type = 'page_view'
          AND created_at > NOW() - INTERVAL '1 minute'
    ) >= 20 THEN
        RAISE EXCEPTION 'rate limit: too many page view events from this visitor';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_club_analytics_rate_limit ON club_analytics;
CREATE TRIGGER trg_club_analytics_rate_limit
    BEFORE INSERT ON club_analytics
    FOR EACH ROW
    EXECUTE FUNCTION enforce_club_analytics_rate_limit();
