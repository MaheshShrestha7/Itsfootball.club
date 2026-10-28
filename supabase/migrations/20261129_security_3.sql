-- ==============================================================================
-- Migration: security fixes from the 27 Oct 2026 review (SEC27)
--
--   SEC27-1  Medical notes move off club_members into club_member_health. Only the club's super
--            users (Owner, Club Admin), the coaches and team staff of the member's own teams, the
--            member and their guardian can read them. Before, every role that could view the
--            squad, members or committee could.
--   SEC27-3  Two-step sign-in (an authenticator app code, Supabase MFA):
--              - Platform admins need it: Mission Control works only in a two-step session.
--              - Anyone who has turned it on must use it: their club admin and staff powers
--                only work once the code has been entered (a password alone isn't enough).
--   SEC27-4  admin_audit_log: who approved, rejected, suspended, deleted or waived a fee, who
--            verified or rejected a payment, who changed roles, the club's address or domain, or
--            the platform admins. Written by triggers (can't be skipped), read-only.
--   SEC27-5  Visit tracking: referrer and metadata size are capped, and platform visits get the
--            same per-visitor limit as club visits.
--
-- Run after 20261128. Safe to run more than once.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- SEC27-3 (first, the functions below use it). mfa_ok(): this session passed two-step sign-in,
-- or the user hasn't turned it on.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION session_is_aal2()
RETURNS BOOLEAN AS $$
    SELECT COALESCE(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$ LANGUAGE sql STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION mfa_ok()
RETURNS BOOLEAN AS $$
    SELECT session_is_aal2()
        OR NOT EXISTS (SELECT 1 FROM auth.mfa_factors f WHERE f.user_id = auth.uid() AND f.status = 'verified');
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION session_is_aal2() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION mfa_ok() TO authenticated, anon;

-- Same as 20261106, plus mfa_ok()
CREATE OR REPLACE FUNCTION is_club_admin(p_club_id UUID)
RETURNS BOOLEAN AS $$
    SELECT auth.uid() IS NOT NULL AND mfa_ok() AND (
        EXISTS (SELECT 1 FROM clubs c WHERE c.id = p_club_id AND c.owner_id = auth.uid())
        OR EXISTS (
            SELECT 1 FROM club_members m
             WHERE m.club_id = p_club_id
               AND m.user_id = auth.uid()
               AND COALESCE(m.membership_status, 'approved') = 'approved'
               AND COALESCE(m.status, 'active') <> 'suspended'
               AND member_is_admin(m.role, m.roles)
        )
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION has_club_perm(p_club_id UUID, p_areas TEXT[] DEFAULT NULL, p_level TEXT DEFAULT 'view')
RETURNS BOOLEAN AS $$
    SELECT is_club_admin(p_club_id) OR (mfa_ok() AND EXISTS (
        SELECT 1
          FROM club_members m
          JOIN club_access_roles r ON r.club_id = m.club_id
         WHERE m.club_id = p_club_id
           AND m.user_id = auth.uid()
           AND COALESCE(m.membership_status, 'approved') = 'approved'
           AND COALESCE(m.status, 'active') <> 'suspended'
           AND lower(r.name) = ANY (member_labels(m.role, m.roles))
           AND EXISTS (
               SELECT 1 FROM jsonb_each_text(r.permissions) p
                WHERE (p_areas IS NULL OR p.key = ANY (p_areas))
                  AND perm_rank(p.value) >= perm_rank(p_level)
           )
    ));
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Same as 20261116, but only in a two-step session. platform_admin_listed() tells Mission Control
-- that the person is on the list and only needs to set up or enter their code.
CREATE OR REPLACE FUNCTION platform_admin_listed()
RETURNS TEXT AS $$
    SELECT pa.role
      FROM platform_admins pa
     WHERE auth.uid() IS NOT NULL
       AND pa.is_active = TRUE
       AND (
           pa.user_id = auth.uid()
           OR (
               pa.user_id IS NULL
               AND EXISTS (
                   SELECT 1 FROM auth.users u
                    WHERE u.id = auth.uid()
                      AND u.email_confirmed_at IS NOT NULL
                      AND lower(u.email) = lower(pa.email)
               )
           )
       )
     ORDER BY CASE pa.role WHEN 'super_admin' THEN 0 WHEN 'operator' THEN 1 ELSE 2 END
     LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION platform_admin_role()
RETURNS TEXT AS $$
    SELECT CASE WHEN session_is_aal2() THEN platform_admin_listed() END;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION platform_admin_listed() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION platform_admin_role() TO authenticated, anon;

-- ------------------------------------------------------------------------------
-- SEC27-1. Medical notes in their own table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS club_member_health (
    member_id UUID PRIMARY KEY REFERENCES club_members(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    medical_notes TEXT CHECK (char_length(medical_notes) <= 2000),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID
);
CREATE INDEX IF NOT EXISTS idx_member_health_club ON club_member_health (club_id);
ALTER TABLE club_member_health ENABLE ROW LEVEL SECURITY;

-- Move the notes written since 20261123, then drop the old column
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'club_members' AND column_name = 'medical_notes') THEN
        EXECUTE $q$
            INSERT INTO club_member_health (member_id, club_id, medical_notes)
            SELECT id, club_id, medical_notes FROM club_members WHERE COALESCE(trim(medical_notes), '') <> ''
            ON CONFLICT (member_id) DO NOTHING
        $q$;
        ALTER TABLE club_members DROP COLUMN medical_notes;
    END IF;
END $$;

-- Who may read a member's medical notes
CREATE OR REPLACE FUNCTION can_read_member_health(p_member_id UUID, p_club_id UUID)
RETURNS BOOLEAN AS $$
    SELECT auth.uid() IS NOT NULL AND (
        is_club_admin(p_club_id)
        OR is_guardian_of(p_member_id, p_club_id)
        OR EXISTS (SELECT 1 FROM club_members m WHERE m.id = p_member_id AND m.club_id = p_club_id AND m.user_id = auth.uid())
        -- Coaches and team staff of a team the member is in
        OR (mfa_ok() AND EXISTS (
            SELECT 1
              FROM club_team_members player
              JOIN club_team_members staff ON staff.team_id = player.team_id
              JOIN club_members me ON me.id = staff.member_id
             WHERE player.member_id = p_member_id
               AND player.club_id = p_club_id
               AND staff.team_role IN ('coach', 'assistant', 'manager', 'physio')
               AND COALESCE(staff.is_active, TRUE)
               AND me.user_id = auth.uid()
               AND COALESCE(me.membership_status, 'approved') = 'approved'
               AND COALESCE(me.status, 'active') <> 'suspended'
        ))
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

DROP POLICY IF EXISTS "Health read" ON club_member_health;
CREATE POLICY "Health read" ON club_member_health FOR SELECT TO authenticated
    USING (can_read_member_health(member_id, club_id));
-- Writes only through the functions below
REVOKE INSERT, UPDATE, DELETE ON club_member_health FROM anon, authenticated;
GRANT SELECT ON club_member_health TO authenticated;

-- The notes the caller may read at a club (admins' People page, coaches, guardians)
CREATE OR REPLACE FUNCTION member_health_notes(p_club_id UUID)
RETURNS TABLE (member_id UUID, medical_notes TEXT) AS $$
    SELECT h.member_id, h.medical_notes
      FROM club_member_health h
     WHERE h.club_id = p_club_id
       AND COALESCE(h.medical_notes, '') <> ''
       AND can_read_member_health(h.member_id, h.club_id);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Club super users and the guardian write them ('' clears)
CREATE OR REPLACE FUNCTION set_member_medical_notes(p_club_id UUID, p_member_id UUID, p_notes TEXT)
RETURNS VOID AS $$
BEGIN
    IF NOT (is_club_admin(p_club_id) OR is_guardian_of(p_member_id, p_club_id)) THEN
        RAISE EXCEPTION 'Only a Club Admin or the member''s guardian can change medical notes' USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM club_members WHERE id = p_member_id AND club_id = p_club_id) THEN
        RAISE EXCEPTION 'Member not found' USING ERRCODE = '22023';
    END IF;
    INSERT INTO club_member_health (member_id, club_id, medical_notes, updated_at, updated_by)
    VALUES (p_member_id, p_club_id, NULLIF(LEFT(trim(COALESCE(p_notes, '')), 2000), ''), NOW(), auth.uid())
    ON CONFLICT (member_id) DO UPDATE
       SET medical_notes = EXCLUDED.medical_notes, updated_at = NOW(), updated_by = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Same as 20261123, with medical notes going to the new table
CREATE OR REPLACE FUNCTION update_child_details(
    p_club_id UUID, p_member_id UUID, p_photo_consent BOOLEAN, p_emergency_contact TEXT, p_medical_notes TEXT
)
RETURNS VOID AS $$
BEGIN
    IF NOT is_guardian_of(p_member_id, p_club_id) THEN
        RAISE EXCEPTION 'You can only update your own children at this club' USING ERRCODE = '42501';
    END IF;
    UPDATE club_members
       SET photo_consent = COALESCE(p_photo_consent, photo_consent),
           emergency_contact = CASE WHEN p_emergency_contact IS NULL THEN emergency_contact ELSE NULLIF(LEFT(trim(p_emergency_contact), 200), '') END,
           updated_at = NOW()
     WHERE id = p_member_id AND club_id = p_club_id;
    IF p_medical_notes IS NOT NULL THEN
        PERFORM set_member_medical_notes(p_club_id, p_member_id, p_medical_notes);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION can_read_member_health(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION member_health_notes(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION set_member_medical_notes(UUID, UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION update_child_details(UUID, UUID, BOOLEAN, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION can_read_member_health(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION member_health_notes(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION set_member_medical_notes(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_child_details(UUID, UUID, BOOLEAN, TEXT, TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- SEC27-4. Audit log
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID REFERENCES clubs(id) ON DELETE CASCADE, -- NULL: a platform (Mission Control) action
    actor_id UUID,
    actor_email TEXT,
    action TEXT NOT NULL,
    target_table TEXT NOT NULL,
    target_id UUID,
    summary TEXT NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_club_time ON admin_audit_log (club_id, created_at DESC);
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Audit read" ON admin_audit_log;
CREATE POLICY "Audit read" ON admin_audit_log FOR SELECT TO authenticated
    USING ((club_id IS NOT NULL AND is_club_admin(club_id)) OR (club_id IS NULL AND is_platform_admin()));
-- Nobody edits or deletes the log (the triggers below write as the table owner)
REVOKE INSERT, UPDATE, DELETE ON admin_audit_log FROM anon, authenticated;
GRANT SELECT ON admin_audit_log TO authenticated;

CREATE OR REPLACE FUNCTION write_audit(p_club_id UUID, p_action TEXT, p_table TEXT, p_target UUID, p_summary TEXT, p_details JSONB DEFAULT '{}'::jsonb)
RETURNS VOID AS $$
    INSERT INTO admin_audit_log (club_id, actor_id, actor_email, action, target_table, target_id, summary, details)
    VALUES (p_club_id, auth.uid(), (SELECT email FROM auth.users WHERE id = auth.uid()), p_action, p_table, p_target, LEFT(p_summary, 300), COALESCE(p_details, '{}'::jsonb));
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION write_audit(UUID, TEXT, TEXT, UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;

-- Members: approval, rejection, suspension, roles, fee waivers, account changes, removal.
-- Only people's actions (a signed-in user, directly or through a function they called); public
-- applications and automatic payment updates aren't logged here.
CREATE OR REPLACE FUNCTION audit_club_members()
RETURNS TRIGGER AS $$
DECLARE
    v_name TEXT := COALESCE(NULLIF(trim(COALESCE(OLD.full_name, '')), ''), trim(COALESCE(OLD.first_name, '') || ' ' || COALESCE(OLD.last_name, '')), 'a member');
BEGIN
    IF auth.uid() IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
    IF TG_OP = 'DELETE' THEN
        PERFORM write_audit(OLD.club_id, 'member_deleted', 'club_members', OLD.id, 'Removed ' || v_name,
            jsonb_build_object('membership_status', OLD.membership_status, 'role', OLD.role));
        RETURN OLD;
    END IF;
    IF NEW.membership_status IS DISTINCT FROM OLD.membership_status THEN
        PERFORM write_audit(NEW.club_id, 'membership_' || COALESCE(NEW.membership_status, 'changed'), 'club_members', NEW.id,
            CASE NEW.membership_status WHEN 'approved' THEN 'Approved ' WHEN 'rejected' THEN 'Rejected ' ELSE 'Changed membership of ' END || v_name,
            jsonb_build_object('from', OLD.membership_status, 'to', NEW.membership_status, 'reason', NEW.rejection_reason));
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        PERFORM write_audit(NEW.club_id, 'member_status', 'club_members', NEW.id,
            CASE WHEN NEW.status = 'suspended' THEN 'Suspended ' ELSE 'Set ' || COALESCE(NEW.status, 'active') || ': ' END || v_name,
            jsonb_build_object('from', OLD.status, 'to', NEW.status));
    END IF;
    IF NEW.fee_waived_at IS DISTINCT FROM OLD.fee_waived_at AND NEW.fee_waived_at IS NOT NULL THEN
        PERFORM write_audit(NEW.club_id, 'fee_waived', 'club_members', NEW.id, 'Waived the fee for ' || v_name,
            jsonb_build_object('reason', NEW.fee_waiver_reason));
    END IF;
    IF NEW.role IS DISTINCT FROM OLD.role OR NEW.roles IS DISTINCT FROM OLD.roles THEN
        PERFORM write_audit(NEW.club_id, 'member_roles', 'club_members', NEW.id, 'Changed the roles of ' || v_name,
            jsonb_build_object('from', jsonb_build_object('role', OLD.role, 'roles', OLD.roles), 'to', jsonb_build_object('role', NEW.role, 'roles', NEW.roles)));
    END IF;
    IF NEW.user_id IS DISTINCT FROM OLD.user_id OR lower(COALESCE(NEW.email, '')) <> lower(COALESCE(OLD.email, ''))
       OR lower(COALESCE(NEW.guardian_email, '')) <> lower(COALESCE(OLD.guardian_email, '')) THEN
        PERFORM write_audit(NEW.club_id, 'member_account', 'club_members', NEW.id, 'Changed the sign-in or guardian email of ' || v_name, '{}'::jsonb);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_audit_club_members ON club_members;
CREATE TRIGGER trg_audit_club_members AFTER UPDATE OR DELETE ON club_members
    FOR EACH ROW EXECUTE FUNCTION audit_club_members();

-- Payments: verified, rejected or refunded by a person, or deleted
CREATE OR REPLACE FUNCTION audit_payments()
RETURNS TRIGGER AS $$
DECLARE
    v_row payments := COALESCE(NEW, OLD);
    v_what TEXT := COALESCE(NULLIF(v_row.payer_name, ''), 'unnamed payer') || ', ' || to_char(v_row.amount_cents / 100.0, 'FM999999990.00') || ' ' || COALESCE(v_row.currency, '');
BEGIN
    IF auth.uid() IS NULL THEN RETURN v_row; END IF;
    IF TG_OP = 'DELETE' THEN
        PERFORM write_audit(OLD.club_id, 'payment_deleted', 'payments', OLD.id, 'Deleted payment: ' || v_what,
            jsonb_build_object('kind', OLD.kind, 'status', OLD.status));
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
        PERFORM write_audit(NEW.club_id, 'payment_' || NEW.status, 'payments', NEW.id,
            CASE NEW.status WHEN 'paid' THEN 'Marked paid: ' WHEN 'rejected' THEN 'Rejected payment: ' WHEN 'refunded' THEN 'Refunded: ' ELSE 'Payment ' || NEW.status || ': ' END || v_what,
            jsonb_build_object('kind', NEW.kind, 'method', NEW.method, 'from', OLD.status, 'to', NEW.status, 'reason', NEW.rejection_reason));
    END IF;
    RETURN v_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_audit_payments ON payments;
CREATE TRIGGER trg_audit_payments AFTER UPDATE OF status OR DELETE ON payments
    FOR EACH ROW EXECUTE FUNCTION audit_payments();

-- The club's address, domain, owner and on/off switch
CREATE OR REPLACE FUNCTION audit_clubs()
RETURNS TRIGGER AS $$
BEGIN
    IF auth.uid() IS NULL THEN RETURN NEW; END IF;
    IF NEW.slug IS DISTINCT FROM OLD.slug THEN
        PERFORM write_audit(NEW.id, 'club_address', 'clubs', NEW.id, 'Changed the club address from /' || OLD.slug || ' to /' || NEW.slug, '{}'::jsonb);
    END IF;
    IF NEW.custom_domain IS DISTINCT FROM OLD.custom_domain THEN
        PERFORM write_audit(NEW.id, 'club_domain', 'clubs', NEW.id, 'Changed the club domain to ' || COALESCE(NEW.custom_domain, '(none)'),
            jsonb_build_object('from', OLD.custom_domain, 'to', NEW.custom_domain));
    END IF;
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
        PERFORM write_audit(NEW.id, 'club_owner', 'clubs', NEW.id, 'Changed the club Owner', jsonb_build_object('from', OLD.owner_id, 'to', NEW.owner_id));
    END IF;
    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
        PERFORM write_audit(NEW.id, 'club_active', 'clubs', NEW.id, CASE WHEN NEW.is_active THEN 'Reactivated the club' ELSE 'Suspended the club' END, '{}'::jsonb);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_audit_clubs ON clubs;
CREATE TRIGGER trg_audit_clubs AFTER UPDATE OF slug, custom_domain, owner_id, is_active ON clubs
    FOR EACH ROW EXECUTE FUNCTION audit_clubs();

-- Access roles
CREATE OR REPLACE FUNCTION audit_access_roles()
RETURNS TRIGGER AS $$
DECLARE
    v_row club_access_roles := COALESCE(NEW, OLD);
BEGIN
    IF auth.uid() IS NULL THEN RETURN v_row; END IF;
    IF TG_OP = 'UPDATE' AND NEW.name IS NOT DISTINCT FROM OLD.name AND NEW.permissions IS NOT DISTINCT FROM OLD.permissions THEN
        RETURN v_row;
    END IF;
    PERFORM write_audit(v_row.club_id, 'role_' || lower(TG_OP), 'club_access_roles', v_row.id,
        CASE TG_OP WHEN 'INSERT' THEN 'Added the role ' WHEN 'DELETE' THEN 'Deleted the role ' ELSE 'Changed the role ' END || v_row.name,
        jsonb_build_object('from', CASE WHEN TG_OP <> 'INSERT' THEN OLD.permissions END, 'to', CASE WHEN TG_OP <> 'DELETE' THEN NEW.permissions END));
    RETURN v_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_audit_access_roles ON club_access_roles;
CREATE TRIGGER trg_audit_access_roles AFTER INSERT OR UPDATE OR DELETE ON club_access_roles
    FOR EACH ROW EXECUTE FUNCTION audit_access_roles();

-- Platform admins (Mission Control)
CREATE OR REPLACE FUNCTION audit_platform_admins()
RETURNS TRIGGER AS $$
DECLARE
    v_row platform_admins := COALESCE(NEW, OLD);
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.role IS NOT DISTINCT FROM OLD.role AND NEW.is_active IS NOT DISTINCT FROM OLD.is_active THEN
        RETURN v_row;
    END IF;
    PERFORM write_audit(NULL, 'platform_admin_' || lower(TG_OP), 'platform_admins', NULL,
        CASE WHEN TG_OP = 'INSERT' THEN 'Added platform admin ' WHEN TG_OP = 'DELETE' OR NOT NEW.is_active THEN 'Removed platform admin ' ELSE 'Changed platform admin ' END || v_row.email,
        jsonb_build_object('role', v_row.role));
    RETURN v_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_audit_platform_admins ON platform_admins;
CREATE TRIGGER trg_audit_platform_admins AFTER INSERT OR UPDATE OR DELETE ON platform_admins
    FOR EACH ROW EXECUTE FUNCTION audit_platform_admins();

-- ------------------------------------------------------------------------------
-- SEC27-5. Visit tracking limits
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public platform analytics insert" ON platform_analytics;
CREATE POLICY "Public platform analytics insert" ON platform_analytics FOR INSERT
    WITH CHECK (
        char_length(COALESCE(page_path, '')) <= 255
        AND char_length(COALESCE(event_type, '')) <= 64
        AND char_length(COALESCE(referrer, '')) <= 500
        AND pg_column_size(COALESCE(metadata, '{}'::jsonb)) <= 2048
    );

DROP POLICY IF EXISTS "Public analytics log" ON club_analytics;
CREATE POLICY "Public analytics log" ON club_analytics FOR INSERT
    WITH CHECK (
        EXISTS (SELECT 1 FROM clubs c WHERE c.id = club_id AND c.is_active)
        AND char_length(COALESCE(referrer, '')) <= 500
        AND pg_column_size(COALESCE(metadata, '{}'::jsonb)) <= 2048
    );

CREATE OR REPLACE FUNCTION enforce_platform_analytics_rate_limit()
RETURNS TRIGGER AS $$
BEGIN
    -- 'anon' is every visitor whose browser blocks storage: not one person, so not limited here
    IF current_user IN ('anon', 'authenticated') AND COALESCE(NEW.visitor_hash, 'anon') <> 'anon' AND (
        SELECT COUNT(*) FROM platform_analytics
         WHERE visitor_hash = NEW.visitor_hash
           AND created_at > NOW() - INTERVAL '1 minute'
    ) >= 20 THEN
        RAISE EXCEPTION 'rate limit: too many page view events from this visitor';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE INDEX IF NOT EXISTS idx_platform_analytics_visitor ON platform_analytics (visitor_hash, created_at DESC);
DROP TRIGGER IF EXISTS trg_platform_analytics_rate_limit ON platform_analytics;
CREATE TRIGGER trg_platform_analytics_rate_limit BEFORE INSERT ON platform_analytics
    FOR EACH ROW EXECUTE FUNCTION enforce_platform_analytics_rate_limit();

NOTIFY pgrst, 'reload schema';
