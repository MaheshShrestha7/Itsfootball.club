-- ==============================================================================
-- Mission Control features MCF-1 to MCF-10 (2026-11-16)
--   MCF-1  get_platform_matchday(): every club's games in a date range (Matchday page);
--          Today lists clubs with finished games and no score.
--   MCF-2  payments.dispute_*: card disputes saved by the Stripe webhook, listed on Today.
--   MCF-3  Today lists Owner / Club Admin invites that ran out unaccepted.
--   MCF-4  Suggestions for grounds no club looks after: listed and resolved in Mission Control.
--   MCF-5  platform_feature_requests + support_requests.feature_id.
--   MCF-6  platform_club_notes.remind_on: a note comes back on Today that day.
--   MCF-7  get_platform_club_recent(): a club's last 30 days.
--   MCF-8  get_platform_email_stats(): what the site emailed, per day, kind and club.
--   MCF-9  platform_announcements.starts_at + club_ids, get_platform_banner() (who sees which
--          banner is now decided here: before, every banner showed to everyone), and
--          platform_announcement_dismissals (how many signed-in people closed it).
--   MCF-10 platform_support_access: a platform admin asks, the club's Owner says yes, and the
--          admin gets Club Admin access for a few hours. is_club_admin() and
--          my_club_permissions() accept it; everything they change is in the club's log.
-- Run after 20261176. Safe to run again.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- New columns and tables
-- ------------------------------------------------------------------------------
ALTER TABLE payments ADD COLUMN IF NOT EXISTS dispute_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS dispute_status TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS dispute_reason TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS dispute_due_by TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS disputed_at TIMESTAMPTZ;

ALTER TABLE platform_club_notes ADD COLUMN IF NOT EXISTS remind_on DATE;
DROP POLICY IF EXISTS "Platform operators update club notes" ON platform_club_notes;
CREATE POLICY "Platform operators update club notes" ON platform_club_notes FOR UPDATE
    USING (is_platform_operator()) WITH CHECK (is_platform_operator());

CREATE TABLE IF NOT EXISTS platform_feature_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL CHECK (char_length(trim(title)) BETWEEN 2 AND 200),
    status TEXT NOT NULL DEFAULT 'asked' CHECK (status IN ('asked', 'planned', 'built')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    built_at TIMESTAMPTZ,
    built_emailed_at TIMESTAMPTZ
);
ALTER TABLE platform_feature_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Platform admins read feature requests" ON platform_feature_requests;
CREATE POLICY "Platform admins read feature requests" ON platform_feature_requests FOR SELECT USING (is_platform_admin());
DROP POLICY IF EXISTS "Platform operators manage feature requests" ON platform_feature_requests;
CREATE POLICY "Platform operators manage feature requests" ON platform_feature_requests FOR ALL
    USING (is_platform_operator()) WITH CHECK (is_platform_operator());
