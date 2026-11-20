-- ==============================================================================
-- Migration: Committee meetings (an agenda before, the meeting itself, minutes after)
--
--   * committee_meetings: one row per meeting. A general committee meeting, or a meeting about one
--     topic (typed in, or one of the club's events such as a cup). The agenda (items and sub-topics,
--     each with its notes and decisions), who came and the club's figures as they were when the
--     meeting started are kept on the row. Minutes can be shared behind a link like event summaries.
--   * committee_actions: the to-dos agreed at a meeting, with who and by when. Open ones carry over
--     to the next meeting on the same topic until someone marks them done or drops them.
--   * committee_meeting_figures(club, event): a topic meeting's event figures (teams entered, entry
--     fees, tickets), each part only for staff whose role covers that area.
--   * shared_committee_minutes(token): the saved minutes behind a share link, for anyone with it.
-- Everything else is staff-only through the Committee area. The app hides Meetings until this runs.
--
-- Safe to run more than once.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS committee_meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    kind TEXT NOT NULL DEFAULT 'general' CHECK (kind IN ('general', 'topic')),
    topic TEXT CHECK (topic IS NULL OR char_length(topic) <= 120),
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    location TEXT NOT NULL DEFAULT '' CHECK (char_length(location) <= 200),
    status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'live', 'done')),
    agenda JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(agenda) = 'array' AND pg_column_size(agenda) < 200000),
    attendance JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(attendance) = 'object' AND pg_column_size(attendance) < 20000),
    current_item TEXT,
    item_started_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    figures JSONB CHECK (figures IS NULL OR (jsonb_typeof(figures) = 'object' AND pg_column_size(figures) < 50000)),
    agenda_sent_at TIMESTAMPTZ,
    minutes_sent_at TIMESTAMPTZ,
    share_token TEXT,
    share_report JSONB,
    shared_at TIMESTAMPTZ,
    updated_by_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT committee_meetings_share_shape CHECK (
        (share_token IS NULL AND share_report IS NULL)
        OR (share_token ~ '^[A-Za-z0-9]{32,64}$' AND jsonb_typeof(share_report) = 'object' AND pg_column_size(share_report) < 200000)
    )
);

