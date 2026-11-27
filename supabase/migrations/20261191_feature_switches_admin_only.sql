-- Feature switches (clubs.config.features_off, Admin -> Features) are for the club's Owner and Club Admins only.
-- Staff who can edit Branding can still update the club row, so a change to features_off from anyone else is
-- dropped: their own save still goes through with the switches left as they were (a stale copy can't undo them).
-- Mission Control and the server use the service role (no signed-in user), so they pass.
-- Safe to run more than once.

CREATE OR REPLACE FUNCTION keep_feature_switches_for_admins()
RETURNS TRIGGER AS $$
BEGIN
    IF auth.uid() IS NOT NULL
       AND (NEW.config -> 'features_off') IS DISTINCT FROM (OLD.config -> 'features_off')
       AND NOT is_club_admin(NEW.id) THEN
        IF OLD.config ? 'features_off' THEN
            NEW.config := jsonb_set(COALESCE(NEW.config, '{}'::jsonb), '{features_off}', OLD.config -> 'features_off');
        ELSE
            NEW.config := COALESCE(NEW.config, '{}'::jsonb) - 'features_off';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS clubs_feature_switches_admin_only ON clubs;
CREATE TRIGGER clubs_feature_switches_admin_only
    BEFORE UPDATE OF config ON clubs
    FOR EACH ROW EXECUTE FUNCTION keep_feature_switches_for_admins();
