-- ==============================================================================
-- Migration: Match reviews (the coach's notes after a game)
--
-- After the player stats are saved a coach answers three questions about the game: what went well,
-- what to work on, and notes for next week. A cup, event or tournament then has a review page that
-- gathers every game's answers, plus one summary the coach writes for the whole cup.
--   * match_reviews: one row per fixture.
--   * cup_reviews: one summary per event or tournament, per club team (team_key is the club team's
--     id for an event, the tournament entry's id for a tournament, '' when there is only one).
-- Both are private: matches, their events and a published line-up can be read by anyone, so the
-- notes get their own tables. Only staff with the Lineups or Match Centre area read or write them.
-- Players and the public never do.
-- The app hides the review buttons until this has run.
--
-- Safe to run more than once.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS match_reviews (
    match_id UUID PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    went_well TEXT NOT NULL DEFAULT '' CHECK (char_length(went_well) <= 2000),
    work_on TEXT NOT NULL DEFAULT '' CHECK (char_length(work_on) <= 2000),
    next_week TEXT NOT NULL DEFAULT '' CHECK (char_length(next_week) <= 2000),
    updated_by_name TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_match_reviews_club ON match_reviews(club_id);

CREATE TABLE IF NOT EXISTS cup_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    team_key TEXT NOT NULL DEFAULT '' CHECK (char_length(team_key) <= 64),
    summary TEXT NOT NULL DEFAULT '' CHECK (char_length(summary) <= 4000),
    updated_by_name TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT cup_reviews_one_cup CHECK ((event_id IS NULL) <> (tournament_id IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cup_reviews_event ON cup_reviews(event_id, team_key) WHERE event_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_cup_reviews_tournament ON cup_reviews(tournament_id, team_key) WHERE tournament_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cup_reviews_club ON cup_reviews(club_id);

ALTER TABLE match_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE cup_reviews ENABLE ROW LEVEL SECURITY;

-- match_reviews: the row must belong to the club that owns the fixture, so one club can't write
-- over (or attach notes to) another club's game
DROP POLICY IF EXISTS "Staff read" ON match_reviews;
CREATE POLICY "Staff read" ON match_reviews FOR SELECT
    USING (has_club_perm(club_id, '{lineup,match-center}', 'view'));

DROP POLICY IF EXISTS "Staff insert" ON match_reviews;
CREATE POLICY "Staff insert" ON match_reviews FOR INSERT
    WITH CHECK (has_club_perm(club_id, '{lineup,match-center}', 'edit')
                AND EXISTS (SELECT 1 FROM matches m WHERE m.id = match_id AND m.club_id = match_reviews.club_id));

DROP POLICY IF EXISTS "Staff update" ON match_reviews;
CREATE POLICY "Staff update" ON match_reviews FOR UPDATE
    USING (has_club_perm(club_id, '{lineup,match-center}', 'edit'))
    WITH CHECK (has_club_perm(club_id, '{lineup,match-center}', 'edit')
                AND EXISTS (SELECT 1 FROM matches m WHERE m.id = match_id AND m.club_id = match_reviews.club_id));

DROP POLICY IF EXISTS "Staff delete" ON match_reviews;
CREATE POLICY "Staff delete" ON match_reviews FOR DELETE
    USING (has_club_perm(club_id, '{lineup,match-center}', 'full'));

-- cup_reviews: the event or tournament must be the same club's
DROP POLICY IF EXISTS "Staff read" ON cup_reviews;
CREATE POLICY "Staff read" ON cup_reviews FOR SELECT
    USING (has_club_perm(club_id, '{lineup,match-center}', 'view'));

DROP POLICY IF EXISTS "Staff insert" ON cup_reviews;
CREATE POLICY "Staff insert" ON cup_reviews FOR INSERT
    WITH CHECK (has_club_perm(club_id, '{lineup,match-center}', 'edit')
                AND (EXISTS (SELECT 1 FROM events e WHERE e.id = event_id AND e.club_id = cup_reviews.club_id)
                     OR EXISTS (SELECT 1 FROM tournaments t WHERE t.id = tournament_id AND t.club_id = cup_reviews.club_id)));

DROP POLICY IF EXISTS "Staff update" ON cup_reviews;
CREATE POLICY "Staff update" ON cup_reviews FOR UPDATE
    USING (has_club_perm(club_id, '{lineup,match-center}', 'edit'))
    WITH CHECK (has_club_perm(club_id, '{lineup,match-center}', 'edit')
                AND (EXISTS (SELECT 1 FROM events e WHERE e.id = event_id AND e.club_id = cup_reviews.club_id)
                     OR EXISTS (SELECT 1 FROM tournaments t WHERE t.id = tournament_id AND t.club_id = cup_reviews.club_id)));

DROP POLICY IF EXISTS "Staff delete" ON cup_reviews;
CREATE POLICY "Staff delete" ON cup_reviews FOR DELETE
    USING (has_club_perm(club_id, '{lineup,match-center}', 'full'));

-- Signed-in staff only: nothing for anon
REVOKE ALL ON match_reviews, cup_reviews FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON match_reviews, cup_reviews TO authenticated;

NOTIFY pgrst, 'reload schema';
