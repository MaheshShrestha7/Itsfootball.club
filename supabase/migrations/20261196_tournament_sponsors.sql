-- ==============================================================================
-- Migration: a tournament's own sponsors
-- Date: 2026-11-28
--
-- A hosted tournament keeps its own list of sponsors, separate from the club's sponsors: each has a
-- category (platinum, gold, silver, bronze, media, partner, or the host's own words), a placement
-- ('title': the one main sponsor, "<sponsor> presents" above the tournament name; 'header': the strip
-- under the tournament header; 'list': the list only; every shown sponsor is also in the list) and an order.
-- Everything in a row is shown on the public tournament page, so anyone can read the active ones;
-- only the club's Tournaments editors can add, change or remove them.
-- Until this runs the Sponsors tab stays hidden and nothing changes.
--
-- Safe to run more than once.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS tournament_sponsors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
    logo_url TEXT,
    website_url TEXT CHECK (website_url IS NULL OR website_url ~* '^https?://'),
    category VARCHAR(40) NOT NULL DEFAULT 'partner' CHECK (char_length(trim(category)) BETWEEN 1 AND 40),
    placement VARCHAR(10) NOT NULL DEFAULT 'list' CHECK (placement IN ('title', 'header', 'list')),
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tournament_sponsors_tournament ON tournament_sponsors (tournament_id, display_order);
-- One main sponsor per tournament
CREATE UNIQUE INDEX IF NOT EXISTS uq_tournament_sponsors_title ON tournament_sponsors (tournament_id) WHERE placement = 'title';

-- club_id always comes from the tournament, so a row can't be filed under another club
CREATE OR REPLACE FUNCTION tournament_sponsor_fill()
RETURNS TRIGGER AS $$
BEGIN
    SELECT t.club_id INTO NEW.club_id FROM tournaments t WHERE t.id = NEW.tournament_id;
    IF NEW.club_id IS NULL THEN
        RAISE EXCEPTION 'Unknown tournament';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tournament_sponsors_fill ON tournament_sponsors;
CREATE TRIGGER tournament_sponsors_fill BEFORE INSERT OR UPDATE ON tournament_sponsors
    FOR EACH ROW EXECUTE FUNCTION tournament_sponsor_fill();

ALTER TABLE tournament_sponsors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads shown tournament sponsors" ON tournament_sponsors;
CREATE POLICY "Anyone reads shown tournament sponsors" ON tournament_sponsors FOR SELECT TO anon, authenticated
    USING (is_active = TRUE);

DROP POLICY IF EXISTS "Staff manage tournament sponsors" ON tournament_sponsors;
CREATE POLICY "Staff manage tournament sponsors" ON tournament_sponsors FOR ALL TO authenticated
    USING (has_club_perm(club_id, '{tournaments}', 'edit'))
    WITH CHECK (has_club_perm(club_id, '{tournaments}', 'edit'));

GRANT SELECT ON tournament_sponsors TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON tournament_sponsors TO authenticated;
