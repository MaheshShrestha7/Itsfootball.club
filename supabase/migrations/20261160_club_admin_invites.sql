-- ==============================================================================
-- Migration: invite anyone to own or run a club, without them joining it
-- Date: 2026-11-09
--
-- Until now a Club Admin had to be an approved club member (the admin label lives on their
-- club_members row), and Mission Control could only hand a club to a member. Now:
--
--   1. club_admin_grants: Club Admin access for people who are NOT members. No member row, so
--      they never show in the squad, members, People, fees or public pages.
--   2. club_admin_invites: Mission Control invites any email as Owner or Club Admin. The person
--      signs in with that email and accepts; only then does anything change.
--   3. is_club_admin() and my_club_permissions() also accept a grant (still behind mfa_ok()).
--   4. Mission Control: invite, resend, cancel; "Who runs it" lists non-member admins; "Make
--      owner" works for them too, and the old Owner keeps admin access as the popup promised.
--   5. The club's own Roles page lists who has admin access without a membership.
--
-- Admins who are members work exactly as before. Run after 20261159. Safe to run again.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Admin access without a membership
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS club_admin_grants (
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    granted_by UUID DEFAULT auth.uid(),
    -- Shown next to the person, e.g. 'Owner until 9 Nov 2026'
    note TEXT CHECK (note IS NULL OR char_length(note) <= 200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (club_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_club_admin_grants_user ON club_admin_grants (user_id);
ALTER TABLE club_admin_grants ENABLE ROW LEVEL SECURITY;
-- Read and changed only through the functions below
REVOKE ALL ON club_admin_grants FROM anon, authenticated;

-- ------------------------------------------------------------------------------
-- 2. Invites
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS club_admin_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    email TEXT NOT NULL CHECK (email = lower(trim(email)) AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' AND char_length(email) <= 254),
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin')),
    -- Owner invites: the current Owner stays on as Club Admin after the handover
    keep_old_owner BOOLEAN NOT NULL DEFAULT TRUE,
    -- sha256 of the emailed link's token; the token itself is never stored
    token_hash TEXT NOT NULL UNIQUE,
    invited_by UUID DEFAULT auth.uid(),
    invited_by_email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
    accepted_at TIMESTAMPTZ,
    accepted_by UUID,
    cancelled_at TIMESTAMPTZ
);
-- One open invite per person per club (a new one replaces the old)
CREATE UNIQUE INDEX IF NOT EXISTS uq_club_admin_invites_open ON club_admin_invites (club_id, email)
    WHERE accepted_at IS NULL AND cancelled_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_club_admin_invites_club ON club_admin_invites (club_id, created_at DESC);
ALTER TABLE club_admin_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON club_admin_invites FROM anon, authenticated;
-- Every column but the token hash (so select the columns by name, not *)
GRANT SELECT (id, club_id, email, role, keep_old_owner, invited_by, invited_by_email, created_at, sent_at, expires_at, accepted_at, accepted_by, cancelled_at)
    ON club_admin_invites TO authenticated;
DROP POLICY IF EXISTS "Platform admins read club invites" ON club_admin_invites;
CREATE POLICY "Platform admins read club invites" ON club_admin_invites FOR SELECT TO authenticated
    USING (is_platform_admin());

CREATE OR REPLACE FUNCTION invite_token_hash(p_token TEXT)
RETURNS TEXT AS $$
    SELECT encode(sha256(convert_to(COALESCE(p_token, ''), 'UTF8')), 'hex');
$$ LANGUAGE sql IMMUTABLE SET search_path = public;
REVOKE ALL ON FUNCTION invite_token_hash(TEXT) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 3. Who counts as an admin: same as 20261129, plus a grant
-- ------------------------------------------------------------------------------
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
        OR EXISTS (SELECT 1 FROM club_admin_grants g WHERE g.club_id = p_club_id AND g.user_id = auth.uid())
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Same as 20261106, plus the clubs where the user holds a grant
CREATE OR REPLACE FUNCTION my_club_permissions()
 RETURNS TABLE(club_id uuid, is_admin boolean, role_names text[], permissions jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    WITH mine AS (
        SELECT r.club_id AS cid, r.name, r.permissions AS perms
          FROM club_members m
          JOIN club_access_roles r ON r.club_id = m.club_id AND lower(r.name) = ANY (member_labels(m.role, m.roles))
         WHERE m.user_id = auth.uid()
           AND COALESCE(m.membership_status, 'approved') = 'approved'
           AND COALESCE(m.status, 'active') <> 'suspended'
    ), my_clubs AS (
        SELECT c.id AS cid FROM clubs c WHERE c.owner_id = auth.uid()
        UNION
        SELECT m.club_id FROM club_members m WHERE m.user_id = auth.uid()
        UNION
        SELECT g.club_id FROM club_admin_grants g WHERE g.user_id = auth.uid()
    )
    SELECT
        mc.cid,
        is_club_admin(mc.cid),
        COALESCE(ARRAY(SELECT mine.name FROM mine WHERE mine.cid = mc.cid ORDER BY mine.name), '{}'),
        COALESCE((
            SELECT jsonb_object_agg(x.area, CASE x.rk WHEN 3 THEN 'full' WHEN 2 THEN 'edit' ELSE 'view' END)
              FROM (
                  SELECT p.key AS area, max(perm_rank(p.value)) AS rk
                    FROM mine, jsonb_each_text(mine.perms) p
                   WHERE mine.cid = mc.cid
                   GROUP BY p.key
                  HAVING max(perm_rank(p.value)) > 0
              ) x
        ), '{}'::jsonb)
    FROM my_clubs mc;
$function$;

-- Is this user an admin through their member row (not counting a grant or ownership)?
CREATE OR REPLACE FUNCTION is_member_admin_of(p_club_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM club_members m
         WHERE m.club_id = p_club_id AND m.user_id = p_user_id
           AND COALESCE(m.membership_status, 'approved') = 'approved'
           AND COALESCE(m.status, 'active') <> 'suspended'
           AND member_is_admin(m.role, m.roles)
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION is_member_admin_of(UUID, UUID) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 4. Owner changes: as 20261145, plus the person accepting an Owner invite right now
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION keep_club_owner()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id
       AND auth.uid() IS NOT NULL
       AND OLD.owner_id IS DISTINCT FROM auth.uid()
       AND NOT is_platform_operator()
       -- accept_club_admin_invite() marks the invite accepted in the same transaction, just before
       AND NOT EXISTS (
           SELECT 1 FROM club_admin_invites i
            WHERE i.club_id = NEW.id AND i.role = 'owner'
              AND i.accepted_by = auth.uid() AND NEW.owner_id = auth.uid()
              AND i.accepted_at = NOW()
       ) THEN
        NEW.owner_id := OLD.owner_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ------------------------------------------------------------------------------
-- 5. History (admin_audit_log, 20261129)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION account_label(p_user_id UUID)
RETURNS TEXT AS $$
    SELECT COALESCE(NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''), u.email, 'someone')::TEXT
      FROM auth.users u WHERE u.id = p_user_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION account_label(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION audit_club_admin_grants()
RETURNS TRIGGER AS $$
BEGIN
    IF auth.uid() IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
    IF TG_OP = 'INSERT' THEN
        PERFORM write_audit(NEW.club_id, 'admin_grant_added', 'club_admin_grants', NEW.user_id,
            'Gave ' || COALESCE(account_label(NEW.user_id), 'someone') || ' admin access without a membership', '{}'::jsonb);
        RETURN NEW;
    END IF;
    PERFORM write_audit(OLD.club_id, 'admin_grant_removed', 'club_admin_grants', OLD.user_id,
        'Removed admin access for ' || COALESCE(account_label(OLD.user_id), 'someone'), '{}'::jsonb);
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_audit_club_admin_grants ON club_admin_grants;
CREATE TRIGGER trg_audit_club_admin_grants AFTER INSERT OR DELETE ON club_admin_grants
    FOR EACH ROW EXECUTE FUNCTION audit_club_admin_grants();

-- ------------------------------------------------------------------------------
-- 6. Mission Control: send, resend and cancel invites
-- ------------------------------------------------------------------------------
-- p_token: the random token in the emailed link (the API route makes it and sends the email).
-- Returns 'applied' when the email belongs to an approved member and they were made Club Admin
-- straight away (as "Add admin" did before), else 'invited'.
CREATE OR REPLACE FUNCTION platform_invite_club_admin(p_club_id UUID, p_email TEXT, p_role TEXT, p_keep_old_owner BOOLEAN, p_token TEXT)
RETURNS TABLE (status TEXT, invite_id UUID) AS $$
DECLARE
    v_email TEXT := lower(trim(COALESCE(p_email, '')));
    v_club clubs;
    v_user UUID;
    v_id UUID;
BEGIN
    IF NOT is_platform_operator() THEN
        RAISE EXCEPTION 'Analysts can view clubs but not change them.' USING ERRCODE = '42501';
    END IF;
    IF p_role NOT IN ('owner', 'admin') THEN
        RAISE EXCEPTION 'Pick Owner or Club Admin.' USING ERRCODE = '22023';
    END IF;
    IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR char_length(v_email) > 254 THEN
        RAISE EXCEPTION 'That email address doesn''t look right.' USING ERRCODE = '22023';
    END IF;
    IF char_length(COALESCE(p_token, '')) < 32 THEN
        RAISE EXCEPTION 'Missing invite token.' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_club FROM clubs WHERE id = p_club_id;
    IF v_club.id IS NULL THEN
        RAISE EXCEPTION 'Club not found.' USING ERRCODE = '22023';
    END IF;
    IF v_club.closed_at IS NOT NULL THEN
        RAISE EXCEPTION 'This club is closing. Reopen it first.' USING ERRCODE = '22023';
    END IF;

    SELECT u.id INTO v_user FROM auth.users u WHERE lower(u.email) = v_email LIMIT 1;
    IF v_user IS NOT NULL AND v_user = v_club.owner_id THEN
        RAISE EXCEPTION 'They already own this club.' USING ERRCODE = '22023';
    END IF;

    IF p_role = 'admin' THEN
        IF v_user IS NOT NULL AND (is_member_admin_of(p_club_id, v_user)
            OR EXISTS (SELECT 1 FROM club_admin_grants g WHERE g.club_id = p_club_id AND g.user_id = v_user)) THEN
            RAISE EXCEPTION 'They''re already an admin of this club.' USING ERRCODE = '22023';
        END IF;
        -- An approved member with an account: make them Club Admin now, as "Add admin" always did
        IF v_user IS NOT NULL AND EXISTS (
            SELECT 1 FROM club_members m
             WHERE m.club_id = p_club_id AND m.user_id = v_user
               AND COALESCE(m.membership_status, 'approved') = 'approved'
               AND COALESCE(m.status, 'active') <> 'suspended'
        ) THEN
            UPDATE club_members
               SET roles = (CASE WHEN jsonb_typeof(roles) = 'array' THEN roles ELSE '[]'::jsonb END) || '["Club Admin"]'::jsonb
             WHERE id = (SELECT m.id FROM club_members m
                          WHERE m.club_id = p_club_id AND m.user_id = v_user
                            AND COALESCE(m.membership_status, 'approved') = 'approved'
                          ORDER BY m.created_at LIMIT 1);
            -- A waiting invite for them is no longer needed
            UPDATE club_admin_invites SET cancelled_at = NOW()
             WHERE club_id = p_club_id AND email = v_email AND accepted_at IS NULL AND cancelled_at IS NULL;
            RETURN QUERY SELECT 'applied'::TEXT, NULL::UUID;
            RETURN;
        END IF;
    END IF;

    -- A new invite replaces a waiting one for the same person
    UPDATE club_admin_invites SET cancelled_at = NOW()
     WHERE club_id = p_club_id AND email = v_email AND accepted_at IS NULL AND cancelled_at IS NULL;

    INSERT INTO club_admin_invites (club_id, email, role, keep_old_owner, token_hash, invited_by, invited_by_email)
    VALUES (p_club_id, v_email, p_role, COALESCE(p_keep_old_owner, TRUE), invite_token_hash(p_token), auth.uid(),
            (SELECT email FROM auth.users WHERE id = auth.uid()))
    RETURNING id INTO v_id;

    PERFORM write_audit(p_club_id, 'admin_invite_sent', 'club_admin_invites', v_id,
        CASE p_role WHEN 'owner' THEN 'Owner' ELSE 'Club Admin' END || ' invite sent to ' || v_email, '{}'::jsonb);
    RETURN QUERY SELECT 'invited'::TEXT, v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION platform_invite_club_admin(UUID, TEXT, TEXT, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION platform_invite_club_admin(UUID, TEXT, TEXT, BOOLEAN, TEXT) TO authenticated;

-- A new link (the old one stops working) and another 7 days. Returns who to email.
CREATE OR REPLACE FUNCTION platform_resend_club_admin_invite(p_invite_id UUID, p_token TEXT)
RETURNS TABLE (club_id UUID, email TEXT, role TEXT) AS $$
DECLARE
    v_inv club_admin_invites;
BEGIN
    IF NOT is_platform_operator() THEN
        RAISE EXCEPTION 'Analysts can view clubs but not change them.' USING ERRCODE = '42501';
    END IF;
    IF char_length(COALESCE(p_token, '')) < 32 THEN
        RAISE EXCEPTION 'Missing invite token.' USING ERRCODE = '22023';
    END IF;
    UPDATE club_admin_invites i
       SET token_hash = invite_token_hash(p_token), sent_at = NOW(), expires_at = NOW() + INTERVAL '7 days'
     WHERE i.id = p_invite_id AND i.accepted_at IS NULL AND i.cancelled_at IS NULL
    RETURNING * INTO v_inv;
    IF v_inv.id IS NULL THEN
        RAISE EXCEPTION 'That invite was already accepted or cancelled.' USING ERRCODE = '22023';
    END IF;
    RETURN QUERY SELECT v_inv.club_id, v_inv.email, v_inv.role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION platform_resend_club_admin_invite(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION platform_resend_club_admin_invite(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION platform_cancel_club_admin_invite(p_invite_id UUID)
RETURNS VOID AS $$
DECLARE
    v_inv club_admin_invites;
BEGIN
    IF NOT is_platform_operator() THEN
        RAISE EXCEPTION 'Analysts can view clubs but not change them.' USING ERRCODE = '42501';
    END IF;
    UPDATE club_admin_invites SET cancelled_at = NOW()
     WHERE id = p_invite_id AND accepted_at IS NULL AND cancelled_at IS NULL
    RETURNING * INTO v_inv;
    IF v_inv.id IS NULL THEN
        RAISE EXCEPTION 'That invite was already accepted or cancelled.' USING ERRCODE = '22023';
    END IF;
    PERFORM write_audit(v_inv.club_id, 'admin_invite_cancelled', 'club_admin_invites', v_inv.id,
        'Cancelled the ' || CASE v_inv.role WHEN 'owner' THEN 'Owner' ELSE 'Club Admin' END || ' invite for ' || v_inv.email, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION platform_cancel_club_admin_invite(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION platform_cancel_club_admin_invite(UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 7. The invite page: look up and accept
-- ------------------------------------------------------------------------------
-- Anyone holding the link can see what it's for. state: open, expired, accepted, cancelled, closed
CREATE OR REPLACE FUNCTION get_club_admin_invite(p_token TEXT)
RETURNS TABLE (club_name TEXT, club_slug TEXT, logo_url TEXT, primary_color TEXT, secondary_color TEXT, role TEXT, email TEXT, state TEXT, expires_at TIMESTAMPTZ, accepted_by_me BOOLEAN) AS $$
    SELECT c.name::TEXT, c.slug::TEXT, c.logo_url::TEXT, c.primary_color::TEXT, c.secondary_color::TEXT, i.role, i.email,
           CASE
               WHEN i.accepted_at IS NOT NULL THEN 'accepted'
               WHEN i.cancelled_at IS NOT NULL THEN 'cancelled'
               WHEN c.closed_at IS NOT NULL THEN 'closed'
               WHEN i.expires_at < NOW() THEN 'expired'
               ELSE 'open'
           END,
           i.expires_at,
           (i.accepted_by IS NOT NULL AND i.accepted_by = auth.uid())
      FROM club_admin_invites i
      JOIN clubs c ON c.id = i.club_id
     WHERE char_length(COALESCE(p_token, '')) >= 32
       AND i.token_hash = invite_token_hash(p_token);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION get_club_admin_invite(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_club_admin_invite(TEXT) TO anon, authenticated;

-- The signed-in user accepts. Their confirmed account email must be the invited one.
CREATE OR REPLACE FUNCTION accept_club_admin_invite(p_token TEXT)
RETURNS TABLE (club_slug TEXT, role TEXT) AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_email TEXT;
    v_inv club_admin_invites;
    v_club clubs;
    v_old UUID;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Sign in to accept the invite.' USING ERRCODE = '42501';
    END IF;
    SELECT lower(u.email) INTO v_email FROM auth.users u WHERE u.id = v_uid AND u.email_confirmed_at IS NOT NULL;

    SELECT * INTO v_inv FROM club_admin_invites i
     WHERE char_length(COALESCE(p_token, '')) >= 32 AND i.token_hash = invite_token_hash(p_token)
     FOR UPDATE;
    IF v_inv.id IS NULL THEN
        RAISE EXCEPTION 'This invite link isn''t valid. Ask for a new one.' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_club FROM clubs WHERE id = v_inv.club_id FOR UPDATE;

    -- Opening the link again after accepting just takes them to the admin
    IF v_inv.accepted_at IS NOT NULL AND v_inv.accepted_by = v_uid THEN
        RETURN QUERY SELECT v_club.slug::TEXT, v_inv.role;
        RETURN;
    END IF;
    IF v_inv.accepted_at IS NOT NULL THEN
        RAISE EXCEPTION 'This invite has already been used.' USING ERRCODE = '22023';
    END IF;
    IF v_inv.cancelled_at IS NOT NULL THEN
        RAISE EXCEPTION 'This invite was cancelled. Ask for a new one.' USING ERRCODE = '22023';
    END IF;
    IF v_inv.expires_at < NOW() THEN
        RAISE EXCEPTION 'This invite has expired. Ask for a new one.' USING ERRCODE = '22023';
    END IF;
    IF v_club.closed_at IS NOT NULL THEN
        RAISE EXCEPTION 'This club is closing, so the invite can''t be used.' USING ERRCODE = '22023';
    END IF;
    IF v_email IS NULL OR v_email <> v_inv.email THEN
        RAISE EXCEPTION 'This invite is for %. Sign in with that email to accept it.', v_inv.email USING ERRCODE = '42501';
    END IF;

    UPDATE club_admin_invites SET accepted_at = NOW(), accepted_by = v_uid WHERE id = v_inv.id;

    IF v_inv.role = 'admin' THEN
        -- Already the Owner or an admin through their membership: nothing to add
        IF v_club.owner_id IS DISTINCT FROM v_uid AND NOT is_member_admin_of(v_club.id, v_uid) THEN
            INSERT INTO club_admin_grants (club_id, user_id, granted_by)
            VALUES (v_club.id, v_uid, v_inv.invited_by)
            ON CONFLICT (club_id, user_id) DO NOTHING;
        END IF;
    ELSIF v_club.owner_id IS DISTINCT FROM v_uid THEN
        v_old := v_club.owner_id;
        -- The Owner doesn't need a grant (ownership alone gives access)
        DELETE FROM club_admin_grants g WHERE g.club_id = v_club.id AND g.user_id = v_uid;
        UPDATE clubs SET owner_id = v_uid, updated_at = NOW() WHERE id = v_club.id;
        IF (SELECT c.owner_id FROM clubs c WHERE c.id = v_club.id) IS DISTINCT FROM v_uid THEN
            RAISE EXCEPTION 'Could not hand the club over. Please try again.' USING ERRCODE = '42501';
        END IF;
        IF v_inv.keep_old_owner AND v_old IS NOT NULL AND NOT is_member_admin_of(v_club.id, v_old) THEN
            INSERT INTO club_admin_grants (club_id, user_id, granted_by, note)
            VALUES (v_club.id, v_old, v_inv.invited_by, 'Owner until ' || to_char(NOW() AT TIME ZONE 'Australia/Sydney', 'FMDD Mon YYYY'))
            ON CONFLICT (club_id, user_id) DO NOTHING;
        END IF;
        -- Only one Owner: any other waiting Owner invite for this club is no longer valid
        UPDATE club_admin_invites SET cancelled_at = NOW()
         WHERE club_admin_invites.club_id = v_club.id AND club_admin_invites.role = 'owner'
           AND accepted_at IS NULL AND cancelled_at IS NULL;
    END IF;

    PERFORM write_audit(v_club.id, 'admin_invite_accepted', 'club_admin_invites', v_inv.id,
        COALESCE(account_label(v_uid), v_inv.email) || ' accepted the ' || CASE v_inv.role WHEN 'owner' THEN 'Owner' ELSE 'Club Admin' END || ' invite', '{}'::jsonb);
    RETURN QUERY SELECT v_club.slug::TEXT, v_inv.role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION accept_club_admin_invite(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION accept_club_admin_invite(TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 8. Listing and removing non-member admins (club Roles page and Mission Control)
-- ------------------------------------------------------------------------------
-- The Owner when they have no member row, plus everyone holding a grant
CREATE OR REPLACE FUNCTION get_club_admin_grants(p_club_id UUID)
RETURNS TABLE (user_id UUID, name TEXT, email TEXT, is_owner BOOLEAN, note TEXT, since TIMESTAMPTZ) AS $$
BEGIN
    IF NOT (is_club_admin(p_club_id) OR is_platform_admin()) THEN
        RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
    END IF;
    RETURN QUERY
    SELECT c.owner_id, account_label(c.owner_id), u.email::TEXT, TRUE, NULL::TEXT, NULL::TIMESTAMPTZ
      FROM clubs c
      JOIN auth.users u ON u.id = c.owner_id
     WHERE c.id = p_club_id
       AND NOT EXISTS (SELECT 1 FROM club_members m WHERE m.club_id = c.id AND m.user_id = c.owner_id)
    UNION ALL
    SELECT g.user_id, account_label(g.user_id), u.email::TEXT, FALSE, g.note, g.created_at
      FROM club_admin_grants g
      JOIN auth.users u ON u.id = g.user_id
     WHERE g.club_id = p_club_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION get_club_admin_grants(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_club_admin_grants(UUID) TO authenticated;

-- The club's Owner / Club Admins, or a platform Operator
CREATE OR REPLACE FUNCTION remove_club_admin_grant(p_club_id UUID, p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    IF NOT (is_club_admin(p_club_id) OR is_platform_operator()) THEN
        RAISE EXCEPTION 'Only the Owner or a Club Admin can remove admin access.' USING ERRCODE = '42501';
    END IF;
    DELETE FROM club_admin_grants WHERE club_id = p_club_id AND user_id = p_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'They don''t have admin access without a membership.' USING ERRCODE = '22023';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION remove_club_admin_grant(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION remove_club_admin_grant(UUID, UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 9. Mission Control "Who runs it": as 20261145, plus is_member / has_grant and grant holders
--    (the return type changes, so drop first)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS get_platform_club_people(UUID);
CREATE FUNCTION get_platform_club_people(p_club_id UUID)
RETURNS TABLE (
    member_id UUID,
    user_id UUID,
    name TEXT,
    email TEXT,
    role TEXT,
    roles JSONB,
    is_owner BOOLEAN,
    is_admin BOOLEAN,
    last_sign_in_at TIMESTAMPTZ,
    is_member BOOLEAN,
    has_grant BOOLEAN
) AS $$
BEGIN
    IF NOT is_platform_admin() THEN
        RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT m.id,
           m.user_id,
           COALESCE(NULLIF(trim(COALESCE(m.full_name, '')), ''), NULLIF(trim(concat_ws(' ', m.first_name, m.last_name)), ''), u.email)::TEXT,
           COALESCE(u.email, m.email)::TEXT,
           m.role::TEXT,
           COALESCE(m.roles, '[]'::jsonb),
           (m.user_id = c.owner_id),
           (m.user_id = c.owner_id OR member_is_admin(m.role, m.roles) OR g.user_id IS NOT NULL),
           u.last_sign_in_at,
           TRUE,
           (g.user_id IS NOT NULL)
      FROM club_members m
      JOIN clubs c ON c.id = m.club_id
      LEFT JOIN auth.users u ON u.id = m.user_id
      LEFT JOIN club_admin_grants g ON g.club_id = m.club_id AND g.user_id = m.user_id
     WHERE m.club_id = p_club_id
       AND m.user_id IS NOT NULL
       AND COALESCE(m.membership_status, 'approved') = 'approved'
       AND (
           m.user_id = c.owner_id
           OR member_is_admin(m.role, m.roles)
           OR g.user_id IS NOT NULL
           OR EXISTS (SELECT 1 FROM club_access_roles r
                       WHERE r.club_id = m.club_id AND lower(r.name) = ANY (member_labels(m.role, m.roles)))
       )
    UNION ALL
    -- An Owner with no member row at their own club
    SELECT NULL::UUID, c.owner_id, COALESCE(u.raw_user_meta_data->>'full_name', u.email)::TEXT, u.email::TEXT,
           'owner'::TEXT, '[]'::jsonb, TRUE, TRUE, u.last_sign_in_at, FALSE, FALSE
      FROM clubs c
      JOIN auth.users u ON u.id = c.owner_id
     WHERE c.id = p_club_id
       AND NOT EXISTS (SELECT 1 FROM club_members m WHERE m.club_id = c.id AND m.user_id = c.owner_id)
    UNION ALL
    -- Club Admins with no member row
    SELECT NULL::UUID, g.user_id, COALESCE(NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''), u.email)::TEXT, u.email::TEXT,
           'Club Admin'::TEXT, '[]'::jsonb, FALSE, TRUE, u.last_sign_in_at, FALSE, TRUE
      FROM club_admin_grants g
      JOIN clubs c ON c.id = g.club_id
      JOIN auth.users u ON u.id = g.user_id
     WHERE g.club_id = p_club_id
       AND g.user_id IS DISTINCT FROM c.owner_id
       AND NOT EXISTS (SELECT 1 FROM club_members m WHERE m.club_id = g.club_id AND m.user_id = g.user_id);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION get_platform_club_people(UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 10. "Make owner": as 20261145, but a non-member admin can be picked too, and the old Owner
--     keeps admin access (the Mission Control popup always said they "stay on as an admin")
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION platform_transfer_club_owner(p_club_id UUID, p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_old UUID;
BEGIN
    IF NOT is_platform_operator() THEN
        RAISE EXCEPTION 'Analysts can view clubs but not change them.' USING ERRCODE = '42501';
    END IF;
    IF EXISTS (SELECT 1 FROM clubs WHERE id = p_club_id AND owner_id = p_user_id) THEN
        RAISE EXCEPTION 'They already own this club.' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM club_members m
         WHERE m.club_id = p_club_id AND m.user_id = p_user_id
           AND COALESCE(m.membership_status, 'approved') = 'approved'
           AND COALESCE(m.status, 'active') <> 'suspended'
    ) AND NOT EXISTS (SELECT 1 FROM club_admin_grants g WHERE g.club_id = p_club_id AND g.user_id = p_user_id) THEN
        RAISE EXCEPTION 'Pick someone who is an approved member or admin of the club with an account.' USING ERRCODE = '22023';
    END IF;

    SELECT owner_id INTO v_old FROM clubs WHERE id = p_club_id;
    UPDATE clubs SET owner_id = p_user_id, updated_at = NOW() WHERE id = p_club_id;
    DELETE FROM club_admin_grants WHERE club_id = p_club_id AND user_id = p_user_id;
    IF v_old IS NOT NULL AND NOT is_member_admin_of(p_club_id, v_old) THEN
        INSERT INTO club_admin_grants (club_id, user_id, note)
        VALUES (p_club_id, v_old, 'Owner until ' || to_char(NOW() AT TIME ZONE 'Australia/Sydney', 'FMDD Mon YYYY'))
        ON CONFLICT (club_id, user_id) DO NOTHING;
    END IF;
    -- Only one Owner: waiting Owner invites for this club no longer apply
    UPDATE club_admin_invites SET cancelled_at = NOW()
     WHERE club_id = p_club_id AND role = 'owner' AND accepted_at IS NULL AND cancelled_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION platform_transfer_club_owner(UUID, UUID) TO authenticated;
