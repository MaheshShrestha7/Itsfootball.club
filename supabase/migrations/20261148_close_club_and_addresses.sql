-- ==============================================================================
-- Migration: closing clubs, club address changes, club export (Mission Control)
--
--   1. Closing a club: hidden at once (is_active = false, closed_at set), deleted for good 30 days
--      later by the hourly health job (purge_closed_clubs). Reopening before then undoes it.
--      Payments are kept for accounting: payments.club_id becomes ON DELETE SET NULL, and the
--      club's name is copied onto them (club_name) before the club goes.
--   2. Old addresses: whenever clubs.slug changes, the old one is added to previous_slugs (it used
--      to be done only by the browser, so a change made any other way left no redirect).
--      platform_set_club_slug() changes it from Mission Control.
--   3. platform_club_tables(): every table with a club_id, for the club export.
--   4. get_platform_clubs() gains closed_at.
--
-- Run after 20261147. Safe to run again.
-- ==============================================================================

ALTER TABLE clubs ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- ------------------------------------------------------------------------------
-- 1a. Payments outlive their club
-- ------------------------------------------------------------------------------
ALTER TABLE payments ADD COLUMN IF NOT EXISTS club_name TEXT;
ALTER TABLE payments ALTER COLUMN club_id DROP NOT NULL;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_club_id_fkey;
ALTER TABLE payments ADD CONSTRAINT payments_club_id_fkey FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE SET NULL;

-- ------------------------------------------------------------------------------
-- 1b. Close and reopen
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION platform_close_club(p_club_id UUID)
RETURNS TIMESTAMPTZ AS $$
DECLARE
    v_name TEXT;
BEGIN
    IF NOT is_platform_operator() THEN
        RAISE EXCEPTION 'Analysts can view clubs but not change them.' USING ERRCODE = '42501';
    END IF;
    UPDATE clubs SET is_active = FALSE, closed_at = NOW(), updated_at = NOW()
     WHERE id = p_club_id AND closed_at IS NULL
     RETURNING name INTO v_name;
    IF v_name IS NULL THEN
        RAISE EXCEPTION 'Club not found, or already closing.' USING ERRCODE = '22023';
    END IF;
    PERFORM write_audit(p_club_id, 'club_closed', 'clubs', p_club_id, 'Closed the club (deleted for good in 30 days)', '{}'::jsonb);
    RETURN NOW() + INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION platform_close_club(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION platform_reopen_club(p_club_id UUID)
RETURNS VOID AS $$
BEGIN
    IF NOT is_platform_operator() THEN
        RAISE EXCEPTION 'Analysts can view clubs but not change them.' USING ERRCODE = '42501';
    END IF;
    UPDATE clubs SET is_active = TRUE, closed_at = NULL, updated_at = NOW() WHERE id = p_club_id AND closed_at IS NOT NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'That club isn''t closing (or is already gone).' USING ERRCODE = '22023';
    END IF;
    PERFORM write_audit(p_club_id, 'club_reopened', 'clubs', p_club_id, 'Reopened the club (cancelled the closure)', '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION platform_reopen_club(UUID) TO authenticated;

-- Reactivating a suspended club also cancels a closure (same as 20261116, plus closed_at)
CREATE OR REPLACE FUNCTION toggle_platform_club_status(p_club_id UUID, p_is_active BOOLEAN)
RETURNS BOOLEAN AS $$
BEGIN
    IF NOT is_platform_operator() THEN
        RAISE EXCEPTION 'Analysts can view clubs but not suspend or reactivate them.' USING ERRCODE = '42501';
    END IF;

    UPDATE clubs
       SET is_active = p_is_active,
           closed_at = CASE WHEN p_is_active THEN NULL ELSE closed_at END,
           updated_at = NOW()
     WHERE id = p_club_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION toggle_platform_club_status(UUID, BOOLEAN) TO authenticated;

-- Deletes clubs closed more than 30 days ago (still inactive). Server only (the hourly health job).
-- Returns the deleted clubs' ids, names and custom domains (the job releases the domains, and logs
-- the ids and names so Mission Control can name the files they leave in storage).
CREATE OR REPLACE FUNCTION purge_closed_clubs()
RETURNS JSONB AS $$
DECLARE
    v_ids UUID[];
    v_out JSONB;
BEGIN
    SELECT array_agg(id) INTO v_ids FROM clubs
     WHERE closed_at IS NOT NULL AND closed_at < NOW() - INTERVAL '30 days' AND is_active = FALSE;
    IF v_ids IS NULL THEN RETURN '[]'::jsonb; END IF;

    -- Name the payments first (a separate statement: the delete below sets their club_id to NULL)
    UPDATE payments p SET club_name = c.name FROM clubs c
     WHERE c.id = ANY (v_ids) AND p.club_id = c.id AND p.club_name IS NULL;

    WITH gone AS (
        DELETE FROM clubs WHERE id = ANY (v_ids) RETURNING id, name, custom_domain
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'custom_domain', custom_domain)), '[]'::jsonb) INTO v_out FROM gone;
    RETURN v_out;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION purge_closed_clubs() FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 2. Old addresses keep working: remember the old slug on every change. Named trg_zz_ so it