ALTER TABLE support_requests ADD COLUMN IF NOT EXISTS feature_id UUID REFERENCES platform_feature_requests(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_support_requests_feature ON support_requests (feature_id) WHERE feature_id IS NOT NULL;

ALTER TABLE platform_announcements ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ;
ALTER TABLE platform_announcements ADD COLUMN IF NOT EXISTS club_ids UUID[];
CREATE TABLE IF NOT EXISTS platform_announcement_dismissals (
    announcement_id UUID NOT NULL REFERENCES platform_announcements(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (announcement_id, user_id)
);
ALTER TABLE platform_announcement_dismissals ENABLE ROW LEVEL SECURITY;
-- Written only by dismiss_platform_banner(); platform admins read them for the count
DROP POLICY IF EXISTS "Platform admins read banner dismissals" ON platform_announcement_dismissals;
CREATE POLICY "Platform admins read banner dismissals" ON platform_announcement_dismissals FOR SELECT USING (is_platform_admin());

CREATE TABLE IF NOT EXISTS platform_support_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT,
    hours SMALLINT NOT NULL CHECK (hours BETWEEN 1 AND 72),
    reason TEXT CHECK (reason IS NULL OR char_length(reason) <= 300),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'cancelled', 'ended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_at TIMESTAMPTZ,
    decided_by UUID,
    expires_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_support_access_club ON platform_support_access (club_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_access_user ON platform_support_access (user_id) WHERE status = 'approved';
ALTER TABLE platform_support_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON platform_support_access FROM anon, authenticated;
-- Read and changed only through the functions below

-- ------------------------------------------------------------------------------
-- MCF-10 Support access
-- ------------------------------------------------------------------------------
-- Does the signed-in platform admin have approved, unexpired support access to this club?
CREATE OR REPLACE FUNCTION support_access_active(p_club_id UUID)
RETURNS BOOLEAN AS $$
    SELECT auth.uid() IS NOT NULL AND EXISTS (
        SELECT 1 FROM platform_support_access s
         WHERE s.club_id = p_club_id AND s.user_id = auth.uid()
           AND s.status = 'approved' AND s.expires_at > NOW()
    ) AND is_platform_operator();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION support_access_active(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION support_access_active(UUID) TO authenticated;

-- Same as 20261160, plus approved support access
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
        OR support_access_active(p_club_id)
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Same as 20261160, plus clubs with approved support access
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
        UNION
        SELECT s.club_id FROM platform_support_access s
         WHERE s.user_id = auth.uid() AND s.status = 'approved' AND s.expires_at > NOW()
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

-- A platform admin asks the club's Owner. Replaces any request of theirs still waiting.
-- Returns who to email; the email is sent by /api/platform/support-access.
CREATE OR REPLACE FUNCTION platform_request_support_access(p_club_id UUID, p_hours INTEGER, p_reason TEXT DEFAULT NULL)
RETURNS TABLE (request_id UUID, owner_email TEXT, owner_name TEXT, club_name TEXT, club_slug TEXT) AS $$
DECLARE
    v_club clubs%ROWTYPE;
    v_id UUID;
    v_email TEXT;
BEGIN
    IF NOT is_platform_operator() OR NOT mfa_ok() THEN
        RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
    END IF;
    IF p_hours IS NULL OR p_hours NOT IN (2, 24, 72) THEN
        RAISE EXCEPTION 'Pick 2, 24 or 72 hours.' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_club FROM clubs WHERE id = p_club_id;
    IF v_club.id IS NULL THEN RAISE EXCEPTION 'Club not found.' USING ERRCODE = '22023'; END IF;
    IF v_club.owner_id IS NULL THEN RAISE EXCEPTION 'This club has no Owner to ask.' USING ERRCODE = '22023'; END IF;
    IF v_club.owner_id = auth.uid() THEN RAISE EXCEPTION 'You own this club already.' USING ERRCODE = '22023'; END IF;
    IF support_access_active(p_club_id) THEN RAISE EXCEPTION 'You already have access to this club.' USING ERRCODE = '22023'; END IF;

    SELECT u.email INTO v_email FROM auth.users u WHERE u.id = auth.uid();
    UPDATE platform_support_access SET status = 'cancelled', decided_at = NOW()
     WHERE club_id = p_club_id AND user_id = auth.uid() AND status = 'pending';
    INSERT INTO platform_support_access (club_id, user_id, user_email, hours, reason)
    VALUES (p_club_id, auth.uid(), v_email, p_hours, NULLIF(trim(COALESCE(p_reason, '')), ''))
    RETURNING id INTO v_id;
    PERFORM write_audit(p_club_id, 'support_access_requested', 'platform_support_access', v_id,
        'Asked the Owner for ' || p_hours || ' hours of support access', jsonb_build_object('hours', p_hours));

    RETURN QUERY
    SELECT v_id, u.email::TEXT,
           COALESCE(NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''), split_part(u.email, '@', 1))::TEXT,
           v_club.name::TEXT, v_club.slug::TEXT
      FROM auth.users u WHERE u.id = v_club.owner_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION platform_request_support_access(UUID, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION platform_request_support_access(UUID, INTEGER, TEXT) TO authenticated;

-- The club's requests, newest first: for its Owner (Roles page) and for platform admins
CREATE OR REPLACE FUNCTION get_club_support_access(p_club_id UUID)
RETURNS TABLE (id UUID, user_email TEXT, hours SMALLINT, reason TEXT, status TEXT, created_at TIMESTAMPTZ, decided_at TIMESTAMPTZ, expires_at TIMESTAMPTZ, is_mine BOOLEAN) AS $$
BEGIN
    IF NOT (is_platform_admin() OR EXISTS (SELECT 1 FROM clubs c WHERE c.id = p_club_id AND c.owner_id = auth.uid() AND mfa_ok())) THEN
        RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
    END IF;
    RETURN QUERY
    SELECT s.id, s.user_email, s.hours, s.reason,
           CASE WHEN s.status = 'approved' AND s.expires_at <= NOW() THEN 'ended' ELSE s.status END,
           s.created_at, s.decided_at, s.expires_at, s.user_id = auth.uid()
      FROM platform_support_access s
     WHERE s.club_id = p_club_id
     ORDER BY s.created_at DESC
     LIMIT 10;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION get_club_support_access(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_club_support_access(UUID) TO authenticated;

-- The Owner says yes or no to a waiting request
CREATE OR REPLACE FUNCTION club_decide_support_access(p_id UUID, p_approve BOOLEAN)
RETURNS VOID AS $$
DECLARE
    v_req platform_support_access%ROWTYPE;
BEGIN
    SELECT * INTO v_req FROM platform_support_access WHERE id = p_id;
    IF v_req.id IS NULL OR NOT EXISTS (SELECT 1 FROM clubs c WHERE c.id = v_req.club_id AND c.owner_id = auth.uid()) OR NOT mfa_ok() THEN
        RAISE EXCEPTION 'Only the club Owner can answer this.' USING ERRCODE = '42501';
    END IF;
    IF v_req.status <> 'pending' THEN
        RAISE EXCEPTION 'This request was already answered or cancelled.' USING ERRCODE = '22023';
    END IF;
    UPDATE platform_support_access
       SET status = CASE WHEN p_approve THEN 'approved' ELSE 'declined' END,
           decided_at = NOW(), decided_by = auth.uid(),
           expires_at = CASE WHEN p_approve THEN NOW() + make_interval(hours => v_req.hours) END
     WHERE id = p_id;
    PERFORM write_audit(v_req.club_id, CASE WHEN p_approve THEN 'support_access_approved' ELSE 'support_access_declined' END,
        'platform_support_access', p_id,
        CASE WHEN p_approve THEN 'Gave itsfootball.club support ' || v_req.hours || ' hours of admin access'
             ELSE 'Said no to itsfootball.club support access' END,
        jsonb_build_object('hours', v_req.hours, 'support', v_req.user_email));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION club_decide_support_access(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION club_decide_support_access(UUID, BOOLEAN) TO authenticated;

-- End access now (the Owner or the platform admin who asked), or cancel a waiting request
CREATE OR REPLACE FUNCTION end_support_access(p_id UUID)
RETURNS VOID AS $$
DECLARE
    v_req platform_support_access%ROWTYPE;
BEGIN
    SELECT * INTO v_req FROM platform_support_access WHERE id = p_id;
    IF v_req.id IS NULL OR NOT (
        (v_req.user_id = auth.uid() AND is_platform_admin())
        OR (EXISTS (SELECT 1 FROM clubs c WHERE c.id = v_req.club_id AND c.owner_id = auth.uid()) AND mfa_ok())
    ) THEN
        RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
    END IF;
    IF v_req.status = 'pending' THEN
        UPDATE platform_support_access SET status = 'cancelled', decided_at = NOW() WHERE id = p_id;
    ELSIF v_req.status = 'approved' AND v_req.expires_at > NOW() THEN
        UPDATE platform_support_access SET status = 'ended', expires_at = NOW() WHERE id = p_id;
        PERFORM write_audit(v_req.club_id, 'support_access_ended', 'platform_support_access', p_id,
            'Ended itsfootball.club support access', jsonb_build_object('support', v_req.user_email));
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION end_support_access(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION end_support_access(UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- MCF-1 Matchday
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_platform_matchday(p_from TIMESTAMPTZ, p_to TIMESTAMPTZ)
RETURNS TABLE (
    id UUID, club_id UUID, club_name TEXT, club_slug TEXT, club_short TEXT, club_color TEXT, club_logo TEXT,
    team_name TEXT, match_type TEXT, is_club_home BOOLEAN, home_team_name TEXT, away_team_name TEXT, opponent_name TEXT,
    match_date TIMESTAMPTZ, match_time TEXT, status TEXT, period TEXT, home_score INTEGER, away_score INTEGER,
    current_minute INTEGER, match_slug TEXT
) AS $$
BEGIN
    IF NOT is_platform_admin() THEN
        RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
    END IF;
    IF p_to - p_from > INTERVAL '15 days' THEN
        RAISE EXCEPTION 'Pick up to two weeks.' USING ERRCODE = '22023';
    END IF;
    RETURN QUERY
    SELECT m.id, c.id, c.name::TEXT, c.slug::TEXT, c.short_name::TEXT, c.primary_color::TEXT, c.logo_url::TEXT,
           t.name::TEXT, m.match_type::TEXT, m.is_club_home, m.home_team_name::TEXT, m.away_team_name::TEXT, m.opponent_name::TEXT,
           m.match_date, m.match_time::TEXT, m.status::TEXT, m.period::TEXT, m.home_score, m.away_score, m.current_minute, m.slug
      FROM matches m
      JOIN clubs c ON c.id = m.club_id AND c.is_active AND c.closed_at IS NULL
      LEFT JOIN club_teams t ON t.id = m.team_id
     WHERE m.match_date >= p_from AND m.match_date < p_to
       AND m.status <> 'cancelled'
     ORDER BY m.match_date, c.name
     LIMIT 1000;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION get_platform_matchday(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_platform_matchday(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- ------------------------------------------------------------------------------
-- Today: same as 20261163 plus unscored games, disputes, expired invites,
-- ground suggestions nobody looks after and note reminders
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_platform_today()
RETURNS JSONB AS $$
BEGIN
    IF NOT is_platform_admin() THEN
        RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
    END IF;

    RETURN jsonb_build_object(
        'transfers', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('club_id', club_id, 'count', n, 'oldest', oldest) ORDER BY oldest)
              FROM (SELECT club_id, COUNT(*) AS n, MIN(created_at) AS oldest
                      FROM payments
                     WHERE status = 'awaiting_review' AND created_at < NOW() - INTERVAL '7 days' AND club_id IS NOT NULL
                     GROUP BY club_id) t), '[]'::jsonb),
        'enquiries', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('club_id', club_id, 'count', n, 'oldest', oldest) ORDER BY oldest)
              FROM (SELECT club_id, COUNT(*) AS n, MIN(created_at) AS oldest
                      FROM contact_inquiries
                     WHERE status = 'unread' AND created_at < NOW() - INTERVAL '3 days' AND club_id IS NOT NULL
                     GROUP BY club_id) e), '[]'::jsonb),
        'crashes', (
            SELECT jsonb_build_object('count', COUNT(*), 'latest_at', MAX(created_at),
                       'latest_path', (SELECT detail->>'path' FROM platform_events
                                        WHERE kind = 'error' AND created_at >= NOW() - INTERVAL '24 hours'
                                        ORDER BY created_at DESC LIMIT 1))
              FROM platform_events WHERE kind = 'error' AND created_at >= NOW() - INTERVAL '24 hours'),
        'ground_drafts', (
            SELECT jsonb_build_object('count', COUNT(*), 'newest_at', MAX(created_at))
              FROM grounds WHERE is_published = FALSE),
        -- Games still 'upcoming' after their date (the page works out kickoff + 2 hours from match_time)
        'unscored', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('club_id', m.club_id, 'match_date', m.match_date, 'match_time', m.match_time))
              FROM (SELECT m.club_id, m.match_date, m.match_time
                      FROM matches m JOIN clubs c ON c.id = m.club_id AND c.is_active AND c.closed_at IS NULL
                     WHERE m.status = 'upcoming' AND m.match_date >= NOW() - INTERVAL '8 days' AND m.match_date <= NOW()
                     LIMIT 500) m), '[]'::jsonb),
        'disputes', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('payment_id', p.id, 'club_id', p.club_id, 'amount_cents', p.amount_cents,
                       'description', p.description, 'payer_name', p.payer_name, 'status', p.dispute_status,
                       'due_by', p.dispute_due_by, 'disputed_at', p.disputed_at) ORDER BY p.dispute_due_by NULLS LAST)
              FROM payments p
             WHERE p.dispute_status IN ('needs_response', 'warning_needs_response', 'under_review', 'warning_under_review')
               AND p.club_id IS NOT NULL), '[]'::jsonb),
        'expired_invites', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('invite_id', i.id, 'club_id', i.club_id, 'email', i.email, 'role', i.role,
                       'sent_at', i.sent_at, 'expires_at', i.expires_at) ORDER BY i.expires_at DESC)
              FROM (SELECT DISTINCT ON (club_id) * FROM club_admin_invites
                     WHERE accepted_at IS NULL AND cancelled_at IS NULL
                       AND expires_at < NOW() AND expires_at > NOW() - INTERVAL '30 days'
                     ORDER BY club_id, expires_at DESC) i), '[]'::jsonb),
        'ground_suggestions', (
            SELECT jsonb_build_object('count', COUNT(*), 'latest_id', (array_agg(s.id ORDER BY s.created_at DESC))[1],
                       'latest_message', (array_agg(s.message ORDER BY s.created_at DESC))[1],
                       'latest_ground', (array_agg(g.name || ', ' || g.suburb ORDER BY s.created_at DESC))[1])
              FROM ground_suggestions s JOIN grounds g ON g.id = s.ground_id
             WHERE s.status = 'open' AND g.steward_club_id IS NULL),
        'reminders', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('note_id', n.id, 'club_id', n.club_id, 'body', LEFT(n.body, 300),
                       'created_at', n.created_at, 'remind_on', n.remind_on) ORDER BY n.remind_on)
              FROM platform_club_notes n
             WHERE n.remind_on IS NOT NULL AND n.remind_on <= (NOW() AT TIME ZONE 'Australia/Sydney')::DATE), '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION get_platform_today() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_platform_today() TO authenticated;

