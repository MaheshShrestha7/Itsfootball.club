-- ==============================================================================
-- Migration: Platform Owner Dashboard & Global Metrics (itsfootball.club)
-- Date: 2026-11-12
--
-- Features:
--   1. platform_admins: Super-admin table for platform owners and operators
--   2. platform_analytics: Dedicated traffic table for itsfootball.club platform visits
--   3. is_platform_admin(): Security definer helper
--   4. get_platform_metrics(): Aggregated KPIs, growth curves, and signup funnels
--   5. get_platform_clubs(): Master club directory with health metrics
--   6. Admin management functions (add/remove platform admin)
--
-- Safe to run more than once.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PLATFORM ADMINS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'super_admin' CHECK (role IN ('super_admin', 'operator', 'analyst')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_admins_email ON platform_admins(lower(email));
CREATE INDEX IF NOT EXISTS idx_platform_admins_user_id ON platform_admins(user_id);

ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 2. SECURITY DEFINER HELPER: is_platform_admin()
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN AS $$
    SELECT auth.uid() IS NOT NULL AND EXISTS (
        SELECT 1 FROM platform_admins pa
         WHERE (pa.user_id = auth.uid() OR lower(pa.email) = lower(COALESCE(auth.jwt()->>'email', '')))
           AND pa.is_active = TRUE
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION is_platform_admin() TO authenticated, anon;

-- RLS policies for platform_admins
DROP POLICY IF EXISTS "Platform admins view platform_admins" ON platform_admins;
CREATE POLICY "Platform admins view platform_admins" ON platform_admins FOR SELECT
    USING (is_platform_admin());

DROP POLICY IF EXISTS "Platform admins manage platform_admins" ON platform_admins;
CREATE POLICY "Platform admins manage platform_admins" ON platform_admins FOR ALL
    USING (is_platform_admin())
    WITH CHECK (is_platform_admin());

-- ------------------------------------------------------------------------------
-- 3. BOOTSTRAP INITIAL ADMIN
-- ------------------------------------------------------------------------------
-- Automatically seed the owner of the oldest club on the platform as the initial super_admin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM platform_admins) THEN
        INSERT INTO platform_admins (user_id, email, full_name, role)
        SELECT
            c.owner_id,
            COALESCE(u.email, 'owner@itsfootball.club'),
            COALESCE(u.raw_user_meta_data->>'full_name', 'Platform Owner'),
            'super_admin'
          FROM clubs c
          LEFT JOIN auth.users u ON u.id = c.owner_id
         WHERE c.owner_id IS NOT NULL
         ORDER BY c.created_at ASC
         LIMIT 1
        ON CONFLICT (email) DO NOTHING;
    END IF;
END $$;

-- Fallback claim function: if platform_admins is completely empty, any authenticated user can claim initial setup
CREATE OR REPLACE FUNCTION claim_first_platform_admin()
RETURNS BOOLEAN AS $$
DECLARE
    v_user auth.users%ROWTYPE;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Must be signed in' USING ERRCODE = '42501';
    END IF;

    -- Only allowed if no platform admins exist yet
    IF EXISTS (SELECT 1 FROM platform_admins) THEN
        RAISE EXCEPTION 'Platform admin already initialized' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_user FROM auth.users WHERE id = auth.uid();
    IF v_user.id IS NULL THEN
        RAISE EXCEPTION 'User not found' USING ERRCODE = '42501';
    END IF;

    INSERT INTO platform_admins (user_id, email, full_name, role)
    VALUES (
        v_user.id,
        v_user.email,
        COALESCE(v_user.raw_user_meta_data->>'full_name', 'Platform Owner'),
        'super_admin'
    );

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION claim_first_platform_admin() TO authenticated;

-- Admin management functions
CREATE OR REPLACE FUNCTION add_platform_admin(p_email TEXT, p_full_name TEXT DEFAULT NULL, p_role TEXT DEFAULT 'super_admin')
RETURNS VOID AS $$
DECLARE
    v_user_id UUID;
BEGIN
    IF NOT is_platform_admin() THEN
        RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
    END IF;

    SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(trim(p_email));

    INSERT INTO platform_admins (user_id, email, full_name, role, is_active)
    VALUES (v_user_id, lower(trim(p_email)), p_full_name, p_role, TRUE)
    ON CONFLICT (email) DO UPDATE
       SET user_id = COALESCE(EXCLUDED.user_id, platform_admins.user_id),
           full_name = COALESCE(EXCLUDED.full_name, platform_admins.full_name),
           role = EXCLUDED.role,
           is_active = TRUE,
           updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION add_platform_admin(TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION remove_platform_admin(p_email TEXT)
RETURNS VOID AS $$
BEGIN
    IF NOT is_platform_admin() THEN
        RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
    END IF;

    -- Protect against deleting the last admin
    IF (SELECT count(*) FROM platform_admins WHERE is_active = TRUE) <= 1 THEN
        RAISE EXCEPTION 'Cannot remove the last platform admin' USING ERRCODE = '42501';
    END IF;

    UPDATE platform_admins
       SET is_active = FALSE,
           updated_at = NOW()
     WHERE lower(email) = lower(trim(p_email));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION remove_platform_admin(TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 4. PLATFORM-LEVEL ANALYTICS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(64) NOT NULL DEFAULT 'page_view',
    page_path VARCHAR(255),
    visitor_hash VARCHAR(64),
    referrer TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_analytics_created_at ON platform_analytics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_analytics_event_type ON platform_analytics(event_type);

ALTER TABLE platform_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public platform analytics insert" ON platform_analytics;
CREATE POLICY "Public platform analytics insert" ON platform_analytics FOR INSERT
    WITH CHECK (
        char_length(COALESCE(page_path, '')) <= 255
        AND char_length(COALESCE(event_type, '')) <= 64
    );

DROP POLICY IF EXISTS "Platform admin read platform analytics" ON platform_analytics;
CREATE POLICY "Platform admin read platform analytics" ON platform_analytics FOR SELECT
    USING (is_platform_admin());

-- ------------------------------------------------------------------------------
-- 5. RPC: get_platform_metrics(p_days)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_platform_metrics(p_days INTEGER DEFAULT 30)
RETURNS JSONB AS $$
DECLARE
    v_since TIMESTAMPTZ := NOW() - (GREATEST(1, LEAST(p_days, 365)) || ' days')::INTERVAL;
    v_total_clubs INTEGER;
    v_active_clubs INTEGER;
    v_new_clubs INTEGER;
    v_total_users INTEGER;
    v_new_users INTEGER;
    v_total_members INTEGER;
    v_members_pending INTEGER;
    v_members_approved INTEGER;
    v_members_rejected INTEGER;
    v_members_waived INTEGER;
    v_paid_signups_count INTEGER;
    v_paid_signups_cents BIGINT;
    v_total_gmv_cents BIGINT;
    v_period_gmv_cents BIGINT;
    v_club_visits_period BIGINT;
    v_platform_visits_period BIGINT;
    v_daily_trends JSONB;
    v_top_clubs JSONB;
    v_recent_activity JSONB;
    v_funnel JSONB;
BEGIN
    IF NOT is_platform_admin() THEN
        RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
    END IF;

    -- 1. High level counts
    SELECT count(*), count(*) FILTER (WHERE is_active = TRUE), count(*) FILTER (WHERE created_at >= v_since)
      INTO v_total_clubs, v_active_clubs, v_new_clubs
      FROM clubs;

    SELECT count(*), count(*) FILTER (WHERE created_at >= v_since)
      INTO v_total_users, v_new_users
      FROM auth.users;

    SELECT
        count(*),
        count(*) FILTER (WHERE membership_status = 'pending'),
        count(*) FILTER (WHERE COALESCE(membership_status, 'approved') = 'approved'),
        count(*) FILTER (WHERE membership_status = 'rejected'),
        count(*) FILTER (WHERE fee_waived_at IS NOT NULL)
      INTO v_total_members, v_members_pending, v_members_approved, v_members_rejected, v_members_waived
      FROM club_members;

    -- 2. Payments & GMV
    SELECT
        COALESCE(sum(amount_cents) FILTER (WHERE status = 'paid'), 0),
        COALESCE(sum(amount_cents) FILTER (WHERE status = 'paid' AND created_at >= v_since), 0),
        count(*) FILTER (WHERE kind = 'membership_signup' AND status = 'paid'),
        COALESCE(sum(amount_cents) FILTER (WHERE kind = 'membership_signup' AND status = 'paid'), 0)
      INTO v_total_gmv_cents, v_period_gmv_cents, v_paid_signups_count, v_paid_signups_cents
      FROM payments;

    -- 3. Visits
    SELECT COALESCE(count(*), 0)
      INTO v_club_visits_period
      FROM club_analytics
     WHERE created_at >= v_since;

    SELECT COALESCE(count(*), 0)
      INTO v_platform_visits_period
      FROM platform_analytics
     WHERE created_at >= v_since;

    -- 4. Daily trend series (grouped by day)
    WITH days AS (
        SELECT generate_series(
            date_trunc('day', v_since),
            date_trunc('day', NOW()),
            '1 day'::interval
        )::date AS day
    ), club_days AS (
        SELECT date_trunc('day', created_at)::date AS day, count(*) AS count
          FROM clubs
         WHERE created_at >= v_since
         GROUP BY 1
    ), user_days AS (
        SELECT date_trunc('day', created_at)::date AS day, count(*) AS count
          FROM auth.users
         WHERE created_at >= v_since
         GROUP BY 1
    ), member_days AS (
        SELECT date_trunc('day', created_at)::date AS day, count(*) AS count
          FROM club_members
         WHERE created_at >= v_since
         GROUP BY 1
    ), visit_days AS (
        SELECT date_trunc('day', created_at)::date AS day, count(*) AS count
          FROM (
              SELECT created_at FROM club_analytics WHERE created_at >= v_since
              UNION ALL
              SELECT created_at FROM platform_analytics WHERE created_at >= v_since
          ) all_v
         GROUP BY 1
    ), payment_days AS (
        SELECT date_trunc('day', created_at)::date AS day, sum(amount_cents) AS total_cents
          FROM payments
         WHERE status = 'paid' AND created_at >= v_since
         GROUP BY 1
    )
    SELECT jsonb_agg(jsonb_build_object(
        'date', to_char(d.day, 'YYYY-MM-DD'),
        'clubs', COALESCE(cd.count, 0),
        'users', COALESCE(ud.count, 0),
        'members', COALESCE(md.count, 0),
        'visits', COALESCE(vd.count, 0),
        'revenue_cents', COALESCE(pd.total_cents, 0)
    ) ORDER BY d.day ASC)
      INTO v_daily_trends
      FROM days d
      LEFT JOIN club_days cd ON cd.day = d.day
      LEFT JOIN user_days ud ON ud.day = d.day
      LEFT JOIN member_days md ON md.day = d.day
      LEFT JOIN visit_days vd ON vd.day = d.day
      LEFT JOIN payment_days pd ON pd.day = d.day;

    -- 5. Top clubs by member count & recent visits
    WITH club_stats AS (
        SELECT
            c.id,
            c.name,
            c.short_name,
            c.slug,
            c.logo_url,
            c.primary_color,
            c.is_active,
            count(DISTINCT m.id) AS member_count,
            count(DISTINCT t.id) AS team_count,
            (SELECT count(*) FROM club_analytics ca WHERE ca.club_id = c.id AND ca.created_at >= v_since) AS visits_count,
            COALESCE((SELECT sum(amount_cents) FROM payments p WHERE p.club_id = c.id AND p.status = 'paid'), 0) AS gmv_cents
          FROM clubs c
          LEFT JOIN club_members m ON m.club_id = c.id
          LEFT JOIN club_teams t ON t.club_id = c.id
         GROUP BY c.id
         ORDER BY visits_count DESC, member_count DESC
         LIMIT 8
    )
    SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'name', name,
        'short_name', short_name,
        'slug', slug,
        'logo_url', logo_url,
        'primary_color', primary_color,
        'is_active', is_active,
        'members', member_count,
        'teams', team_count,
        'visits', visits_count,
        'gmv_cents', gmv_cents
    ))
      INTO v_top_clubs
      FROM club_stats;

    -- 6. Signup payment funnel breakdown
    SELECT jsonb_build_object(
        'paid', (SELECT count(*) FROM payments WHERE kind = 'membership_signup' AND status = 'paid'),
        'awaiting_review', (SELECT count(*) FROM payments WHERE kind = 'membership_signup' AND status = 'awaiting_review'),
        'unpaid_pending', (SELECT count(*) FROM club_members m
                            WHERE m.membership_status = 'pending'
                              AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.member_id = m.id AND p.kind = 'membership_signup' AND p.status = 'paid')
                              AND m.fee_waived_at IS NULL),
        'fee_waived', v_members_waived,
        'direct_approved', v_members_approved
    ) INTO v_funnel;

    -- 7. Recent activity stream (latest 15 events across clubs, members, payments)
    WITH events AS (
        SELECT 'club_created' AS type, name AS title, slug AS subtitle, created_at FROM clubs
        UNION ALL
        SELECT 'member_signup' AS type, full_name AS title, COALESCE(membership_tier, 'Member') AS subtitle, created_at FROM club_members
        UNION ALL
        SELECT 'payment_received' AS type, ('$' || round(amount_cents / 100.0, 2)::text) AS title, kind AS subtitle, created_at FROM payments WHERE status = 'paid'
        UNION ALL
        SELECT 'gate_scan' AS type, member_name AS title, scan_type AS subtitle, scanned_at AS created_at FROM gate_scans WHERE valid = TRUE
    )
    SELECT jsonb_agg(jsonb_build_object(
        'type', type,
        'title', title,
        'subtitle', subtitle,
        'created_at', created_at
    ) ORDER BY created_at DESC)
      INTO v_recent_activity
      FROM (SELECT * FROM events ORDER BY created_at DESC LIMIT 15) rec;

    RETURN jsonb_build_object(
        'period_days', p_days,
        'total_clubs', v_total_clubs,
        'active_clubs', v_active_clubs,
        'new_clubs_period', v_new_clubs,
        'total_users', v_total_users,
        'new_users_period', v_new_users,
        'total_members', v_total_members,
        'members_pending', v_members_pending,
        'members_approved', v_members_approved,
        'members_rejected', v_members_rejected,
        'members_waived', v_members_waived,
        'paid_signups_count', v_paid_signups_count,
        'paid_signups_cents', v_paid_signups_cents,
        'total_gmv_cents', v_total_gmv_cents,
        'period_gmv_cents', v_period_gmv_cents,
        'total_visits_period', (v_club_visits_period + v_platform_visits_period),
        'club_visits_period', v_club_visits_period,
        'platform_visits_period', v_platform_visits_period,
        'daily_trends', COALESCE(v_daily_trends, '[]'::jsonb),
        'top_clubs', COALESCE(v_top_clubs, '[]'::jsonb),
        'funnel', v_funnel,
        'recent_activity', COALESCE(v_recent_activity, '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION get_platform_metrics(INTEGER) TO authenticated;

-- ------------------------------------------------------------------------------
-- 6. RPC: get_platform_clubs(p_search, p_limit, p_offset)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_platform_clubs(
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
    stripe_ready BOOLEAN
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
        COALESCE((SELECT sum(p.amount_cents) FROM payments p WHERE p.club_id = fc.id AND p.status = 'paid'), 0),
        EXISTS (SELECT 1 FROM club_payment_settings s WHERE s.club_id = fc.id AND s.stripe_account_id IS NOT NULL)
      FROM filtered_clubs fc
      LEFT JOIN auth.users u ON u.id = fc.owner_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION get_platform_clubs(TEXT, INTEGER, INTEGER) TO authenticated;
