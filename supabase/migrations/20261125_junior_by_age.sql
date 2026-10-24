-- ==============================================================================
-- Migration: a child counts as a junior by age or guardian, not only by team (PUB-B1)
-- Date: 2026-11-25
--
-- member_is_junior() decided who the public pages mask ("Mia P.", no photo without consent) and
-- leave out of public lists, but only looked at junior teams. A 12-year-old placed in the First Team
-- showed by full name. Now a member is a junior when any of these holds:
--   * they play in an active junior team (as before)
--   * their date of birth makes them under 18 (under 17 when the club has turned off "U18 teams
--     count as junior", clubs.junior_includes_u18)
--   * no date of birth is on file, but a parent / guardian is
-- Every view and policy that calls member_is_junior() follows (club_members_public,
-- player_availabilities_public, ...). Same rule as isJuniorMember in lib/teams.ts.
--
-- Safe to run more than once.
-- ==============================================================================

CREATE OR REPLACE FUNCTION member_is_junior(p_member_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1
          FROM club_team_members tm
          JOIN club_teams t ON t.id = tm.team_id
         WHERE tm.member_id = p_member_id
           AND tm.team_role = 'player'
           AND tm.is_active
           AND t.is_active
           AND t.is_junior
    ) OR EXISTS (
        SELECT 1
          FROM club_members m
          JOIN clubs c ON c.id = m.club_id
         WHERE m.id = p_member_id
           AND CASE
                 WHEN m.date_of_birth IS NOT NULL
                   THEN m.date_of_birth > CURRENT_DATE - make_interval(years => CASE WHEN COALESCE(c.junior_includes_u18, TRUE) THEN 18 ELSE 17 END)
                 ELSE COALESCE(NULLIF(trim(m.guardian_email), ''), NULLIF(trim(m.guardian_name), '')) IS NOT NULL
               END
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

NOTIFY pgrst, 'reload schema';
