-- ==============================================================================
-- Migration: Platform Super-Admin Cockpit Expansion
-- Date: 2026-11-13
--
-- Features:
--   1. toggle_platform_club_status(): Super admin can suspend / reactivate clubs
--   2. get_platform_users(): Global cross-tenant user lookup & memberships
--   3. get_platform_health_stats(): Live system row counters and DB heartbeat
--   4. platform_announcements: Platform-wide alert & broadcast management
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TOGGLE CLUB ACTIVE/SUSPEND STATUS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION toggle_platform_club_status(p_club_id UUID, p_is_active BOOLEAN)
RETURNS BOOLEAN AS $$
BEGIN
    IF NOT is_platform_admin() THEN
        RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
    END IF;

    UPDATE clubs
       SET is_active = p_is_active,
           updated_at = NOW()
     WHERE id = p_club_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION toggle_platform_club_status(UUID, BOOLEAN) TO authenticated;

-- ------------------------------------------------------------------------------
-- 2. CROSS-TENANT USER LOOKUP
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_platform_users(
    p_search TEXT DEFAULT '',
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ,
    last_sign_in_at TIMESTAMPTZ,
    is_super_admin BOOLEAN,
    clubs_owned_count BIGINT,
    memberships_count BIGINT,
    memberships JSONB
) AS $$
BEGIN
    IF NOT is_platform_admin() THEN
        RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    WITH target_users AS (
        SELECT u.id,
               u.email::TEXT,
               (u.raw_user_meta_data->>'full_name')::TEXT AS full_name,
               (u.raw_user_meta_data->>'avatar_url')::TEXT AS avatar_url,
               u.created_at,
               u.last_sign_in_at
          FROM auth.users u
         WHERE (
             p_search IS NULL OR p_search = ''
             OR u.email ILIKE ('%' || p_search || '%')
             OR (u.raw_user_meta_data->>'full_name') ILIKE ('%' || p_search || '%')
         )
         ORDER BY u.created_at DESC
         LIMIT p_limit OFFSET p_offset
    )
    SELECT
        tu.id,
        tu.email,
        COALESCE(tu.full_name, 'Football Fan'),
        tu.avatar_url,
        tu.created_at,
        tu.last_sign_in_at,
        EXISTS (
            SELECT 1 FROM platform_admins pa
             WHERE (pa.user_id = tu.id OR lower(pa.email) = lower(tu.email))
               AND pa.is_active = TRUE
        ) AS is_super_admin,
        (SELECT count(*) FROM clubs c WHERE c.owner_id = tu.id),
        (SELECT count(*) FROM club_members m WHERE m.user_id = tu.id),
        COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'club_id', c.id,
                'club_name', c.name,
                'club_slug', c.slug,
                'role', m.role,
                'membership_status', m.membership_status,
                'membership_tier', m.membership_tier,
                'fee_waived', (m.fee_waived_at IS NOT NULL)
            ))
            FROM club_members m
            JOIN clubs c ON c.id = m.club_id
            WHERE m.user_id = tu.id
        ), '[]'::jsonb) AS memberships
      FROM target_users tu;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION get_platform_users(TEXT, INTEGER, INTEGER) TO authenticated;

-- ------------------------------------------------------------------------------
-- 3. SYSTEM HEALTH STATS & HEARTBEAT
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_platform_health_stats()
RETURNS JSONB AS $$
DECLARE
    v_clubs_count BIGINT;
    v_members_count BIGINT;
    v_payments_count BIGINT;
    v_matches_count BIGINT;
    v_events_count BIGINT;
    v_gate_scans_count BIGINT;
    v_analytics_count BIGINT;
BEGIN
    IF NOT is_platform_admin() THEN
        RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
    END IF;

    SELECT count(*) INTO v_clubs_count FROM clubs;
    SELECT count(*) INTO v_members_count FROM club_members;
    SELECT count(*) INTO v_payments_count FROM payments;
    SELECT count(*) INTO v_matches_count FROM matches;
    SELECT count(*) INTO v_events_count FROM events;
    SELECT count(*) INTO v_gate_scans_count FROM gate_scans;
    SELECT count(*) INTO v_analytics_count FROM platform_analytics;

    RETURN jsonb_build_object(
        'server_timestamp', NOW(),
        'counts', jsonb_build_object(
            'clubs', v_clubs_count,
            'members', v_members_count,
            'payments', v_payments_count,
            'matches', v_matches_count,
            'events', v_events_count,
            'gate_scans', v_gate_scans_count,
            'analytics', v_analytics_count
        ),
        'status', 'healthy'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION get_platform_health_stats() TO authenticated;

-- ------------------------------------------------------------------------------
-- 4. PLATFORM ANNOUNCEMENTS / BROADCASTS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warning', 'critical', 'success')),
    target TEXT NOT NULL DEFAULT 'all' CHECK (target IN ('all', 'admins', 'members', 'public')),
    link_url TEXT,
    link_text TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_platform_announcements_active ON platform_announcements(is_active, expires_at);

ALTER TABLE platform_announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active platform announcements" ON platform_announcements;
CREATE POLICY "Public read active platform announcements" ON platform_announcements FOR SELECT
    USING (
        (is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW()))
        OR is_platform_admin()
    );

DROP POLICY IF EXISTS "Super admins manage platform announcements" ON platform_announcements;
CREATE POLICY "Super admins manage platform announcements" ON platform_announcements FOR ALL
    USING (is_platform_admin())
    WITH CHECK (is_platform_admin());
