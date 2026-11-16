-- ==============================================================================
-- Migration: Wrapping up an event (Completed, the committee's notes, a shared summary)
--
-- Once an event is over, the committee can mark it Completed and write up how it went.
--   * events gains completed_at and completed_by_name. Events are public, and that is on
--     purpose: a completed event shows under Past events on the club site and stops selling
--     tickets. Reopening clears both.
--   * event_reviews: one private row per event with the committee's notes (what went well,
--     what to change next time) and, when they share it, a saved copy of the summary behind a
--     link. Only staff with the Events area read or write it.
--   * shared_event_report(token) hands that saved copy, with the club's name and colours, to
--     anyone who has the link. It is the only way in: the table itself stays staff-only.
-- The app hides Mark as completed and the summary's notes and Share until this has run.
--
-- Safe to run more than once.
-- ==============================================================================

ALTER TABLE events ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS completed_by_name TEXT;

CREATE TABLE IF NOT EXISTS event_reviews (
    event_id UUID PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    went_well TEXT NOT NULL DEFAULT '' CHECK (char_length(went_well) <= 2000),
    next_time TEXT NOT NULL DEFAULT '' CHECK (char_length(next_time) <= 2000),
    updated_by_name TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    share_token TEXT,
    share_report JSONB,
    shared_at TIMESTAMPTZ,
    -- A token is all or nothing: long enough that it can't be guessed, and always with its report
    CONSTRAINT event_reviews_share_shape CHECK (
        (share_token IS NULL AND share_report IS NULL)
        OR (share_token ~ '^[A-Za-z0-9]{32,64}$' AND jsonb_typeof(share_report) = 'object' AND pg_column_size(share_report) < 200000)
    )
);

CREATE INDEX IF NOT EXISTS idx_event_reviews_club ON event_reviews(club_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_reviews_share_token ON event_reviews(share_token) WHERE share_token IS NOT NULL;

ALTER TABLE event_reviews ENABLE ROW LEVEL SECURITY;

-- The row must belong to the club that owns the event, so one club can't attach notes to another's
DROP POLICY IF EXISTS "Staff read" ON event_reviews;
CREATE POLICY "Staff read" ON event_reviews FOR SELECT
    USING (has_club_perm(club_id, '{events}', 'view'));

DROP POLICY IF EXISTS "Staff insert" ON event_reviews;
CREATE POLICY "Staff insert" ON event_reviews FOR INSERT
    WITH CHECK (has_club_perm(club_id, '{events}', 'edit')
                AND EXISTS (SELECT 1 FROM events e WHERE e.id = event_id AND e.club_id = event_reviews.club_id));

DROP POLICY IF EXISTS "Staff update" ON event_reviews;
CREATE POLICY "Staff update" ON event_reviews FOR UPDATE
    USING (has_club_perm(club_id, '{events}', 'edit'))
    WITH CHECK (has_club_perm(club_id, '{events}', 'edit')
                AND EXISTS (SELECT 1 FROM events e WHERE e.id = event_id AND e.club_id = event_reviews.club_id));

DROP POLICY IF EXISTS "Staff delete" ON event_reviews;
CREATE POLICY "Staff delete" ON event_reviews FOR DELETE
    USING (has_club_perm(club_id, '{events}', 'full'));

-- Signed-in staff only: nothing for anon
REVOKE ALL ON event_reviews FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON event_reviews TO authenticated;

-- The saved copy behind a share link, for anyone who has the link. Nothing else from the row.
CREATE OR REPLACE FUNCTION shared_event_report(p_token TEXT)
RETURNS JSONB
AS $$
    SELECT jsonb_build_object(
               'report', r.share_report,
               'shared_at', r.shared_at,
               'club', jsonb_build_object('name', c.name, 'slug', c.slug, 'logo_url', c.logo_url, 'primary_color', c.primary_color))
      FROM event_reviews r
      JOIN clubs c ON c.id = r.club_id
     WHERE p_token ~ '^[A-Za-z0-9]{32,64}$'
       AND r.share_token = p_token
       AND c.is_active;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION shared_event_report(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION shared_event_report(TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
