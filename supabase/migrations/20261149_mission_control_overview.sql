-- ==============================================================================
-- Migration: Mission Control Overview (the platform at a glance)
--
--   1. payments.booking_fee_cents / booking_fee_refunded_at: the platform's own booking fee on a
--      card payment, saved at checkout from now on (older payments stay NULL: not tracked).
--   2. platform_events gains kind 'error': a page crashed for a visitor (app/error.tsx).
--   3. get_platform_overview(p_days): money, growth, feature usage, public site traffic and
--      problems for the Overview screen, in one call.
--   4. get_platform_club_members(p_club_id): one club's members for the drill-down, without
--      medical notes, emergency contacts, guardian phone numbers, safeguarding checks or dates
--      of birth. Every call is written to the action log.
--
-- Read-only for everything except the action log line. Platform admins only.
-- Run after 20261148. Safe to run again.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. The booking fee on each card payment
-- ------------------------------------------------------------------------------
ALTER TABLE payments ADD COLUMN IF NOT EXISTS booking_fee_cents INTEGER CHECK (booking_fee_cents IS NULL OR booking_fee_cents >= 0);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS booking_fee_refunded_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_payments_fee ON payments (created_at) WHERE booking_fee_cents IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 2. Page crashes in platform_events
-- ------------------------------------------------------------------------------
ALTER TABLE platform_events DROP CONSTRAINT IF EXISTS platform_events_kind_check;
ALTER TABLE platform_events ADD CONSTRAINT platform_events_kind_check
    CHECK (kind IN ('cron', 'email', 'stripe', 'alert', 'error'));

CREATE INDEX IF NOT EXISTS idx_platform_analytics_type_time ON platform_analytics (event_type, created_at DESC);

-- ------------------------------------------------------------------------------
-- 3. The Overview numbers
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_platform_overview(p_days INTEGER DEFAULT 30)
RETURNS JSONB AS $$
DECLARE
    v_days INTEGER := LEAST(GREATEST(COALESCE(p_days, 30), 1), 365);
    v_since TIMESTAMPTZ;
    v_prev TIMESTAMPTZ;
    v_money JSONB;
    v_growth JSONB;
    v_usage JSONB;
    v_traffic JSONB;
    v_problems JSONB;
