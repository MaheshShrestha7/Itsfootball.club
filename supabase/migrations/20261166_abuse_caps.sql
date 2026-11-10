-- ==============================================================================
-- Security fixes SEC11-2, SEC11-4 and SEC11-5 (security scan 10 Nov 2026).
--
-- 1. SEC11-2: deleting a club needs a two-step (aal2) session when the owner has an authenticator,
--    the same mfa_ok() rule admin rights already use (20261129_security_3.sql).
-- 2. SEC11-4: public membership applications go straight into club_members through the public site
--    key, so the join form's captcha and the app's limits can be skipped. Cap them per club per hour
--    and refuse oversized fields.
-- 3. SEC11-5: public contact messages had only a per-email cooldown, which a bot gets round by
--    changing the address. Cap each club's Inbox per hour as well.
--
-- Both caps only apply to the public (anon / signed-in visitor) path: the triggers run as the caller,
-- so club staff, the service role and SECURITY DEFINER functions (current_user = their owner) are
-- not limited, the same rule as clean_public_application. Existing rows are never checked.
-- Safe to run more than once.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Club delete needs two-step sign-in (when the owner has set it up)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Club owner clubs delete" ON clubs;
CREATE POLICY "Club owner clubs delete" ON clubs FOR DELETE
    USING (owner_id = auth.uid() AND mfa_ok());

-- ------------------------------------------------------------------------------
-- Helpers: has this club had at least p_cap public rows in the last hour? SECURITY DEFINER so the
-- count sees every row (a visitor can't read them); it only answers yes or no.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION club_applications_over_cap(p_club_id UUID, p_cap INTEGER)
RETURNS BOOLEAN AS $$
    SELECT count(*) >= p_cap FROM club_members
     WHERE club_id = p_club_id AND created_at > NOW() - INTERVAL '1 hour';
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION club_inquiries_over_cap(p_club_id UUID, p_cap INTEGER)
RETURNS BOOLEAN AS $$
    SELECT count(*) >= p_cap FROM contact_inquiries
     WHERE club_id = p_club_id AND created_at > NOW() - INTERVAL '1 hour';
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION club_applications_over_cap(UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION club_inquiries_over_cap(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION club_applications_over_cap(UUID, INTEGER) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION club_inquiries_over_cap(UUID, INTEGER) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. Public membership applications: at most 100 per club per hour, fields of a sane size
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION limit_public_application()
RETURNS TRIGGER AS $$
BEGIN
    IF current_user NOT IN ('anon', 'authenticated')
       OR has_club_perm(NEW.club_id, '{squad,members,committee}', 'edit') THEN
        RETURN NEW;
    END IF;

    -- The count below runs on created_at, so the applicant can't backdate it
    NEW.created_at := NOW();

    IF char_length(COALESCE(NEW.application_notes, '')) > 4000
       OR char_length(COALESCE(NEW.photo_url, '')) > 2048
       OR char_length(COALESCE(NEW.emergency_contact, '')) > 500
       OR char_length(COALESCE(NEW.guardian_name, '')) > 255
       OR char_length(COALESCE(NEW.guardian_email, '')) > 255
       OR char_length(COALESCE(NEW.guardian_phone, '')) > 64
       OR char_length(COALESCE(NEW.safeguarding_check_type, '')) > 100
       OR char_length(COALESCE(NEW.secondary_positions::text, '')) > 1000 THEN
        RAISE EXCEPTION 'application too large: a field is longer than allowed' USING ERRCODE = '22001';
    END IF;

    IF club_applications_over_cap(NEW.club_id, 100) THEN
        RAISE EXCEPTION 'rate limit: this club has had a lot of applications in the last hour, please try again later'
            USING ERRCODE = '54000';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_limit_public_application ON club_members;
CREATE TRIGGER trg_limit_public_application
    BEFORE INSERT ON club_members
    FOR EACH ROW
    EXECUTE FUNCTION limit_public_application();

CREATE INDEX IF NOT EXISTS idx_club_members_club_created ON club_members (club_id, created_at DESC);

-- ------------------------------------------------------------------------------
-- 3. Public contact messages: at most 30 per club per hour (on top of the per-email cooldown)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION limit_public_contact_inquiry()
RETURNS TRIGGER AS $$
BEGIN
    IF current_user NOT IN ('anon', 'authenticated')
       OR has_club_perm(NEW.club_id, '{inquiries}', 'edit') THEN
        RETURN NEW;
    END IF;

    NEW.created_at := NOW();

    IF club_inquiries_over_cap(NEW.club_id, 30) THEN
        RAISE EXCEPTION 'rate limit: this club has had a lot of messages in the last hour, please try again later'
            USING ERRCODE = '54000';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_limit_public_contact_inquiry ON contact_inquiries;
CREATE TRIGGER trg_limit_public_contact_inquiry
    BEFORE INSERT ON contact_inquiries
    FOR EACH ROW
    EXECUTE FUNCTION limit_public_contact_inquiry();
