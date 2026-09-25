-- ==============================================================================
-- Migration: squad role labels grant admin rights + lock down tournament tables
-- Date: 2026-10-05
--
-- 1. The squad screen saves roles as labels ('Player, Club Admin, Manager' in `role`,
--    ["Player","Club Admin","Manager"] in `roles`), but the admin checks only accepted the exact
--    values 'owner' / 'admin'. A member marked "Club Admin" therefore had no admin rights.
-- 2. The tournament tables (internal_teams, tournaments, tournament_participants) still had their
--    first policies: writable by anyone signed OUT (`auth.uid() IS NULL OR ...`), while a signed-in
--    club owner (clubs.owner_id) was refused. They now use is_club_admin() like every other table.
--
-- Safe to run more than once.
-- ==============================================================================

-- 1. Does this member row carry an admin label?
CREATE OR REPLACE FUNCTION member_is_admin(p_role TEXT, p_roles JSONB)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM unnest(string_to_array(lower(COALESCE(p_role, '')), ',')) r
         WHERE trim(r) IN ('owner', 'admin', 'club admin')
    ) OR EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(
            CASE WHEN jsonb_typeof(p_roles) = 'array' THEN p_roles ELSE '[]'::jsonb END
        ) r
         WHERE lower(trim(r)) IN ('owner', 'admin', 'club admin')
    );
$$ LANGUAGE sql IMMUTABLE;

-- Same signatures as before, so every policy that calls them picks this up
CREATE OR REPLACE FUNCTION is_club_admin(p_club_id UUID)
RETURNS BOOLEAN AS $$
    SELECT auth.uid() IS NOT NULL AND (
        EXISTS (SELECT 1 FROM clubs c WHERE c.id = p_club_id AND c.owner_id = auth.uid())
        OR EXISTS (
            SELECT 1 FROM club_members m
             WHERE m.club_id = p_club_id
               AND m.user_id = auth.uid()
               AND member_is_admin(m.role, m.roles)
        )
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION is_any_club_admin()
RETURNS BOOLEAN AS $$
    SELECT auth.uid() IS NOT NULL AND (
        EXISTS (SELECT 1 FROM clubs c WHERE c.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM club_members m WHERE m.user_id = auth.uid() AND member_is_admin(m.role, m.roles))
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- 2. Tournament tables: public read stays, writes for club admins / owners only
DROP POLICY IF EXISTS "Club admin internal_teams manage" ON internal_teams;
CREATE POLICY "Club admin internal_teams manage" ON internal_teams FOR ALL
    USING (is_club_admin(club_id)) WITH CHECK (is_club_admin(club_id));

DROP POLICY IF EXISTS "Club admin tournaments manage" ON tournaments;
CREATE POLICY "Club admin tournaments manage" ON tournaments FOR ALL
    USING (is_club_admin(club_id)) WITH CHECK (is_club_admin(club_id));

DROP POLICY IF EXISTS "Club admin tournament_participants manage" ON tournament_participants;
CREATE POLICY "Club admin tournament_participants manage" ON tournament_participants FOR ALL
    USING (is_club_admin((SELECT t.club_id FROM tournaments t WHERE t.id = tournament_participants.tournament_id)))
    WITH CHECK (is_club_admin((SELECT t.club_id FROM tournaments t WHERE t.id = tournament_participants.tournament_id)));

NOTIFY pgrst, 'reload schema';