-- ------------------------------------------------------------------------------
-- MCF-4 Suggestions for grounds no club looks after
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_platform_ground_suggestions()
RETURNS TABLE (id UUID, ground_id UUID, ground_name TEXT, suburb TEXT, ground_path TEXT, topic TEXT, message TEXT, contact TEXT, created_at TIMESTAMPTZ) AS $$
BEGIN
    IF NOT is_platform_admin() THEN
        RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
    END IF;
    RETURN QUERY
    SELECT s.id, g.id, g.name::TEXT, g.suburb::TEXT, ('/grounds/' || g.suburb_slug || '/' || g.slug)::TEXT,
           s.topic::TEXT, s.message::TEXT, s.contact::TEXT, s.created_at
      FROM ground_suggestions s JOIN grounds g ON g.id = s.ground_id
     WHERE s.status = 'open' AND g.steward_club_id IS NULL
     ORDER BY s.created_at DESC
     LIMIT 100;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION get_platform_ground_suggestions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_platform_ground_suggestions() TO authenticated;

CREATE OR REPLACE FUNCTION platform_resolve_ground_suggestion(p_id UUID, p_status TEXT)
RETURNS VOID AS $$
BEGIN
    IF NOT is_platform_operator() THEN
        RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
    END IF;
    IF p_status NOT IN ('done', 'dismissed') THEN
        RAISE EXCEPTION 'Unknown status.' USING ERRCODE = '22023';
    END IF;
    UPDATE ground_suggestions SET status = p_status, resolved_at = NOW()
     WHERE id = p_id AND status = 'open'
       AND ground_id IN (SELECT g.id FROM grounds g WHERE g.steward_club_id IS NULL);
    IF NOT FOUND THEN
        RAISE EXCEPTION 'That suggestion was already handled.' USING ERRCODE = '22023';
    END IF;
    PERFORM write_audit(NULL, 'ground_suggestion_' || p_status, 'ground_suggestions', p_id,
        CASE p_status WHEN 'done' THEN 'Acted on a ground suggestion' ELSE 'Dismissed a ground suggestion' END, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION platform_resolve_ground_suggestion(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION platform_resolve_ground_suggestion(UUID, TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- MCF-7 A club's last 30 days
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_platform_club_recent(p_club_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_since TIMESTAMPTZ := NOW() - INTERVAL '30 days';
BEGIN
    IF NOT is_platform_admin() THEN
        RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
    END IF;
    RETURN jsonb_build_object(
        'games_played', (SELECT COUNT(*) FROM matches WHERE club_id = p_club_id AND status = 'completed' AND match_date >= v_since AND match_date <= NOW()),
        'games_unscored', (SELECT COUNT(*) FROM matches WHERE club_id = p_club_id AND status = 'upcoming' AND match_date >= v_since AND match_date < NOW() - INTERVAL '1 day'),
        'new_members', (SELECT COUNT(*) FROM club_members WHERE club_id = p_club_id AND created_at >= v_since AND COALESCE(membership_status, 'approved') = 'approved'),
        'new_waiting', (SELECT COUNT(*) FROM club_members WHERE club_id = p_club_id AND created_at >= v_since AND membership_status = 'pending'),
        'paid_cents', (SELECT COALESCE(SUM(amount_cents), 0) FROM payments WHERE club_id = p_club_id AND status = 'paid' AND COALESCE(paid_at, created_at) >= v_since),
        'emails', (SELECT COUNT(*) FROM email_log WHERE club_id = p_club_id AND sent_at >= v_since),
        'last_news_at', (SELECT MAX(COALESCE(published_at, created_at)) FROM news_articles WHERE club_id = p_club_id AND published_at IS NOT NULL)
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION get_platform_club_recent(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_platform_club_recent(UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- MCF-8 What the site emailed
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_platform_email_stats(p_days INTEGER DEFAULT 14)
RETURNS JSONB AS $$
DECLARE
    v_days INTEGER := LEAST(GREATEST(COALESCE(p_days, 14), 1), 90);
    v_from DATE := (NOW() AT TIME ZONE 'Australia/Sydney')::DATE - (v_days - 1);
    v_since TIMESTAMPTZ := v_from::TIMESTAMP AT TIME ZONE 'Australia/Sydney';
BEGIN
    IF NOT is_platform_admin() THEN
        RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
    END IF;
    RETURN jsonb_build_object(
        'days', (SELECT jsonb_agg(jsonb_build_object('day', d.day, 'n', COALESCE(x.n, 0)) ORDER BY d.day)
                   FROM generate_series(v_from, v_from + (v_days - 1), INTERVAL '1 day') AS d(day)
                   LEFT JOIN (SELECT (sent_at AT TIME ZONE 'Australia/Sydney')::DATE AS day, COUNT(*) AS n
                                FROM email_log WHERE sent_at >= v_since GROUP BY 1) x
                     ON x.day = d.day::DATE),
        'kinds', COALESCE((SELECT jsonb_agg(jsonb_build_object('kind', k, 'n', n) ORDER BY n DESC)
                   FROM (SELECT COALESCE(kind, 'other') AS k, COUNT(*) AS n FROM email_log
                          WHERE sent_at >= v_since GROUP BY 1) k), '[]'::jsonb),
        'clubs', COALESCE((SELECT jsonb_agg(jsonb_build_object('club_id', c.club_id, 'name', cl.name, 'n', c.n) ORDER BY c.n DESC)
                   FROM (SELECT club_id, COUNT(*) AS n FROM email_log
                          WHERE sent_at >= v_since AND club_id IS NOT NULL
                          GROUP BY 1 ORDER BY 2 DESC LIMIT 8) c JOIN clubs cl ON cl.id = c.club_id), '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION get_platform_email_stats(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_platform_email_stats(INTEGER) TO authenticated;

-- ------------------------------------------------------------------------------
-- MCF-9 Which banner this visitor sees
--   all: everyone (only on the listed clubs' pages when clubs are picked)
--   public: main site pages only
--   admins / members: signed-in admins / approved members of the club whose page they're on
--     (on main site pages: of any club, or of a listed club when clubs are picked)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_platform_banner(p_slug TEXT DEFAULT NULL, p_host TEXT DEFAULT NULL)
RETURNS SETOF platform_announcements AS $$
DECLARE
    v_club UUID;
BEGIN
    SELECT c.id INTO v_club FROM clubs c
     WHERE (p_slug IS NOT NULL AND c.slug = lower(p_slug))
        OR (p_host IS NOT NULL AND c.custom_domain IS NOT NULL AND lower(c.custom_domain) = lower(p_host))
     LIMIT 1;

    RETURN QUERY
    SELECT a.* FROM platform_announcements a
     WHERE a.is_active
       AND (a.expires_at IS NULL OR a.expires_at > NOW())
       AND (a.starts_at IS NULL OR a.starts_at <= NOW())
       AND NOT EXISTS (SELECT 1 FROM platform_announcement_dismissals d WHERE d.announcement_id = a.id AND d.user_id = auth.uid())
       AND CASE a.target
           WHEN 'public' THEN v_club IS NULL
           WHEN 'all' THEN COALESCE(cardinality(a.club_ids), 0) = 0 OR v_club = ANY (a.club_ids)
           ELSE auth.uid() IS NOT NULL AND EXISTS (
               SELECT 1 FROM clubs c
                WHERE (v_club IS NULL OR c.id = v_club)
                  AND (COALESCE(cardinality(a.club_ids), 0) = 0 OR c.id = ANY (a.club_ids))
                  AND (is_club_admin(c.id) OR (a.target = 'members' AND EXISTS (
                       SELECT 1 FROM club_members m
                        WHERE m.club_id = c.id AND m.user_id = auth.uid()
                          AND COALESCE(m.membership_status, 'approved') = 'approved'))))
           END
     ORDER BY a.created_at DESC
     LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION get_platform_banner(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_platform_banner(TEXT, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION dismiss_platform_banner(p_id UUID)
RETURNS VOID AS $$
BEGIN
    IF auth.uid() IS NULL THEN RETURN; END IF;
    INSERT INTO platform_announcement_dismissals (announcement_id, user_id)
    SELECT p_id, auth.uid() WHERE EXISTS (SELECT 1 FROM platform_announcements WHERE id = p_id)
    ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION dismiss_platform_banner(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION dismiss_platform_banner(UUID) TO authenticated;
