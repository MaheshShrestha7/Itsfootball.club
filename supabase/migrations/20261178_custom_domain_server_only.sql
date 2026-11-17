-- ==============================================================================
-- Migration: Only the server sets a club's custom domain (SEC17-2)
--
-- Connecting a domain is Owner-only with two-step sign-in, checks the domain isn't taken and
-- registers it on Cloudflare (app/api/custom-domain, which writes with the service key). Before
-- this, the table let anyone skip all that:
--   * any signed-in user could create a club with any custom_domain (claiming a real club's
--     domain before that club connected it)
--   * any Club Admin could change or clear it with a plain update, leaving the old domain live on
--     Cloudflare for someone else's new club to claim
-- Now a signed-in user's own insert or update never changes custom_domain: an insert keeps it
-- empty, an update keeps the old value (a branding save that sends the column back still works).
-- The service key and database functions (Mission Control, closing clubs) are unaffected.
--
-- Safe to run more than once.
-- ==============================================================================

CREATE OR REPLACE FUNCTION keep_club_custom_domain()
RETURNS TRIGGER AS $$
BEGIN
    IF current_user IN ('authenticated', 'anon') THEN
        IF TG_OP = 'INSERT' THEN
            NEW.custom_domain := NULL;
        ELSE
            NEW.custom_domain := OLD.custom_domain;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_keep_club_custom_domain ON clubs;
CREATE TRIGGER trg_keep_club_custom_domain BEFORE INSERT OR UPDATE ON clubs
    FOR EACH ROW EXECUTE FUNCTION keep_club_custom_domain();

NOTIFY pgrst, 'reload schema';
