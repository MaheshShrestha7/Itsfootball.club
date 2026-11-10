-- ==============================================================================
-- Mission Control redesign (MC1 to MC10, 2026-11-10)
--   1. get_platform_today(): per-club items for the Today list that used to show only as
--      totals on the Overview (bank transfers waiting 7+ days, enquiries unread 3+ days),
--      plus page crashes and ground drafts.
--   2. get_platform_audit(): the all-clubs log now shows every platform admin's changes inside
--      clubs (not just your own), with filters (who, kind, search), a cursor and a total.
--   3. More things logged: broadcasts, support request status, Mission Control notes and emails.
--      (Support replies, grounds and "Run now" jobs are logged by their API routes.)
--   4. get_platform_people_count(): how many accounts match a People search.
-- Run after 20261162. Safe to run again.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Today
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
              FROM grounds WHERE is_published = FALSE)
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION get_platform_today() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_platform_today() TO authenticated;

-- ------------------------------------------------------------------------------
-- 2. The action log
-- ------------------------------------------------------------------------------
-- What kind of change a log row is, for the filter chips
CREATE OR REPLACE FUNCTION platform_audit_kind(p_action TEXT, p_table TEXT)
RETURNS TEXT AS $$
    SELECT CASE
        WHEN p_action LIKE 'user\_%' THEN 'people'
        WHEN p_action LIKE 'support\_%' THEN 'support'
        WHEN p_action LIKE 'broadcast\_%' THEN 'broadcasts'
        WHEN p_action LIKE 'ground\_%' THEN 'grounds'
        WHEN p_action LIKE 'job\_%' THEN 'jobs'
        WHEN p_table = 'platform_admins' THEN 'admins'
        ELSE 'clubs'
    END;
$$ LANGUAGE sql IMMUTABLE;

DROP FUNCTION IF EXISTS get_platform_audit(UUID, INTEGER);
DROP FUNCTION IF EXISTS get_platform_audit(UUID, INTEGER, TEXT, TEXT, TEXT, TIMESTAMPTZ);
CREATE FUNCTION get_platform_audit(
    p_club_id UUID DEFAULT NULL,
    p_limit INTEGER DEFAULT 100,
    p_actor TEXT DEFAULT NULL,      -- NULL: everyone; 'me'; or an admin's email
    p_kind TEXT DEFAULT NULL,       -- NULL or one of platform_audit_kind()
    p_search TEXT DEFAULT NULL,     -- words in the summary or the club name
    p_before TIMESTAMPTZ DEFAULT NULL -- the next page: rows older than this
)
RETURNS TABLE (
    id UUID,
    club_id UUID,
    club_name TEXT,
    club_slug TEXT,
    actor_email TEXT,
    action TEXT,
    kind TEXT,
    summary TEXT,
    details JSONB,
    created_at TIMESTAMPTZ,
    total_count BIGINT
) AS $$
DECLARE
    v_search TEXT := NULLIF(trim(COALESCE(p_search, '')), '');
