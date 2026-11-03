-- ==============================================================================
-- Migration: Mission Control phase 1 (fix things for a club from the platform console)
--
--   1. keep_club_owner(): platform Operators and Super admins may hand a club to a new Owner
--      (the account-deletion flow sends owners to support for exactly this).
--   2. get_platform_clubs(): adds the setup signals the Today queue and the club console use.
--   3. get_platform_club_people(): who runs a club (Owner, Club Admins, access-role holders).
--   4. platform_transfer_club_owner() and platform_set_club_admin().
--   5. platform_club_notes: private notes and a record of emails sent from Mission Control.
--   6. platform_snoozes: Today items put off until a date (or for good, when done).
--   7. get_platform_audit(): the platform's own action log, and one club's history.
--
-- Every change goes through SECURITY DEFINER functions called by the signed-in admin, so the
-- admin_audit_log triggers (20261129) record who did it. Run after 20261144. Safe to run again.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Owner changes: the Owner, the service role, or a platform Operator / Super admin
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION keep_club_owner()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id
       AND auth.uid() IS NOT NULL
       AND OLD.owner_id IS DISTINCT FROM auth.uid()
       AND NOT is_platform_operator() THEN
        NEW.owner_id := OLD.owner_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ------------------------------------------------------------------------------
-- 2. get_platform_clubs with setup signals (the return type changes, so drop first)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS get_platform_clubs(TEXT, INTEGER, INTEGER);
CREATE FUNCTION get_platform_clubs(
    p_search TEXT DEFAULT '',
    p_limit INTEGER DEFAULT 100,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    short_name TEXT,
    slug TEXT,
    logo_url TEXT,
    banner_url TEXT,
    primary_color TEXT,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ,
    owner_id UUID,
    owner_email TEXT,
    owner_name TEXT,
    custom_domain TEXT,
    membership_payment_policy TEXT,
    member_count BIGINT,
    pending_count BIGINT,
    team_count BIGINT,
    match_count BIGINT,
    visits_30d BIGINT,
    gmv_cents BIGINT,
    stripe_ready BOOLEAN,
    approved_count BIGINT,
    oldest_pending_at TIMESTAMPTZ,
    admin_last_seen_at TIMESTAMPTZ
) AS $$
BEGIN
    IF NOT is_platform_admin() THEN
        RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    WITH filtered_clubs AS (
        SELECT c.*
          FROM clubs c
         WHERE (
             p_search IS NULL OR p_search = ''
             OR c.name ILIKE ('%' || p_search || '%')
             OR c.slug ILIKE ('%' || p_search || '%')
             OR c.short_name ILIKE ('%' || p_search || '%')
             OR EXISTS (
                 SELECT 1 FROM auth.users u
                  WHERE u.id = c.owner_id
                    AND (u.email ILIKE ('%' || p_search || '%') OR u.raw_user_meta_data->>'full_name' ILIKE ('%' || p_search || '%'))
             )
         )
         ORDER BY c.created_at DESC
         LIMIT p_limit OFFSET p_offset
    )
    SELECT
        fc.id,
        fc.name::TEXT,
        fc.short_name::TEXT,
        fc.slug::TEXT,
        fc.logo_url::TEXT,
        fc.banner_url::TEXT,
        fc.primary_color::TEXT,
        fc.is_active,
        fc.created_at,
        fc.owner_id,
        u.email::TEXT AS owner_email,
        (u.raw_user_meta_data->>'full_name')::TEXT AS owner_name,
        fc.custom_domain::TEXT,
        COALESCE(fc.membership_payment_policy, 'require_payment')::TEXT,
        (SELECT count(*) FROM club_members m WHERE m.club_id = fc.id),
        (SELECT count(*) FROM club_members m WHERE m.club_id = fc.id AND m.membership_status = 'pending'),
        (SELECT count(*) FROM club_teams t WHERE t.club_id = fc.id),
        (SELECT count(*) FROM matches mat WHERE mat.club_id = fc.id),
        (SELECT count(*) FROM club_analytics ca WHERE ca.club_id = fc.id AND ca.created_at >= NOW() - INTERVAL '30 days'),
        COALESCE((SELECT sum(p.amount_cents) FROM payments p WHERE p.club_id = fc.id AND p.status = 'paid'), 0)::BIGINT,
        EXISTS (SELECT 1 FROM club_payment_settings s WHERE s.club_id = fc.id AND s.stripe_account_id IS NOT NULL),
        (SELECT count(*) FROM club_members m WHERE m.club_id = fc.id AND COALESCE(m.membership_status, 'approved') = 'approved'),
        (SELECT min(m.created_at) FROM club_members m WHERE m.club_id = fc.id AND m.membership_status = 'pending'),
        -- Last sign-in of the Owner or any Club Admin
        (SELECT max(au.last_sign_in_at) FROM auth.users au
          WHERE au.id = fc.owner_id
             OR au.id IN (SELECT m.user_id FROM club_members m
                           WHERE m.club_id = fc.id AND m.user_id IS NOT NULL AND member_is_admin(m.role, m.roles)))
      FROM filtered_clubs fc
      LEFT JOIN auth.users u ON u.id = fc.owner_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION get_platform_clubs(TEXT, INTEGER, INTEGER) TO authenticated;

