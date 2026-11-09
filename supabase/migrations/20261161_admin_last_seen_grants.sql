-- ==============================================================================
-- Migration: Mission Control's "Admin last seen" counts admins who aren't members
-- Date: 2026-11-09
--
-- get_platform_clubs().admin_last_seen_at looked at the Owner and member admins only, so a club
-- run by someone invited as Club Admin without a membership (club_admin_grants, 20261160) looked
-- quiet in Mission Control even when they signed in every day. Now their sign-ins count too.
-- Same function as 20261148 otherwise: same columns, same checks. Run after 20261160. Safe to run again.
-- ==============================================================================

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
    stripe_ready BOOLEAN,
    approved_count BIGINT,
    oldest_pending_at TIMESTAMPTZ,
    admin_last_seen_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ
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
        (SELECT max(au.last_sign_in_at) FROM auth.users au
          WHERE au.id = fc.owner_id
             OR au.id IN (SELECT m.user_id FROM club_members m
                           WHERE m.club_id = fc.id AND m.user_id IS NOT NULL AND member_is_admin(m.role, m.roles))
             -- Club Admins who aren't members (club_admin_grants, migration 20261160)
             OR au.id IN (SELECT g.user_id FROM club_admin_grants g WHERE g.club_id = fc.id)),
        fc.closed_at
      FROM filtered_clubs fc
      LEFT JOIN auth.users u ON u.id = fc.owner_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION get_platform_clubs(TEXT, INTEGER, INTEGER) TO authenticated;
