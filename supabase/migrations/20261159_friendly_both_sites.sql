-- ==============================================================================
-- Migration: friendly invitations, part 3 (the game on both clubs' sites)
--
--     contact_inquiries.visitor_club_id  the club the invitation came from, when the person who sent
--                                        it is an admin there (checked by /api/contact). Set by the
--                                        server only.
--     fixture_offers                     a fixture one club offers to the other club's site. The
--                                        other club's admin picks their team and adds it; the server
--                                        makes their copy. Written by the server only.
--     matches.linked_match_id            the other club's copy of the same game. Both rows point at
--                                        each other; set by the server only.
--     sync_linked_match()                when one copy's date, time, ground, status, score or live
--                                        clock changes, the other copy follows. Line-ups, goals and
--                                        cards stay each club's own.
--
-- Run after 20261158 (and the grounds and match length migrations, 20261110 and 20261151).
-- Safe to run again.
-- ==============================================================================

DO $$
BEGIN
    IF (SELECT count(*) FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'matches'
           AND column_name IN ('half_minutes', 'ground_id', 'pitch_label', 'is_paused', 'period_started_at')) < 5 THEN
        RAISE EXCEPTION 'Run 20261110_grounds_phase2.sql and 20261151_match_half_length.sql first';
    END IF;
END $$;

ALTER TABLE contact_inquiries ADD COLUMN IF NOT EXISTS visitor_club_id UUID REFERENCES clubs(id) ON DELETE SET NULL;

ALTER TABLE matches ADD COLUMN IF NOT EXISTS linked_match_id UUID REFERENCES matches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_matches_linked ON matches (linked_match_id) WHERE linked_match_id IS NOT NULL;

-- The public can't claim to be from a club (the server checks the sender is an admin there)
DROP POLICY IF EXISTS "Public contact submit" ON contact_inquiries;
CREATE POLICY "Public contact submit" ON contact_inquiries FOR INSERT
    WITH CHECK (
        status = 'unread'
        AND char_length(message) BETWEEN 1 AND 4000
        AND char_length(sender_name) BETWEEN 1 AND 255
        AND EXISTS (SELECT 1 FROM clubs c WHERE c.id = club_id AND c.is_active)
        AND match_id IS NULL
        AND response_token IS NULL
        AND visitor_club_id IS NULL
        -- Suggested and picked dates, what was emailed and the sending club's logo are written by the server only
        AND (details IS NULL OR NOT (details ?| ARRAY['suggested', 'picked', 'sent', 'crest_url']))
        AND (
            (inquiry_type <> 'Friendly Match' AND details IS NULL AND team_id IS NULL)
            OR (
                inquiry_type = 'Friendly Match'
                AND details IS NOT NULL
                AND EXISTS (
                    SELECT 1 FROM club_teams t
                    WHERE t.id = team_id AND t.club_id = contact_inquiries.club_id
                      AND t.is_active AND t.open_to_friendlies
                )
            )
        )
    );

-- ------------------------------------------------------------------------------
-- Offers
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fixture_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    from_match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    to_club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    inquiry_id UUID REFERENCES contact_inquiries(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'declined')),
    to_match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    answered_at TIMESTAMPTZ,
    CONSTRAINT fixture_offers_two_clubs CHECK (from_club_id <> to_club_id),
    CONSTRAINT fixture_offers_once UNIQUE (from_match_id, to_club_id)
);
CREATE INDEX IF NOT EXISTS idx_fixture_offers_to ON fixture_offers (to_club_id, status);

ALTER TABLE fixture_offers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Clubs read their fixture offers" ON fixture_offers;
CREATE POLICY "Clubs read their fixture offers" ON fixture_offers FOR SELECT
    USING (has_club_perm(to_club_id, ARRAY['matches'], 'view') OR has_club_perm(from_club_id, ARRAY['matches'], 'view'));
-- No insert, update or delete policies: /api/admin/fixture-offers does that with the service role

-- ------------------------------------------------------------------------------
-- Only the server links two fixtures (a club could otherwise point its game at another club's)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION guard_linked_match() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
    IF NEW.linked_match_id IS NOT NULL
       AND (TG_OP = 'INSERT' OR NEW.linked_match_id IS DISTINCT FROM OLD.linked_match_id)
       AND current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
        RAISE EXCEPTION 'Only the server can link a fixture to another club''s copy';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS matches_guard_linked ON matches;
CREATE TRIGGER matches_guard_linked BEFORE INSERT OR UPDATE OF linked_match_id ON matches
    FOR EACH ROW EXECUTE FUNCTION guard_linked_match();

-- ------------------------------------------------------------------------------
-- Keep both copies of the game in step
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_linked_match() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    -- The copy's own update fires this again one level down: stop there
    IF NEW.linked_match_id IS NULL OR pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;
    IF (NEW.match_date, NEW.match_time, NEW.venue, NEW.status, NEW.home_score, NEW.away_score,
        NEW.period, NEW.current_minute, NEW.period_started_at, NEW.is_paused, NEW.added_time,
        NEW.half_minutes, NEW.ground_id, NEW.pitch_label)
       IS NOT DISTINCT FROM
       (OLD.match_date, OLD.match_time, OLD.venue, OLD.status, OLD.home_score, OLD.away_score,
        OLD.period, OLD.current_minute, OLD.period_started_at, OLD.is_paused, OLD.added_time,
        OLD.half_minutes, OLD.ground_id, OLD.pitch_label) THEN
        RETURN NEW;
    END IF;
    -- Both copies name the same home side, so the scores carry over as they are
    UPDATE matches m SET
        match_date = NEW.match_date,
        match_time = NEW.match_time,
        venue = NEW.venue,
        status = NEW.status,
        home_score = NEW.home_score,
        away_score = NEW.away_score,
        period = NEW.period,
        current_minute = NEW.current_minute,
        period_started_at = NEW.period_started_at,
        is_paused = NEW.is_paused,
        added_time = NEW.added_time,
        half_minutes = NEW.half_minutes,
        ground_id = NEW.ground_id,
        pitch_label = NEW.pitch_label,
        updated_at = NOW()
    WHERE m.id = NEW.linked_match_id
      AND m.linked_match_id = NEW.id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS matches_sync_linked ON matches;
CREATE TRIGGER matches_sync_linked AFTER UPDATE ON matches
    FOR EACH ROW EXECUTE FUNCTION sync_linked_match();

COMMENT ON COLUMN contact_inquiries.visitor_club_id IS 'The club the friendly invitation came from (sender checked as its admin)';
COMMENT ON COLUMN matches.linked_match_id IS 'The other club''s copy of the same friendly (kept in step by sync_linked_match)';
COMMENT ON TABLE fixture_offers IS 'A fixture one club offers to the other club''s site';

NOTIFY pgrst, 'reload schema';
