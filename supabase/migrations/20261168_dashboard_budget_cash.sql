-- ==============================================================================
-- Migration: dashboard Money card shows the budget and an estimated bank balance (DASH-10)
-- Date: 2026-11-12
--
--   club_opening_balance  One row per club: what was in the bank on a day the treasurer picks.
--                         Finance view to read, Finance edit to change (same rules as budgets).
--                         Kept out of club_payment_settings, which payers can read.
--   get_club_overview     Same as 20261167, with three more keys under 'money':
--     budget_income_cents / budget_expense_cents  the season's budget totals (NULL with no budget
--                         or outside the season view); actuals stay in_cents / out_cents
--     cash                {opening_cents, as_at, cents}: opening balance plus everything paid in
--                         since that day, less everything spent since. NULL until a balance is set.
--                         An estimate: card fees the bank takes are not recorded, so not taken off.
--
-- The app works before this migration: the budget and bank lines just stay hidden.
-- Run after 20261167. Safe to run again.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS club_opening_balance (
    club_id UUID PRIMARY KEY REFERENCES clubs(id) ON DELETE CASCADE,
    amount_cents BIGINT NOT NULL CHECK (amount_cents BETWEEN -100000000000 AND 100000000000),
    as_at DATE NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE club_opening_balance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Finance read opening balance" ON club_opening_balance;
CREATE POLICY "Finance read opening balance" ON club_opening_balance FOR SELECT TO authenticated
    USING (has_club_perm(club_id, '{finance}', 'view'));
DROP POLICY IF EXISTS "Finance add opening balance" ON club_opening_balance;
CREATE POLICY "Finance add opening balance" ON club_opening_balance FOR INSERT TO authenticated
    WITH CHECK (has_club_perm(club_id, '{finance}', 'edit'));
DROP POLICY IF EXISTS "Finance change opening balance" ON club_opening_balance;
CREATE POLICY "Finance change opening balance" ON club_opening_balance FOR UPDATE TO authenticated
    USING (has_club_perm(club_id, '{finance}', 'edit')) WITH CHECK (has_club_perm(club_id, '{finance}', 'edit'));
DROP POLICY IF EXISTS "Finance remove opening balance" ON club_opening_balance;
CREATE POLICY "Finance remove opening balance" ON club_opening_balance FOR DELETE TO authenticated
    USING (has_club_perm(club_id, '{finance}', 'edit'));

REVOKE ALL ON club_opening_balance FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON club_opening_balance TO authenticated;

CREATE OR REPLACE FUNCTION get_club_overview(
    p_club_id UUID,
    p_from TIMESTAMPTZ,
    p_to TIMESTAMPTZ DEFAULT NOW(),
    p_season TEXT DEFAULT NULL,
    p_match_ids UUID[] DEFAULT '{}',
    p_tz TEXT DEFAULT 'Australia/Sydney'
)
RETURNS JSONB AS $$
DECLARE
    v_to TIMESTAMPTZ := COALESCE(p_to, NOW());
    v_from TIMESTAMPTZ;
    v_tz TEXT := 'UTC';
    v_season TEXT := NULLIF(btrim(COALESCE(p_season, '')), '');
    v_availability JSONB;
    v_sponsors JSONB;
    v_money JSONB;
    v_traffic JSONB;
BEGIN
    IF p_club_id IS NULL OR NOT has_club_perm(p_club_id, NULL, 'view') THEN
        RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
    END IF;
    -- At most a little over a year, so a bad range can't scan the whole table
    v_from := GREATEST(COALESCE(p_from, v_to - INTERVAL '30 days'), v_to - INTERVAL '400 days');
    IF EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = p_tz) THEN v_tz := p_tz; END IF;

    -- ---------------- Availability: replies for the games the card shows ----------------
    IF has_club_perm(p_club_id, '{availability,matches,lineup}', 'view') THEN
        SELECT COALESCE(jsonb_agg(row_to_json(a)::jsonb), '[]'::jsonb) INTO v_availability
          FROM (
            SELECT pa.match_id,
                   COUNT(*) FILTER (WHERE pa.status = 'available') AS available,
                   COUNT(*) FILTER (WHERE pa.status = 'maybe') AS maybe,
                   COUNT(*) FILTER (WHERE pa.status = 'unavailable') AS unavailable,
                   COUNT(*) FILTER (WHERE pa.status = 'pending') AS pending,
                   COALESCE(array_agg(pa.member_id) FILTER (WHERE pa.status = 'pending'), '{}') AS pending_ids
              FROM player_availabilities pa
             WHERE pa.club_id = p_club_id
               AND pa.match_id = ANY (COALESCE(p_match_ids[1:6], '{}'))
             GROUP BY pa.match_id
          ) a;
    END IF;

    -- ---------------- Sponsors: paid, unpaid invoices, logo views and clicks ----------------
    IF has_club_perm(p_club_id, '{sponsors}', 'view') THEN
        WITH paid AS (
            SELECT COALESCE(SUM(p.amount_cents), 0) AS cents
              FROM payments p
             WHERE p.club_id = p_club_id AND p.kind = 'sponsorship' AND p.status = 'paid'
               AND (CASE WHEN v_season IS NOT NULL THEN payment_season(p.club_id, p.status, p.season, COALESCE(p.paid_at, p.created_at)) = v_season
                         ELSE COALESCE(p.paid_at, p.created_at) >= v_from AND COALESCE(p.paid_at, p.created_at) < v_to END)
        ), unpaid AS (
            -- Waiting now, whatever the range: invoices and bank transfers not yet paid
            SELECT COUNT(*) AS n, COALESCE(SUM(p.amount_cents), 0) AS cents, MIN(p.due_on) AS next_due
              FROM payments p
             WHERE p.club_id = p_club_id AND p.kind = 'sponsorship'
               AND (p.status = 'awaiting_review' OR (p.status = 'pending' AND (p.method <> 'stripe' OR p.due_on IS NOT NULL)))
        ), seen AS (
            SELECT sa.sponsor_id,
                   COUNT(*) FILTER (WHERE sa.event_type = 'impression') AS views,
                   COUNT(*) FILTER (WHERE sa.event_type = 'click') AS clicks
              FROM sponsor_analytics sa
             WHERE sa.club_id = p_club_id AND sa.created_at >= v_from AND sa.created_at < v_to
             GROUP BY sa.sponsor_id
        )
        SELECT jsonb_build_object(
                   'paid_cents', (SELECT cents FROM paid),
                   'unpaid_count', (SELECT n FROM unpaid),
                   'unpaid_cents', (SELECT cents FROM unpaid),
                   'next_due', (SELECT next_due FROM unpaid),
                   'views', COALESCE((SELECT SUM(views) FROM seen), 0),
                   'clicks', COALESCE((SELECT SUM(clicks) FROM seen), 0),
                   'by_sponsor', COALESCE((SELECT jsonb_agg(jsonb_build_object('sponsor_id', sponsor_id, 'views', views, 'clicks', clicks)
                                                            ORDER BY clicks DESC, views DESC) FROM seen), '[]'::jsonb)
               ) INTO v_sponsors;
    END IF;

    -- ---------------- Money: in, out, waiting, refunds, by kind, method and day ----------------
    IF has_club_perm(p_club_id, '{finance}', 'view') THEN
        WITH p AS (
            SELECT pay.*, COALESCE(pay.paid_at, pay.created_at) AS at
              FROM payments pay
             WHERE pay.club_id = p_club_id
               AND (CASE WHEN v_season IS NOT NULL THEN payment_season(pay.club_id, pay.status, pay.season, COALESCE(pay.paid_at, pay.created_at)) = v_season
                         ELSE COALESCE(pay.paid_at, pay.created_at) >= v_from AND COALESCE(pay.paid_at, pay.created_at) < v_to END)
        ), e AS (
            SELECT ex.* FROM expenses ex
             WHERE ex.club_id = p_club_id
               AND (CASE WHEN v_season IS NOT NULL THEN expense_season(ex.club_id, ex.season, ex.spent_on) = v_season
                         ELSE ex.spent_on >= (v_from AT TIME ZONE v_tz)::date AND ex.spent_on <= (v_to AT TIME ZONE v_tz)::date END)
        ), waiting AS (
            -- Waiting now, whatever the range (a Stripe checkout still 'pending' with no due_on was abandoned, not owed; a bill with one is)
            SELECT w.* FROM payments w
             WHERE w.club_id = p_club_id
               AND (w.status = 'awaiting_review' OR (w.status = 'pending' AND (w.method <> 'stripe' OR w.due_on IS NOT NULL)))
        ), days AS (
            SELECT d, SUM(i) AS i, SUM(o) AS o FROM (
                SELECT (at AT TIME ZONE v_tz)::date AS d, amount_cents AS i, 0 AS o FROM p WHERE status = 'paid'
                UNION ALL
                SELECT spent_on, 0, amount_cents FROM e
            ) x GROUP BY d
        )
        SELECT jsonb_build_object(
                   'in_cents', COALESCE((SELECT SUM(amount_cents) FROM p WHERE status = 'paid'), 0),
                   'paid_count', (SELECT COUNT(*) FROM p WHERE status = 'paid'),
                   'out_cents', COALESCE((SELECT SUM(amount_cents) FROM e), 0),
                   'expense_count', (SELECT COUNT(*) FROM e),
                   'waiting_cents', COALESCE((SELECT SUM(amount_cents) FROM waiting), 0),
                   'waiting_count', (SELECT COUNT(*) FROM waiting),
                   'refunded_count', (SELECT COUNT(*) FROM p WHERE status IN ('refunded', 'failed')),
                   'refunded_cents', COALESCE((SELECT SUM(amount_cents) FROM p WHERE status = 'refunded'), 0),
                   'budget_income_cents', (SELECT SUM(b.amount_cents) FROM budgets b
                                            WHERE b.club_id = p_club_id AND b.season = v_season AND b.kind = 'income'),
                   'budget_expense_cents', (SELECT SUM(b.amount_cents) FROM budgets b
                                             WHERE b.club_id = p_club_id AND b.season = v_season AND b.kind = 'expense'),
                   'cash', (SELECT jsonb_build_object(
                                'opening_cents', ob.amount_cents,
                                'as_at', ob.as_at,
                                'cents', ob.amount_cents
                                    + COALESCE((SELECT SUM(c.amount_cents) FROM payments c
                                                 WHERE c.club_id = p_club_id AND c.status = 'paid'
                                                   AND (COALESCE(c.paid_at, c.created_at) AT TIME ZONE v_tz)::date >= ob.as_at), 0)
                                    - COALESCE((SELECT SUM(x.amount_cents) FROM expenses x
                                                 WHERE x.club_id = p_club_id AND x.spent_on >= ob.as_at), 0))
                              FROM club_opening_balance ob WHERE ob.club_id = p_club_id),
                   'by_kind', COALESCE((SELECT jsonb_object_agg(kind, cents) FROM (
                        SELECT kind, SUM(amount_cents) AS cents FROM p WHERE status = 'paid' GROUP BY kind) k), '{}'::jsonb),
                   'by_method', COALESCE((SELECT jsonb_object_agg(method, cents) FROM (
                        SELECT method, SUM(amount_cents) AS cents FROM p WHERE status = 'paid' GROUP BY method) m), '{}'::jsonb),
                   'daily', COALESCE((SELECT jsonb_agg(jsonb_build_object('d', d, 'in', i, 'out', o) ORDER BY d) FROM days), '[]'::jsonb),
                   'waiting', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                            'id', w.id, 'kind', w.kind, 'method', w.method, 'status', w.status,
                            'amount_cents', w.amount_cents, 'payer_name', w.payer_name, 'description', w.description,
                            'member_id', w.member_id, 'sponsor_id', w.sponsor_id, 'invoice_number', w.invoice_number,
                            'due_on', w.due_on, 'created_at', w.created_at)
                            ORDER BY (w.status = 'awaiting_review') DESC, w.created_at)
                        FROM (SELECT * FROM waiting ORDER BY (status = 'awaiting_review') DESC, created_at LIMIT 50) w), '[]'::jsonb)
               ) INTO v_money;
    END IF;

    -- ---------------- Website and fans: visits, top pages, gate scans, tickets ----------------
    IF has_club_perm(p_club_id, '{analytics}', 'view') THEN
        WITH v AS (
            SELECT ca.page_path, ca.visitor_hash, ca.created_at
              FROM club_analytics ca
             WHERE ca.club_id = p_club_id AND ca.event_type = 'page_view'
               AND ca.created_at >= v_from AND ca.created_at < v_to
        ), t AS (
            SELECT ea.event_id, ea.checkin_status
              FROM event_attendees ea
             WHERE ea.club_id = p_club_id AND COALESCE(ea.checkin_status, 'registered') <> 'cancelled'
               AND ea.created_at >= v_from AND ea.created_at < v_to
        )
        SELECT jsonb_build_object(
                   'visits', (SELECT COUNT(*) FROM v),
                   'visitors', (SELECT COUNT(DISTINCT visitor_hash) FROM v WHERE visitor_hash IS NOT NULL AND visitor_hash <> 'anon'),
                   'pages', COALESCE((SELECT jsonb_agg(jsonb_build_object('path', path, 'n', n) ORDER BY n DESC) FROM (
                        SELECT COALESCE(NULLIF(split_part(page_path, '?', 1), ''), '/') AS path, COUNT(*) AS n
                          FROM v GROUP BY 1 ORDER BY 2 DESC LIMIT 5) pg), '[]'::jsonb),
                   'daily', COALESCE((SELECT jsonb_agg(jsonb_build_object('d', d, 'n', n) ORDER BY d) FROM (
                        SELECT (created_at AT TIME ZONE v_tz)::date AS d, COUNT(*) AS n FROM v GROUP BY 1) dd), '[]'::jsonb),
                   'scans', (SELECT COUNT(*) FROM gate_scans gs
                              WHERE gs.club_id = p_club_id AND gs.valid AND gs.scanned_at >= v_from AND gs.scanned_at < v_to),
                   'tickets', (SELECT COUNT(*) FROM t),
                   'checked_in', (SELECT COUNT(*) FROM t WHERE checkin_status = 'checked_in'),
                   'ticket_events', (SELECT COUNT(DISTINCT event_id) FROM t)
               ) INTO v_traffic;
    END IF;

    RETURN jsonb_build_object(
        'from', v_from,
        'to', v_to,
        'season', v_season,
        'currency', COALESCE((SELECT cps.currency FROM club_payment_settings cps WHERE cps.club_id = p_club_id), 'AUD'),
        'availability', v_availability,
        'sponsors', v_sponsors,
        'money', v_money,
        'traffic', v_traffic
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION get_club_overview(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, UUID[], TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_club_overview(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, UUID[], TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