BEGIN
    IF NOT is_platform_admin() THEN
        RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    WITH scoped AS (
        SELECT a.id, a.club_id, c.name::TEXT AS club_name, c.slug::TEXT AS club_slug, a.actor_id, a.actor_email,
               a.action, platform_audit_kind(a.action, a.target_table) AS kind, a.summary, a.details, a.created_at
          FROM admin_audit_log a
          LEFT JOIN clubs c ON c.id = a.club_id
         WHERE CASE
                 WHEN p_club_id IS NOT NULL THEN a.club_id = p_club_id
                 -- Every platform action, plus what any platform admin (past or present) did inside a club
                 ELSE a.club_id IS NULL
                      OR a.actor_id = auth.uid()
                      OR a.actor_id IN (SELECT pa.user_id FROM platform_admins pa WHERE pa.user_id IS NOT NULL)
                      OR lower(COALESCE(a.actor_email, '')) IN (SELECT lower(pa.email) FROM platform_admins pa)
               END
    ),
    filtered AS (
        SELECT s.* FROM scoped s
         WHERE (p_actor IS NULL OR p_actor = ''
                OR (p_actor = 'me' AND s.actor_id = auth.uid())
                OR (p_actor <> 'me' AND lower(COALESCE(s.actor_email, '')) = lower(p_actor)))
           AND (p_kind IS NULL OR p_kind = '' OR s.kind = p_kind)
           AND (v_search IS NULL OR s.summary ILIKE '%' || v_search || '%' OR COALESCE(s.club_name, '') ILIKE '%' || v_search || '%')
    ),
    total AS (SELECT COUNT(*) AS n FROM filtered)
    SELECT f.id, f.club_id, f.club_name, f.club_slug, f.actor_email, f.action, f.kind, f.summary, f.details, f.created_at, t.n
      FROM filtered f CROSS JOIN total t
     WHERE p_before IS NULL OR f.created_at < p_before
     ORDER BY f.created_at DESC
     LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION get_platform_audit(UUID, INTEGER, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_platform_audit(UUID, INTEGER, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;

-- ------------------------------------------------------------------------------
-- 3. More things logged (only changes made by a signed-in person)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_platform_announcements()
RETURNS TRIGGER AS $$
BEGIN
    IF auth.uid() IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
    IF TG_OP = 'INSERT' THEN
        PERFORM write_audit(NULL, 'broadcast_sent', 'platform_announcements', NEW.id, 'Sent a broadcast: "' || LEFT(NEW.title, 120) || '"',
            jsonb_build_object('level', NEW.level, 'target', NEW.target));
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM write_audit(NULL, 'broadcast_deleted', 'platform_announcements', OLD.id, 'Deleted the broadcast "' || LEFT(OLD.title, 120) || '"', '{}'::jsonb);
    ELSIF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
        PERFORM write_audit(NULL, 'broadcast_' || CASE WHEN NEW.is_active THEN 'on' ELSE 'off' END, 'platform_announcements', NEW.id,
            CASE WHEN NEW.is_active THEN 'Turned on the broadcast "' ELSE 'Turned off the broadcast "' END || LEFT(NEW.title, 120) || '"', '{}'::jsonb);
    ELSIF NEW.title IS DISTINCT FROM OLD.title OR NEW.message IS DISTINCT FROM OLD.message THEN
        PERFORM write_audit(NULL, 'broadcast_edited', 'platform_announcements', NEW.id, 'Edited the broadcast "' || LEFT(NEW.title, 120) || '"', '{}'::jsonb);
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_audit_platform_announcements ON platform_announcements;
CREATE TRIGGER trg_audit_platform_announcements AFTER INSERT OR UPDATE OR DELETE ON platform_announcements
    FOR EACH ROW EXECUTE FUNCTION audit_platform_announcements();

CREATE OR REPLACE FUNCTION audit_support_requests()
RETURNS TRIGGER AS $$
BEGIN
    IF auth.uid() IS NULL OR NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
    PERFORM write_audit(NEW.club_id, 'support_status', 'support_requests', NEW.id,
        CASE NEW.status WHEN 'done' THEN 'Closed' WHEN 'waiting' THEN 'Marked as waiting on them' ELSE 'Reopened' END
            || ' the support request "' || LEFT(NEW.topic, 120) || '"',
        jsonb_build_object('from', OLD.status, 'to', NEW.status));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_audit_support_requests ON support_requests;
CREATE TRIGGER trg_audit_support_requests AFTER UPDATE OF status ON support_requests
    FOR EACH ROW EXECUTE FUNCTION audit_support_requests();

CREATE OR REPLACE FUNCTION audit_platform_club_notes()
RETURNS TRIGGER AS $$
BEGIN
    IF auth.uid() IS NULL THEN RETURN NEW; END IF;
    IF NEW.kind = 'email' THEN
        PERFORM write_audit(NEW.club_id, 'club_emailed', 'platform_club_notes', NEW.id,
            'Emailed the club: ' || LEFT(split_part(NEW.body, E'\n', 1), 160), '{}'::jsonb);
    ELSE
        PERFORM write_audit(NEW.club_id, 'club_note', 'platform_club_notes', NEW.id, 'Added a private note', '{}'::jsonb);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_audit_platform_club_notes ON platform_club_notes;
CREATE TRIGGER trg_audit_platform_club_notes AFTER INSERT ON platform_club_notes
    FOR EACH ROW EXECUTE FUNCTION audit_platform_club_notes();

-- ------------------------------------------------------------------------------
-- 4. People search total
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_platform_people_count(p_search TEXT DEFAULT '')
RETURNS BIGINT AS $$
BEGIN
    IF NOT is_platform_admin() THEN
        RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
    END IF;
    RETURN (SELECT COUNT(*) FROM auth.users u
             WHERE p_search IS NULL OR p_search = ''
                OR u.email ILIKE ('%' || p_search || '%')
                OR (u.raw_user_meta_data->>'full_name') ILIKE ('%' || p_search || '%'));
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION get_platform_people_count(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_platform_people_count(TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 5. The locked-out page only offers "Make me the platform owner" before anyone runs it
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION platform_has_admins()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (SELECT 1 FROM platform_admins WHERE is_active = TRUE);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION platform_has_admins() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION platform_has_admins() TO authenticated;
