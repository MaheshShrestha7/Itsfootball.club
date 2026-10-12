-- ==============================================================================
-- Migration: applicants pick the team they want to join
-- Date: 2026-11-01
--
-- Phase 2 of multiple teams per club. When a club has several teams, the membership form asks a
-- player which team they're joining (e.g. U10). It is stored on the application; when the
-- application is approved the player joins that team instead of the club's main team.
-- A team id from another club, or one that was deleted or made inactive, falls back to the main
-- team as before (20261031_club_teams.sql).
--
-- Also:
--   * Saving a squad row that already exists under another id (e.g. the database put a newly
--     approved player in a team a moment before an admin ticked them in the same team) replaces
--     the old row instead of failing, so the app's copy and the database agree.
--   * club_teams and club_team_members join the realtime publication, so squad changes made by
--     the database or another admin show up in open admin screens without a reload. Realtime
--     applies row-level security: visitors receive nothing.
--
-- Safe to run more than once.
-- ==============================================================================

ALTER TABLE club_members
    ADD COLUMN IF NOT EXISTS requested_team_id UUID REFERENCES club_teams(id) ON DELETE SET NULL;

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
    -- The team they asked for, if it is an active team of this club; else the main team
    SELECT id INTO v_team FROM club_teams
     WHERE id = NEW.requested_team_id AND club_id = NEW.club_id AND is_active;
    v_team := COALESCE(v_team, club_default_team(NEW.club_id));
    IF v_team IS NOT NULL THEN
        INSERT INTO club_team_members (club_id, team_id, member_id, team_role, jersey_number)
        VALUES (NEW.club_id, v_team, NEW.id, 'player', NEW.jersey_number)
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Team and member must be from the same club; club_id always follows the team. A row for the same
-- team, member and role under another id is replaced (row-level security still applies to the
-- insert itself: if it is refused, the whole statement and this delete roll back).
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
    IF TG_OP = 'INSERT' THEN
        DELETE FROM club_team_members
         WHERE team_id = NEW.team_id AND member_id = NEW.member_id AND team_role = NEW.team_role AND id <> NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['club_teams', 'club_team_members'] LOOP
        IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
           AND NOT EXISTS (SELECT 1 FROM pg_publication_tables
                           WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
        END IF;
    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