-- ------------------------------------------------------------------------------
-- 3. Who runs a club: the Owner, Club Admins and anyone holding one of its access roles
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_platform_club_people(p_club_id UUID)
RETURNS TABLE (
    member_id UUID,
    user_id UUID,
    name TEXT,
    email TEXT,
    role TEXT,
    roles JSONB,
    is_owner BOOLEAN,
    is_admin BOOLEAN,
    last_sign_in_at TIMESTAMPTZ
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
           (m.user_id = c.owner_id OR member_is_admin(m.role, m.roles)),
           u.last_sign_in_at
      FROM club_members m
      JOIN clubs c ON c.id = m.club_id
      LEFT JOIN auth.users u ON u.id = m.user_id
     WHERE m.club_id = p_club_id
       AND m.user_id IS NOT NULL
       AND COALESCE(m.membership_status, 'approved') = 'approved'
       AND (
           m.user_id = c.owner_id
           OR member_is_admin(m.role, m.roles)
           OR EXISTS (SELECT 1 FROM club_access_roles r
                       WHERE r.club_id = m.club_id AND lower(r.name) = ANY (member_labels(m.role, m.roles)))
       )
    UNION ALL
    -- An Owner with no member row at their own club
    SELECT NULL::UUID, c.owner_id, COALESCE(u.raw_user_meta_data->>'full_name', u.email)::TEXT, u.email::TEXT,
           'owner'::TEXT, '[]'::jsonb, TRUE, TRUE, u.last_sign_in_at
      FROM clubs c
      JOIN auth.users u ON u.id = c.owner_id
     WHERE c.id = p_club_id
       AND NOT EXISTS (SELECT 1 FROM club_members m WHERE m.club_id = c.id AND m.user_id = c.owner_id);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION get_platform_club_people(UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 4a. Hand the club to another approved member who has an account
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION platform_transfer_club_owner(p_club_id UUID, p_user_id UUID)
RETURNS VOID AS $$
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
    ) THEN
        RAISE EXCEPTION 'Pick someone who is an approved member of the club with an account.' USING ERRCODE = '22023';
    END IF;

    UPDATE clubs SET owner_id = p_user_id, updated_at = NOW() WHERE id = p_club_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION platform_transfer_club_owner(UUID, UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 4b. Give or take away the Club Admin label, by the person's email at that club
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION platform_set_club_admin(p_club_id UUID, p_email TEXT, p_on BOOLEAN)
RETURNS VOID AS $$
DECLARE
    v_member club_members;
    v_owner UUID;
BEGIN
    IF NOT is_platform_operator() THEN
        RAISE EXCEPTION 'Analysts can view clubs but not change them.' USING ERRCODE = '42501';
    END IF;

    SELECT m.* INTO v_member
      FROM club_members m
      LEFT JOIN auth.users u ON u.id = m.user_id
     WHERE m.club_id = p_club_id
       AND (lower(u.email) = lower(trim(p_email)) OR lower(m.email) = lower(trim(p_email)))
     ORDER BY (m.user_id IS NOT NULL) DESC, (COALESCE(m.membership_status, 'approved') = 'approved') DESC
     LIMIT 1;
    IF v_member.id IS NULL THEN
        RAISE EXCEPTION 'Nobody with that email is in this club yet. Ask them to join first.' USING ERRCODE = '22023';
    END IF;

    IF p_on THEN
        IF v_member.user_id IS NULL THEN
            RAISE EXCEPTION 'They need to sign up with that email before they can be an admin.' USING ERRCODE = '22023';
        END IF;
        IF COALESCE(v_member.membership_status, 'approved') <> 'approved' THEN
            RAISE EXCEPTION 'Their membership isn''t approved yet. Approve it first.' USING ERRCODE = '22023';
        END IF;
        IF NOT member_is_admin(v_member.role, v_member.roles) THEN
            UPDATE club_members
               SET roles = (CASE WHEN jsonb_typeof(roles) = 'array' THEN roles ELSE '[]'::jsonb END) || '["Club Admin"]'::jsonb
             WHERE id = v_member.id;
        END IF;
        RETURN;
    END IF;

    SELECT owner_id INTO v_owner FROM clubs WHERE id = p_club_id;
    IF v_member.user_id IS NOT DISTINCT FROM v_owner THEN
        RAISE EXCEPTION 'That''s the Owner. Transfer ownership first.' USING ERRCODE = '22023';
    END IF;

    UPDATE club_members
       SET roles = COALESCE((
               SELECT jsonb_agg(r) FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(roles) = 'array' THEN roles ELSE '[]'::jsonb END) r
                WHERE lower(trim(r)) NOT IN ('owner', 'admin', 'club admin')
           ), '[]'::jsonb),
           role = CASE WHEN lower(trim(COALESCE(role, ''))) IN ('owner', 'admin', 'club admin') THEN 'member' ELSE role END
     WHERE id = v_member.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION platform_set_club_admin(UUID, TEXT, BOOLEAN) TO authenticated;

-- ------------------------------------------------------------------------------
-- 5. Private notes about a club (and emails sent to it from Mission Control)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_club_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    kind TEXT NOT NULL DEFAULT 'note' CHECK (kind IN ('note', 'email')),
    body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
    author_id UUID DEFAULT auth.uid(),
    author_email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_platform_club_notes ON platform_club_notes (club_id, created_at DESC);
ALTER TABLE platform_club_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins read club notes" ON platform_club_notes;
DROP POLICY IF EXISTS "Platform operators add club notes" ON platform_club_notes;
DROP POLICY IF EXISTS "Platform operators delete club notes" ON platform_club_notes;
CREATE POLICY "Platform admins read club notes" ON platform_club_notes FOR SELECT USING (is_platform_admin());
CREATE POLICY "Platform operators add club notes" ON platform_club_notes FOR INSERT
    WITH CHECK (is_platform_operator() AND author_id = auth.uid());
CREATE POLICY "Platform operators delete club notes" ON platform_club_notes FOR DELETE USING (is_platform_operator());

-- ------------------------------------------------------------------------------
-- 6. Today items snoozed until a date ('stalled:<club id>' etc.); done = snoozed far ahead
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_snoozes (
    key TEXT PRIMARY KEY CHECK (char_length(key) <= 120),
    until TIMESTAMPTZ NOT NULL,
    created_by UUID DEFAULT auth.uid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE platform_snoozes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins read snoozes" ON platform_snoozes;
DROP POLICY IF EXISTS "Platform operators manage snoozes" ON platform_snoozes;
CREATE POLICY "Platform admins read snoozes" ON platform_snoozes FOR SELECT USING (is_platform_admin());
CREATE POLICY "Platform operators manage snoozes" ON platform_snoozes FOR ALL
    USING (is_platform_operator()) WITH CHECK (is_platform_operator());

-- ------------------------------------------------------------------------------
-- 7. The audit log for Mission Control: one club's history, or (no club) every platform
--    action plus everything this admin did in any club
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_audit_actor_time ON admin_audit_log (actor_id, created_at DESC);

CREATE OR REPLACE FUNCTION get_platform_audit(p_club_id UUID DEFAULT NULL, p_limit INTEGER DEFAULT 100)
RETURNS TABLE (
    id UUID,
    club_id UUID,
    club_name TEXT,
    club_slug TEXT,
    actor_email TEXT,
    action TEXT,
    summary TEXT,
    details JSONB,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    IF NOT is_platform_admin() THEN
        RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT a.id, a.club_id, c.name::TEXT, c.slug::TEXT, a.actor_email, a.action, a.summary, a.details, a.created_at
      FROM admin_audit_log a
      LEFT JOIN clubs c ON c.id = a.club_id
     WHERE CASE WHEN p_club_id IS NOT NULL THEN a.club_id = p_club_id
                ELSE a.club_id IS NULL OR a.actor_id = auth.uid() END
     ORDER BY a.created_at DESC
     LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION get_platform_audit(UUID, INTEGER) TO authenticated;