BEGIN
    IF NOT is_platform_admin() THEN
        RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
    END IF;
    v_since := date_trunc('day', NOW()) - make_interval(days => v_days - 1);
    v_prev := v_since - make_interval(days => v_days);

    -- Money. "When" is the day it was paid (created_at for rows from before paid_at existed).
    WITH p AS (
        SELECT pay.*, COALESCE(pay.paid_at, pay.created_at) AS at FROM payments pay
    ), fee_clubs AS (
        SELECT c.id, c.name, c.slug, c.logo_url, c.primary_color,
               SUM(p.booking_fee_cents) FILTER (WHERE p.booking_fee_refunded_at IS NULL) AS fee_cents,
               SUM(p.amount_cents) AS through_cents
          FROM p JOIN clubs c ON c.id = p.club_id
         WHERE p.status = 'paid' AND p.at >= v_since AND p.booking_fee_cents IS NOT NULL
         GROUP BY c.id
    ), days AS (
        SELECT generate_series(v_since::date, NOW()::date, '1 day')::date AS day
    ), day_sums AS (
        SELECT p.at::date AS day,
               SUM(p.amount_cents) AS through_cents,
               SUM(p.booking_fee_cents) FILTER (WHERE p.booking_fee_refunded_at IS NULL) AS fee_cents
          FROM p WHERE p.status = 'paid' AND p.at >= v_since GROUP BY 1
    )
    SELECT jsonb_build_object(
        'fees_since', (SELECT MIN(created_at) FROM payments WHERE booking_fee_cents IS NOT NULL),
        'earned_cents', COALESCE((SELECT SUM(booking_fee_cents) FROM p WHERE status = 'paid' AND at >= v_since AND booking_fee_refunded_at IS NULL), 0),
        'earned_all_cents', COALESCE((SELECT SUM(booking_fee_cents) FROM p WHERE status = 'paid' AND booking_fee_refunded_at IS NULL), 0),
        'fee_refunded_cents', COALESCE((SELECT SUM(booking_fee_cents) FROM p WHERE booking_fee_refunded_at >= v_since), 0),
        'through_cents', COALESCE((SELECT SUM(amount_cents) FROM p WHERE status = 'paid' AND at >= v_since), 0),
        'through_prev_cents', COALESCE((SELECT SUM(amount_cents) FROM p WHERE status = 'paid' AND at >= v_prev AND at < v_since), 0),
        'by_method', COALESCE((SELECT jsonb_object_agg(method, cents) FROM (
            SELECT method, SUM(amount_cents) AS cents FROM p WHERE status = 'paid' AND at >= v_since GROUP BY method) m), '{}'::jsonb),
        'by_kind', COALESCE((SELECT jsonb_object_agg(kind, cents) FROM (
            SELECT kind, SUM(amount_cents) AS cents FROM p WHERE status = 'paid' AND at >= v_since GROUP BY kind) k), '{}'::jsonb),
        'awaiting_review', (SELECT jsonb_build_object('count', COUNT(*), 'cents', COALESCE(SUM(amount_cents), 0)) FROM p WHERE status = 'awaiting_review'),
        'pending', (SELECT jsonb_build_object('count', COUNT(*), 'cents', COALESCE(SUM(amount_cents), 0)) FROM p WHERE status = 'pending' AND created_at >= v_since),
        'failed', (SELECT COUNT(*) FROM p WHERE status = 'failed' AND created_at >= v_since),
        'refunded', (SELECT COUNT(*) FROM p WHERE status = 'refunded' AND created_at >= v_since),
        'top_fee_clubs', COALESCE((SELECT jsonb_agg(to_jsonb(f) ORDER BY f.fee_cents DESC NULLS LAST) FROM (
            SELECT * FROM fee_clubs ORDER BY fee_cents DESC NULLS LAST LIMIT 10) f), '[]'::jsonb),
        'daily', COALESCE((SELECT jsonb_agg(jsonb_build_object('date', d.day, 'through_cents', COALESCE(s.through_cents, 0), 'fee_cents', COALESCE(s.fee_cents, 0)) ORDER BY d.day)
            FROM days d LEFT JOIN day_sums s ON s.day = d.day), '[]'::jsonb)
    ) INTO v_money;

    -- Growth (the setup funnel and quiet clubs come from get_platform_clubs on the page)
    SELECT jsonb_build_object(
        'new_clubs', (SELECT COUNT(*) FROM clubs WHERE created_at >= v_since),
        'new_clubs_prev', (SELECT COUNT(*) FROM clubs WHERE created_at >= v_prev AND created_at < v_since),
        'new_members', (SELECT COUNT(*) FROM club_members WHERE COALESCE(applied_at, created_at) >= v_since),
        'new_members_prev', (SELECT COUNT(*) FROM club_members WHERE COALESCE(applied_at, created_at) >= v_prev AND COALESCE(applied_at, created_at) < v_since),
        'renew_30d', (SELECT COUNT(*) FROM club_members WHERE COALESCE(membership_status, 'approved') = 'approved'
                        AND membership_expires_at BETWEEN CURRENT_DATE AND CURRENT_DATE + 30),
        'lapsed_30d', (SELECT COUNT(*) FROM club_members WHERE COALESCE(membership_status, 'approved') = 'approved'
                        AND membership_expires_at >= CURRENT_DATE - 30 AND membership_expires_at < CURRENT_DATE),
        'closing', (SELECT COUNT(*) FROM clubs WHERE closed_at IS NOT NULL),
        'top_growing', COALESCE((SELECT jsonb_agg(to_jsonb(g) ORDER BY g.joined DESC) FROM (
            SELECT c.id, c.name, c.slug, c.logo_url, c.primary_color, COUNT(*) AS joined
              FROM club_members m JOIN clubs c ON c.id = m.club_id
             WHERE COALESCE(m.applied_at, m.created_at) >= v_since
             GROUP BY c.id ORDER BY COUNT(*) DESC LIMIT 10) g), '[]'::jsonb)
    ) INTO v_growth;

    -- Feature usage: which clubs used what in the period
    WITH used AS (
        SELECT 'fixtures' AS f, club_id FROM matches WHERE match_date >= v_since AND match_date <= NOW() + INTERVAL '30 days'
        UNION SELECT 'match_centre', club_id FROM match_events WHERE created_at >= v_since
        UNION SELECT 'availability', club_id FROM player_availabilities WHERE created_at >= v_since
        UNION SELECT 'lineups', club_id FROM draft_lineups WHERE created_at >= v_since
        UNION SELECT 'events', club_id FROM events WHERE created_at >= v_since
        UNION SELECT 'events', club_id FROM event_attendees WHERE created_at >= v_since
        UNION SELECT 'gate', club_id FROM gate_scans WHERE scanned_at >= v_since
        UNION SELECT 'sponsors', club_id FROM sponsors WHERE COALESCE(is_active, TRUE) AND package_status IN ('confirmed', 'paid')
        UNION SELECT 'tournaments', club_id FROM tournaments WHERE created_at >= v_since
        UNION SELECT 'news', club_id FROM news_articles WHERE created_at >= v_since
        UNION SELECT 'gallery', club_id FROM media_gallery WHERE created_at >= v_since
        UNION SELECT 'shop', club_id FROM shop_products WHERE created_at >= v_since
        UNION SELECT 'perks', club_id FROM perk_redemptions WHERE created_at >= v_since
        UNION SELECT 'finances', club_id FROM expenses WHERE created_at >= v_since
        UNION SELECT 'messages', club_id FROM member_messages WHERE created_at >= v_since
        UNION SELECT 'push', club_id FROM push_subscriptions WHERE created_at >= v_since
    ), live AS (
        SELECT u.f, u.club_id FROM used u JOIN clubs c ON c.id = u.club_id WHERE c.is_active AND c.closed_at IS NULL
    )
    SELECT jsonb_build_object(
        'clubs', (SELECT COUNT(*) FROM clubs WHERE is_active AND closed_at IS NULL),
        'features', COALESCE((SELECT jsonb_object_agg(f, n) FROM (SELECT f, COUNT(DISTINCT club_id) AS n FROM live GROUP BY f) x), '{}'::jsonb),
        'by_club', COALESCE((SELECT jsonb_object_agg(club_id, fs) FROM (SELECT club_id, jsonb_agg(DISTINCT f) AS fs FROM live GROUP BY club_id) y), '{}'::jsonb)
    ) INTO v_usage;

    -- Public site traffic (platform_analytics: page_view and tool_use)
    WITH a AS (
        SELECT * FROM platform_analytics WHERE created_at >= v_since
    ), v AS (
        SELECT * FROM a WHERE event_type = 'page_view'
    ), days AS (
        SELECT generate_series(v_since::date, NOW()::date, '1 day')::date AS day
    ), day_sums AS (
        SELECT created_at::date AS day, COUNT(*) AS visits FROM v GROUP BY 1
    ), src AS (
        SELECT CASE
            WHEN COALESCE(referrer, '') = '' THEN 'direct'
            WHEN referrer ~* '^https?://([a-z0-9-]+\.)*itsfootball\.club' THEN 'internal'
            WHEN referrer ~* '^https?://([a-z0-9-]+\.)*(google|bing|duckduckgo|yahoo|ecosia|baidu|yandex)\.' THEN 'search'
            WHEN referrer ~* '^https?://([a-z0-9-]+\.)*(chatgpt\.com|openai\.com|perplexity\.ai|claude\.ai|gemini\.google\.com|copilot\.microsoft\.com)' THEN 'ai'
            WHEN referrer ~* '^https?://([a-z0-9-]+\.)*(facebook|fb|instagram|tiktok|twitter|x|t|reddit|linkedin|youtube|whatsapp|threads)\.(com|co|net)' THEN 'social'
            ELSE 'other' END AS source
          FROM v
    )
    SELECT jsonb_build_object(
        'since', (SELECT MIN(created_at) FROM platform_analytics WHERE page_path IS DISTINCT FROM '/'),
        'visits', (SELECT COUNT(*) FROM v),
        'visitors', (SELECT COUNT(DISTINCT visitor_hash) FROM v WHERE COALESCE(visitor_hash, 'anon') <> 'anon'),
        'tool_uses', (SELECT COUNT(*) FROM a WHERE event_type = 'tool_use'),
        'create_club_visits', (SELECT COUNT(*) FROM v WHERE page_path LIKE '/create-club%'),
        'top_pages', COALESCE((SELECT jsonb_agg(jsonb_build_object('path', page_path, 'visits', n) ORDER BY n DESC) FROM (
            SELECT page_path, COUNT(*) AS n FROM v GROUP BY page_path ORDER BY COUNT(*) DESC LIMIT 12) t), '[]'::jsonb),
        'top_tools', COALESCE((SELECT jsonb_agg(jsonb_build_object('path', page_path, 'uses', n) ORDER BY n DESC) FROM (
            SELECT page_path, COUNT(*) AS n FROM a WHERE event_type = 'tool_use' GROUP BY page_path ORDER BY COUNT(*) DESC LIMIT 8) t), '[]'::jsonb),
        'groups', COALESCE((SELECT jsonb_object_agg(g, n) FROM (
            SELECT CASE WHEN page_path = '/' THEN 'home' ELSE split_part(page_path, '/', 2) END AS g, COUNT(*) AS n FROM v GROUP BY 1) t), '{}'::jsonb),
        'sources', COALESCE((SELECT jsonb_object_agg(source, n) FROM (SELECT source, COUNT(*) AS n FROM src GROUP BY source) t), '{}'::jsonb),
        'devices', COALESCE((SELECT jsonb_object_agg(d, n) FROM (
            SELECT COALESCE(metadata->>'device', 'Unknown') AS d, COUNT(*) AS n FROM v GROUP BY 1) t), '{}'::jsonb),
        'daily', COALESCE((SELECT jsonb_agg(jsonb_build_object('date', d.day, 'visits', COALESCE(s.visits, 0)) ORDER BY d.day)
            FROM days d LEFT JOIN day_sums s ON s.day = d.day), '[]'::jsonb)
    ) INTO v_traffic;

    -- Problems the System health tab doesn't cover
    SELECT jsonb_build_object(
        'crashes_24h', (SELECT COUNT(*) FROM platform_events WHERE kind = 'error' AND created_at >= NOW() - INTERVAL '24 hours'),
        'crashes_period', (SELECT COUNT(*) FROM platform_events WHERE kind = 'error' AND created_at >= v_since),
        'recent_crashes', COALESCE((SELECT jsonb_agg(jsonb_build_object('at', created_at, 'path', detail->>'path', 'message', detail->>'message') ORDER BY created_at DESC) FROM (
            SELECT * FROM platform_events WHERE kind = 'error' ORDER BY created_at DESC LIMIT 10) e), '[]'::jsonb),
        'transfers_waiting_7d', (SELECT jsonb_build_object('count', COUNT(*), 'clubs', COUNT(DISTINCT club_id)) FROM payments
                                  WHERE status = 'awaiting_review' AND created_at < NOW() - INTERVAL '7 days'),
        'support_open_2d', (SELECT COUNT(*) FROM support_requests WHERE status = 'open' AND created_at < NOW() - INTERVAL '2 days'),
        'enquiries_unread_3d', (SELECT jsonb_build_object('count', COUNT(*), 'clubs', COUNT(DISTINCT club_id)) FROM contact_inquiries
                                 WHERE status = 'unread' AND created_at < NOW() - INTERVAL '3 days'),
        'opt_outs_period', (SELECT COUNT(*) FROM email_opt_outs WHERE created_at >= v_since),
        'failed_payments', (SELECT COUNT(*) FROM payments WHERE status = 'failed' AND created_at >= v_since)
    ) INTO v_problems;

    RETURN jsonb_build_object(
        'period_days', v_days,
        'since', v_since,
        'money', v_money,
        'growth', v_growth,
        'usage', v_usage,
        'traffic', v_traffic,
        'problems', v_problems
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION get_platform_overview(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_platform_overview(INTEGER) TO authenticated;

-- ------------------------------------------------------------------------------
-- 4. One club's members (drill-down). Sensitive fields are never returned.
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS get_platform_club_members(UUID);
CREATE FUNCTION get_platform_club_members(p_club_id UUID)
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    email TEXT,
    role TEXT,
    membership_tier TEXT,
    membership_status TEXT,
    joined_at TIMESTAMPTZ,
    expires_at DATE,
    fee_waived BOOLEAN,
    has_account BOOLEAN,
    paid_cents BIGINT,
    last_paid_at TIMESTAMPTZ,
    last_method TEXT,
    awaiting_review BOOLEAN
) AS $$
DECLARE
    v_name TEXT;
BEGIN
    IF NOT is_platform_admin() THEN
        RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
    END IF;
    SELECT c.name INTO v_name FROM clubs c WHERE c.id = p_club_id;
    IF v_name IS NULL THEN
        RAISE EXCEPTION 'Club not found';
    END IF;
    PERFORM write_audit(p_club_id, 'platform_viewed_members', 'club_members', NULL,
        'Mission Control: viewed the members of ' || v_name, '{}'::jsonb);

    RETURN QUERY
    SELECT m.id, m.full_name::TEXT, m.email::TEXT, m.role::TEXT, m.membership_tier::TEXT,
           COALESCE(m.membership_status, 'approved')::TEXT,
           COALESCE(m.applied_at, m.created_at), m.membership_expires_at,
           m.fee_waived_at IS NOT NULL, m.user_id IS NOT NULL,
           COALESCE(pay.paid_cents, 0), pay.last_paid_at, pay.last_method, COALESCE(pay.awaiting, FALSE)
      FROM club_members m
      LEFT JOIN LATERAL (
          SELECT SUM(p.amount_cents) FILTER (WHERE p.status = 'paid') AS paid_cents,
                 MAX(COALESCE(p.paid_at, p.created_at)) FILTER (WHERE p.status = 'paid') AS last_paid_at,
                 (ARRAY_AGG(p.method::TEXT ORDER BY COALESCE(p.paid_at, p.created_at) DESC) FILTER (WHERE p.status = 'paid'))[1] AS last_method,
                 BOOL_OR(p.status = 'awaiting_review') AS awaiting
            FROM payments p WHERE p.member_id = m.id
      ) pay ON TRUE
     WHERE m.club_id = p_club_id
     ORDER BY CASE COALESCE(m.membership_status, 'approved') WHEN 'pending' THEN 0 ELSE 1 END, m.full_name
     LIMIT 2000;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION get_platform_club_members(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_platform_club_members(UUID) TO authenticated;
