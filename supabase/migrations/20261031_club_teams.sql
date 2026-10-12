-- ==============================================================================
-- Migration: club teams (first team, reserves, academy, youth age groups)
-- Date: 2026-10-31
--
-- Phase 1 of multiple teams per club. A club can now hold several squads: First Team, Reserves,
-- Academy, U7 ... U18, Women, Veterans. A member can belong to more than one team (a reserve who
-- also plays for the first team, a parent who coaches the U8s).
--
-- Nothing visible changes yet:
--   * every club gets one default "First Team"
--   * its existing fixtures (not internal or tournament matches), player stats and active players
--     are put in that team
--   * new fixtures and stats with no team go to the default team, and a member who becomes an
--     approved player joins it, so the data stays complete until the admin screens can pick a team
--   * team_id is nullable everywhere; NULL on news, gallery, events and membership plans means
--     "the whole club", exactly as before
--
-- These are separate from internal_teams, which stay the sides used for tournaments and internal
-- matches.
--
-- Safe to run more than once.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Teams
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS club_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL CHECK (length(trim(name)) > 0),
    short_name VARCHAR(32),
    slug VARCHAR(128) NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    team_type VARCHAR(16) NOT NULL DEFAULT 'senior'
        CHECK (team_type IN ('senior', 'reserve', 'academy', 'youth', 'women', 'veterans', 'other')),
    age_group VARCHAR(8) CHECK (age_group ~ '^U([5-9]|1[0-9]|2[0-3])$'), -- U5 ... U23, NULL = open age
    gender VARCHAR(8) NOT NULL DEFAULT 'mixed' CHECK (gender IN ('mixed', 'boys', 'girls', 'men', 'women')),
    is_junior BOOLEAN NOT NULL DEFAULT FALSE,          -- kids' team: safeguarding rules apply (later phase)
    hide_public_scores BOOLEAN NOT NULL DEFAULT FALSE, -- grassroots youth: no public scores or tables
    match_format VARCHAR(8) NOT NULL DEFAULT '11v11' CHECK (match_format IN ('5v5', '7v7', '9v9', '11v11')),
    color VARCHAR(32),
    logo_url TEXT,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 100,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,         -- the club's main team; fixtures with no team go here
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_club_teams_club ON club_teams (club_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_club_teams_slug ON club_teams (club_id, slug);
CREATE UNIQUE INDEX IF NOT EXISTS uq_club_teams_default ON club_teams (club_id) WHERE is_default;

-- ------------------------------------------------------------------------------
-- 2. Who is in each team, and in what capacity
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS club_team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE, -- copied from the team, for RLS
    team_id UUID NOT NULL REFERENCES club_teams(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES club_members(id) ON DELETE CASCADE,
    team_role VARCHAR(16) NOT NULL DEFAULT 'player'
        CHECK (team_role IN ('player', 'coach', 'assistant', 'manager', 'physio', 'other')),
    jersey_number INTEGER CHECK (jersey_number IS NULL OR jersey_number BETWEEN 0 AND 999),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (team_id, member_id, team_role)
);

CREATE INDEX IF NOT EXISTS idx_club_team_members_club ON club_team_members (club_id);
CREATE INDEX IF NOT EXISTS idx_club_team_members_member ON club_team_members (member_id);

-- Team and member must be from the same club; club_id always follows the team
CREATE OR REPLACE FUNCTION club_team_members_check()
RETURNS TRIGGER AS $$
DECLARE
    v_team_club UUID;
BEGIN
    SELECT club_id INTO v_team_club FROM club_teams WHERE id = NEW.team_id;
    IF v_team_club IS NULL OR NOT EXISTS (
        SELECT 1 FROM club_members WHERE id = NEW.member_id AND club_id = v_team_club
    ) THEN
        RAISE EXCEPTION 'The team and the member must belong to the same club' USING ERRCODE = '23514';
    END IF;
    NEW.club_id := v_team_club;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_club_team_members_check ON club_team_members;
CREATE TRIGGER trg_club_team_members_check BEFORE INSERT OR UPDATE ON club_team_members
    FOR EACH ROW EXECUTE FUNCTION club_team_members_check();

-- ------------------------------------------------------------------------------
-- 3. team_id on the tables that can belong to one team
--    (availability and lineups follow their match, so they need no column)
-- ------------------------------------------------------------------------------
ALTER TABLE matches          ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES club_teams(id) ON DELETE SET NULL;
ALTER TABLE player_stats     ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES club_teams(id) ON DELETE SET NULL;
ALTER TABLE events           ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES club_teams(id) ON DELETE SET NULL;
ALTER TABLE news_articles    ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES club_teams(id) ON DELETE SET NULL;
ALTER TABLE media_gallery    ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES club_teams(id) ON DELETE SET NULL;
ALTER TABLE membership_plans ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES club_teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_matches_team ON matches (team_id);
CREATE INDEX IF NOT EXISTS idx_player_stats_team ON player_stats (team_id);
CREATE INDEX IF NOT EXISTS idx_events_team ON events (team_id);
CREATE INDEX IF NOT EXISTS idx_news_articles_team ON news_articles (team_id);
CREATE INDEX IF NOT EXISTS idx_media_gallery_team ON media_gallery (team_id);
CREATE INDEX IF NOT EXISTS idx_membership_plans_team ON membership_plans (team_id);

-- A row can only point at a team of its own club
CREATE OR REPLACE FUNCTION check_row_team_club()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.team_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM club_teams WHERE id = NEW.team_id AND club_id = NEW.club_id
    ) THEN
        RAISE EXCEPTION 'That team belongs to another club' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['matches', 'player_stats', 'events', 'news_articles', 'media_gallery', 'membership_plans'] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_check_team_club ON %I', t);
        EXECUTE format('CREATE TRIGGER trg_check_team_club BEFORE INSERT OR UPDATE OF team_id, club_id ON %I
                        FOR EACH ROW EXECUTE FUNCTION check_row_team_club()', t);
    END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 4. Default team: one per club, now and for every new club
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION club_default_team(p_club_id UUID)
RETURNS UUID AS $$
    SELECT id FROM club_teams WHERE club_id = p_club_id AND is_default LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION club_default_team(UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION seed_club_default_team(p_club_id UUID)
RETURNS UUID AS $$
DECLARE
    v_id UUID := club_default_team(p_club_id);
BEGIN
    IF v_id IS NULL THEN
        INSERT INTO club_teams (club_id, name, short_name, slug, team_type, sort_order, is_default)
        VALUES (p_club_id, 'First Team', '1st', 'first-team', 'senior', 0, TRUE)
        ON CONFLICT DO NOTHING
        RETURNING id INTO v_id;
        -- A team called first-team already exists but isn't the default: make it the default
        IF v_id IS NULL THEN
            UPDATE club_teams SET is_default = TRUE
             WHERE club_id = p_club_id AND slug = 'first-team'
            RETURNING id INTO v_id;
        END IF;
    END IF;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION trg_seed_club_default_team()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM seed_club_default_team(NEW.id);
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_clubs_seed_default_team ON clubs;
CREATE TRIGGER trg_clubs_seed_default_team AFTER INSERT ON clubs
    FOR EACH ROW EXECUTE FUNCTION trg_seed_club_default_team();

SELECT seed_club_default_team(id) FROM clubs;

-- The default team can't be deleted (the club would lose where its fixtures live)
CREATE OR REPLACE FUNCTION guard_club_default_team()
RETURNS TRIGGER AS $$
BEGIN
    IF current_user IN ('authenticated', 'anon') AND OLD.is_default
       AND EXISTS (SELECT 1 FROM clubs WHERE id = OLD.club_id) THEN
        RAISE EXCEPTION 'The club''s main team can''t be deleted. Make another team the main team first.'
            USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_guard_club_default_team ON club_teams;
CREATE TRIGGER trg_guard_club_default_team BEFORE DELETE ON club_teams
    FOR EACH ROW EXECUTE FUNCTION guard_club_default_team();

-- ------------------------------------------------------------------------------
-- 5. Backfill the default team
-- ------------------------------------------------------------------------------
-- Fixtures: everything except internal matches and tournament matches (those are the club's own
-- sides and stay club-wide)
UPDATE matches m SET team_id = club_default_team(m.club_id)
 WHERE m.team_id IS NULL
   AND m.tournament_id IS NULL
   AND COALESCE(m.match_type, 'friendly') <> 'internal';

UPDATE player_stats s SET team_id = club_default_team(s.club_id)
 WHERE s.team_id IS NULL;

-- Is this member someone who should be in a squad? Approved, not alumni, labelled as a player
CREATE OR REPLACE FUNCTION member_is_squad_player(p_status TEXT, p_membership_status TEXT, p_role TEXT, p_roles JSONB)
RETURNS BOOLEAN AS $$
    SELECT COALESCE(p_membership_status, 'approved') = 'approved'
       AND COALESCE(p_status, 'active') <> 'alumni'
       AND 'player' = ANY (member_labels(COALESCE(p_role, 'player'), p_roles));
$$ LANGUAGE sql IMMUTABLE;

INSERT INTO club_team_members (club_id, team_id, member_id, team_role, jersey_number)
SELECT m.club_id, club_default_team(m.club_id), m.id, 'player', m.jersey_number
  FROM club_members m
 WHERE member_is_squad_player(m.status, m.membership_status, m.role, m.roles)
   AND club_default_team(m.club_id) IS NOT NULL
   AND NOT EXISTS (
       SELECT 1 FROM club_team_members tm WHERE tm.member_id = m.id AND tm.team_role = 'player'
   )
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------------------------
-- 6. Keep the default team filled until the admin screens can pick a team
-- ------------------------------------------------------------------------------
-- New fixtures and stats with no team go to the default team
CREATE OR REPLACE FUNCTION default_match_team()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.team_id IS NULL AND NEW.tournament_id IS NULL AND COALESCE(NEW.match_type, 'friendly') <> 'internal' THEN
        NEW.team_id := club_default_team(NEW.club_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION default_stats_team()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.team_id IS NULL THEN
        NEW.team_id := club_default_team(NEW.club_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_default_team ON matches;
CREATE TRIGGER trg_default_team BEFORE INSERT ON matches
    FOR EACH ROW EXECUTE FUNCTION default_match_team();
DROP TRIGGER IF EXISTS trg_default_team ON player_stats;
CREATE TRIGGER trg_default_team BEFORE INSERT ON player_stats
    FOR EACH ROW EXECUTE FUNCTION default_stats_team();

-- A member who becomes an approved player and is in no squad yet joins the default team
CREATE OR REPLACE FUNCTION add_new_player_to_default_team()
RETURNS TRIGGER AS $$
DECLARE
    v_team UUID;
BEGIN
    IF NOT member_is_squad_player(NEW.status, NEW.membership_status, NEW.role, NEW.roles) THEN
        RETURN NULL;
    END IF;
    -- Only when they newly qualify, so a later edit doesn't undo the admin taking them out
    IF TG_OP = 'UPDATE' AND member_is_squad_player(OLD.status, OLD.membership_status, OLD.role, OLD.roles) THEN
        RETURN NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM club_team_members WHERE member_id = NEW.id AND team_role = 'player') THEN
        RETURN NULL;
    END IF;
    v_team := club_default_team(NEW.club_id);
    IF v_team IS NOT NULL THEN
        INSERT INTO club_team_members (club_id, team_id, member_id, team_role, jersey_number)
        VALUES (NEW.club_id, v_team, NEW.id, 'player', NEW.jersey_number)
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_add_new_player_to_default_team ON club_members;
CREATE TRIGGER trg_add_new_player_to_default_team
    AFTER INSERT OR UPDATE OF membership_status, status, role, roles ON club_members
    FOR EACH ROW EXECUTE FUNCTION add_new_player_to_default_team();

-- ------------------------------------------------------------------------------
-- 7. Access
-- ------------------------------------------------------------------------------
ALTER TABLE club_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_team_members ENABLE ROW LEVEL SECURITY;

-- Active teams are public, like fixtures
DROP POLICY IF EXISTS "Public club_teams read" ON club_teams;
CREATE POLICY "Public club_teams read" ON club_teams FOR SELECT USING (is_active = TRUE);

-- Staff, per admin area (same scheme as 20261023_access_roles.sql)
DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN SELECT * FROM (VALUES
        ('club_teams',        '{teams,squad,members,matches,match-center,lineup,availability,tournaments,events,content,gallery,finance}', '{teams}',       '{teams}'),
        ('club_team_members', '{teams,squad,members,matches,match-center,lineup,availability}',                                         '{teams,squad}', '{teams,squad}')
    ) AS v(tbl, read_areas, write_areas, delete_areas)
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Staff read" ON %I', t.tbl);
        EXECUTE format('CREATE POLICY "Staff read" ON %I FOR SELECT USING (has_club_perm(club_id, %L, ''view''))',
                       t.tbl, t.read_areas);
        EXECUTE format('DROP POLICY IF EXISTS "Staff insert" ON %I', t.tbl);
        EXECUTE format('CREATE POLICY "Staff insert" ON %I FOR INSERT WITH CHECK (has_club_perm(club_id, %L, ''edit''))',
                       t.tbl, t.write_areas);
        EXECUTE format('DROP POLICY IF EXISTS "Staff update" ON %I', t.tbl);
        EXECUTE format('CREATE POLICY "Staff update" ON %I FOR UPDATE USING (has_club_perm(club_id, %L, ''edit'')) WITH CHECK (has_club_perm(club_id, %L, ''edit''))',
                       t.tbl, t.write_areas, t.write_areas);
        EXECUTE format('DROP POLICY IF EXISTS "Staff delete" ON %I', t.tbl);
        EXECUTE format('CREATE POLICY "Staff delete" ON %I FOR DELETE USING (has_club_perm(club_id, %L, ''full''))',
                       t.tbl, t.delete_areas);
    END LOOP;
END $$;

-- Public squad lists per team: approved members of active, non-junior teams only. Junior squads
-- stay staff-only until the safeguarding rules for them are in place.
CREATE OR REPLACE VIEW club_team_members_public AS
    SELECT tm.id, tm.club_id, tm.team_id, tm.member_id, tm.team_role, tm.jersey_number
      FROM club_team_members tm
      JOIN club_teams t ON t.id = tm.team_id
      JOIN club_members m ON m.id = tm.member_id
     WHERE tm.is_active
       AND t.is_active
       AND NOT t.is_junior
       AND COALESCE(m.membership_status, 'approved') = 'approved';

GRANT SELECT ON club_team_members_public TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