--    runs after trg_keep_club_admin_fields / trg_keep_club_owner (BEFORE triggers fire by name).
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION remember_previous_slug()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.slug IS DISTINCT FROM OLD.slug AND OLD.slug IS NOT NULL THEN
        NEW.previous_slugs := (CASE WHEN jsonb_typeof(NEW.previous_slugs) = 'array' THEN NEW.previous_slugs ELSE '[]'::jsonb END)
            - lower(NEW.slug) - lower(OLD.slug) || to_jsonb(lower(OLD.slug));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_zz_previous_slugs ON clubs;
CREATE TRIGGER trg_zz_previous_slugs BEFORE UPDATE OF slug ON clubs
    FOR EACH ROW EXECUTE FUNCTION remember_previous_slug();

CREATE OR REPLACE FUNCTION platform_set_club_slug(p_club_id UUID, p_slug TEXT)
RETURNS TEXT AS $$
DECLARE
    v_slug TEXT := lower(trim(p_slug));
BEGIN
    IF NOT is_platform_operator() THEN
        RAISE EXCEPTION 'Analysts can view clubs but not change them.' USING ERRCODE = '42501';
    END IF;
    IF v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR char_length(v_slug) NOT BETWEEN 3 AND 48 THEN
        RAISE EXCEPTION 'Use 3 to 48 lowercase letters, numbers and single dashes.' USING ERRCODE = '22023';
    END IF;
    IF NOT club_slug_available(v_slug, p_club_id) THEN
        RAISE EXCEPTION 'Another club already uses that address (now or as an old one).' USING ERRCODE = '22023';
    END IF;
    UPDATE clubs SET slug = v_slug, updated_at = NOW() WHERE id = p_club_id;
    RETURN v_slug;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION platform_set_club_slug(UUID, TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 3. Tables that hold a club's data (have a club_id), for the export
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION platform_club_tables()
RETURNS SETOF TEXT AS $$
BEGIN
    IF NOT is_platform_admin() THEN
        RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
    END IF;
    RETURN QUERY
    SELECT c.table_name::TEXT
      FROM information_schema.columns c
      JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
     WHERE c.table_schema = 'public' AND c.column_name = 'club_id'
     ORDER BY 1;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION platform_club_tables() TO authenticated;

-- ------------------------------------------------------------------------------
-- 4. get_platform_clubs: same as 20261145, plus closed_at
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
                           WHERE m.club_id = fc.id AND m.user_id IS NOT NULL AND member_is_admin(m.role, m.roles))),
        fc.closed_at
      FROM filtered_clubs fc
      LEFT JOIN auth.users u ON u.id = fc.owner_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION get_platform_clubs(TEXT, INTEGER, INTEGER) TO authenticated;