CREATE INDEX IF NOT EXISTS idx_committee_meetings_club ON committee_meetings(club_id, starts_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_committee_meetings_share_token ON committee_meetings(share_token) WHERE share_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS committee_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    meeting_id UUID NOT NULL REFERENCES committee_meetings(id) ON DELETE CASCADE,
    item_id TEXT CHECK (item_id IS NULL OR char_length(item_id) <= 40),
    text TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 300),
    owner_id UUID REFERENCES club_members(id) ON DELETE SET NULL,
    owner_name TEXT CHECK (owner_name IS NULL OR char_length(owner_name) <= 160),
    due_on DATE,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'dropped')),
    closed_at TIMESTAMPTZ,
    -- The meeting where it was ticked off or dropped, for "Closed at this meeting" in the minutes
    closed_in UUID REFERENCES committee_meetings(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_committee_actions_club ON committee_actions(club_id, status);
CREATE INDEX IF NOT EXISTS idx_committee_actions_meeting ON committee_actions(meeting_id);

ALTER TABLE committee_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE committee_actions ENABLE ROW LEVEL SECURITY;

-- A meeting's event must be the same club's
DROP POLICY IF EXISTS "Staff read" ON committee_meetings;
CREATE POLICY "Staff read" ON committee_meetings FOR SELECT
    USING (has_club_perm(club_id, '{committee}', 'view'));
DROP POLICY IF EXISTS "Staff insert" ON committee_meetings;
CREATE POLICY "Staff insert" ON committee_meetings FOR INSERT
    WITH CHECK (has_club_perm(club_id, '{committee}', 'edit')
                AND (event_id IS NULL OR EXISTS (SELECT 1 FROM events e WHERE e.id = event_id AND e.club_id = committee_meetings.club_id)));
DROP POLICY IF EXISTS "Staff update" ON committee_meetings;
CREATE POLICY "Staff update" ON committee_meetings FOR UPDATE
    USING (has_club_perm(club_id, '{committee}', 'edit'))
    WITH CHECK (has_club_perm(club_id, '{committee}', 'edit')
                AND (event_id IS NULL OR EXISTS (SELECT 1 FROM events e WHERE e.id = event_id AND e.club_id = committee_meetings.club_id)));
DROP POLICY IF EXISTS "Staff delete" ON committee_meetings;
CREATE POLICY "Staff delete" ON committee_meetings FOR DELETE
    USING (has_club_perm(club_id, '{committee}', 'full'));

-- An action's meeting, the meeting that closed it and its owner must all be the same club's
DROP POLICY IF EXISTS "Staff read" ON committee_actions;
CREATE POLICY "Staff read" ON committee_actions FOR SELECT
    USING (has_club_perm(club_id, '{committee}', 'view'));
DROP POLICY IF EXISTS "Staff insert" ON committee_actions;
CREATE POLICY "Staff insert" ON committee_actions FOR INSERT
    WITH CHECK (has_club_perm(club_id, '{committee}', 'edit')
                AND EXISTS (SELECT 1 FROM committee_meetings m WHERE m.id = meeting_id AND m.club_id = committee_actions.club_id)
                AND (closed_in IS NULL OR EXISTS (SELECT 1 FROM committee_meetings m WHERE m.id = closed_in AND m.club_id = committee_actions.club_id))
                AND (owner_id IS NULL OR EXISTS (SELECT 1 FROM club_members cm WHERE cm.id = owner_id AND cm.club_id = committee_actions.club_id)));
DROP POLICY IF EXISTS "Staff update" ON committee_actions;
CREATE POLICY "Staff update" ON committee_actions FOR UPDATE
    USING (has_club_perm(club_id, '{committee}', 'edit'))
    WITH CHECK (has_club_perm(club_id, '{committee}', 'edit')
                AND EXISTS (SELECT 1 FROM committee_meetings m WHERE m.id = meeting_id AND m.club_id = committee_actions.club_id)
                AND (closed_in IS NULL OR EXISTS (SELECT 1 FROM committee_meetings m WHERE m.id = closed_in AND m.club_id = committee_actions.club_id))
                AND (owner_id IS NULL OR EXISTS (SELECT 1 FROM club_members cm WHERE cm.id = owner_id AND cm.club_id = committee_actions.club_id)));
DROP POLICY IF EXISTS "Staff delete" ON committee_actions;
CREATE POLICY "Staff delete" ON committee_actions FOR DELETE
    USING (has_club_perm(club_id, '{committee}', 'edit'));

REVOKE ALL ON committee_meetings, committee_actions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON committee_meetings, committee_actions TO authenticated;

-- A topic meeting's event: teams entered in its hosted cup and their entry fees, and tickets sold.
-- Each part is null unless the caller's role covers that area, so a gap never reads as a zero.
CREATE OR REPLACE FUNCTION committee_meeting_figures(p_club_id UUID, p_event_id UUID)
RETURNS JSONB
AS $$
DECLARE
    v_cups UUID[];
    v_entries JSONB;
    v_tickets JSONB;
BEGIN
    IF p_club_id IS NULL OR p_event_id IS NULL OR NOT has_club_perm(p_club_id, '{committee}', 'view')
       OR NOT EXISTS (SELECT 1 FROM events WHERE id = p_event_id AND club_id = p_club_id) THEN
        RETURN NULL;
    END IF;

    -- The event's hosted cup and its age groups (child tournaments)
    SELECT COALESCE(array_agg(t.id), '{}') INTO v_cups
      FROM tournaments t
     WHERE t.club_id = p_club_id
       AND (t.event_id = p_event_id OR t.parent_id IN (SELECT id FROM tournaments WHERE event_id = p_event_id AND club_id = p_club_id));

    IF cardinality(v_cups) > 0 AND has_club_perm(p_club_id, '{tournaments}', 'view') THEN
        SELECT jsonb_build_object(
                   'teams', (SELECT count(*) FROM tournament_participants p
                              WHERE p.tournament_id = ANY(v_cups) AND p.team_type = 'external'),
                   'submitted', (SELECT count(*) FROM tournament_entries te
                                  WHERE te.tournament_id = ANY(v_cups) AND te.status = 'submitted'),
                   'fees_paid', (SELECT count(*) FROM tournament_entries te JOIN payments pay ON pay.id = te.payment_id
                                  WHERE te.tournament_id = ANY(v_cups) AND pay.status = 'paid'),
                   'fees_cents', CASE WHEN has_club_perm(p_club_id, '{finance}', 'view') THEN
                                     (SELECT COALESCE(SUM(pay.amount_cents), 0) FROM tournament_entries te JOIN payments pay ON pay.id = te.payment_id
                                       WHERE te.tournament_id = ANY(v_cups) AND pay.status = 'paid') END,
                   'entry_deadline', (SELECT min(entry_deadline) FROM tournaments WHERE id = ANY(v_cups)))
          INTO v_entries;
    END IF;

    IF has_club_perm(p_club_id, '{events}', 'view') THEN
        SELECT jsonb_build_object(
                   'sold', (SELECT count(*) FROM event_attendees a
                             WHERE a.event_id = p_event_id AND a.payment_id IS NOT NULL AND a.checkin_status <> 'cancelled'),
                   'cents', CASE WHEN has_club_perm(p_club_id, '{finance}', 'view') THEN
                                (SELECT COALESCE(SUM(amount_cents), 0) FROM payments
                                  WHERE club_id = p_club_id AND event_id = p_event_id AND kind = 'event_ticket' AND status = 'paid') END)
          INTO v_tickets;
    END IF;

    RETURN jsonb_build_object('entries', v_entries, 'tickets', v_tickets);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION committee_meeting_figures(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION committee_meeting_figures(UUID, UUID) TO authenticated;

-- The saved minutes behind a share link, for anyone who has the link. Nothing else from the row.
CREATE OR REPLACE FUNCTION shared_committee_minutes(p_token TEXT)
RETURNS JSONB
AS $$
    SELECT jsonb_build_object(
               'report', m.share_report,
               'shared_at', m.shared_at,
               'club', jsonb_build_object('name', c.name, 'slug', c.slug, 'logo_url', c.logo_url, 'primary_color', c.primary_color))
      FROM committee_meetings m
      JOIN clubs c ON c.id = m.club_id
     WHERE p_token ~ '^[A-Za-z0-9]{32,64}$'
       AND m.share_token = p_token
       AND c.is_active;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION shared_committee_minutes(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION shared_committee_minutes(TEXT) TO anon, authenticated;
