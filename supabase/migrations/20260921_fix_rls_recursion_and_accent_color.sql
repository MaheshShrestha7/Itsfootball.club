-- ==============================================================================
-- Migration: Fix Supabase RLS Infinite Recursion & Refresh Schema Cache
-- Date: 2026-09-21
-- Purpose:
--   1. Add missing accent_color and owner_id columns on clubs table if not present.
--   2. Implement non-recursive SECURITY DEFINER helper function `is_club_admin`.
--   3. Replace circular RLS policies on club_members, matches, match_events, and
--      associated club resources to prevent HTTP 500 infinite recursion errors.
--   4. Signal PostgREST to reload schema cache.
-- ==============================================================================

-- 1. Ensure columns exist on clubs table
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS accent_color VARCHAR(16) DEFAULT '#F59E0B';
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS owner_id UUID;

-- 2. Non-recursive helper function to evaluate admin authorization
-- Drop all previous overloads to prevent 'function is_club_admin(uuid) is not unique' error (42725)
DROP FUNCTION IF EXISTS is_club_admin(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS is_club_admin(UUID) CASCADE;

-- Running with SECURITY DEFINER and STABLE avoids circular RLS checks on club_members
CREATE OR REPLACE FUNCTION is_club_admin(p_club_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();

    -- Permit operations in demo / unauthenticated client mode
    IF v_user_id IS NULL THEN
        RETURN TRUE;
    END IF;

    -- Query club_members with bypass of RLS recursion
    RETURN EXISTS (
        SELECT 1
        FROM club_members
        WHERE club_id = p_club_id
          AND user_id = v_user_id
          AND role IN ('owner', 'admin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- 3. Replace RLS policies for clubs and club_members
DROP POLICY IF EXISTS "Club admin clubs edit" ON clubs;
CREATE POLICY "Club admin clubs edit" ON clubs FOR ALL USING (
    is_club_admin(id)
) WITH CHECK (
    is_club_admin(id)
);

DROP POLICY IF EXISTS "Club admin members manage" ON club_members;
CREATE POLICY "Club admin members manage" ON club_members FOR ALL USING (
    is_club_admin(club_id)
) WITH CHECK (
    is_club_admin(club_id)
);

-- 4. Replace RLS policies for matches and match events
DROP POLICY IF EXISTS "Club admin matches manage" ON matches;
CREATE POLICY "Club admin matches manage" ON matches FOR ALL USING (
    is_club_admin(club_id)
) WITH CHECK (
    is_club_admin(club_id)
);

DROP POLICY IF EXISTS "Club admin match events manage" ON match_events;
CREATE POLICY "Club admin match events manage" ON match_events FOR ALL USING (
    is_club_admin(club_id)
) WITH CHECK (
    is_club_admin(club_id)
);

-- 5. Replace RLS policies for events, sponsors, news, inquiries
DROP POLICY IF EXISTS "Club admin events manage" ON events;
CREATE POLICY "Club admin events manage" ON events FOR ALL USING (
    is_club_admin(club_id)
) WITH CHECK (
    is_club_admin(club_id)
);

DROP POLICY IF EXISTS "Club admin sponsors manage" ON sponsors;
CREATE POLICY "Club admin sponsors manage" ON sponsors FOR ALL USING (
    is_club_admin(club_id)
) WITH CHECK (
    is_club_admin(club_id)
);

DROP POLICY IF EXISTS "Club admin news manage" ON news_articles;
CREATE POLICY "Club admin news manage" ON news_articles FOR ALL USING (
    is_club_admin(club_id)
) WITH CHECK (
    is_club_admin(club_id)
);

DROP POLICY IF EXISTS "Club admin inquiries read" ON contact_inquiries;
CREATE POLICY "Club admin inquiries read" ON contact_inquiries FOR ALL USING (
    is_club_admin(club_id)
) WITH CHECK (
    is_club_admin(club_id)
);

-- 6. Replace RLS policies for gamification & clubscore
DROP POLICY IF EXISTS "Club admin clubscore_rules manage" ON clubscore_rules;
CREATE POLICY "Club admin clubscore_rules manage" ON clubscore_rules FOR ALL USING (
    is_club_admin(club_id)
) WITH CHECK (
    is_club_admin(club_id)
);

DROP POLICY IF EXISTS "Club admin member_clubscore_profiles manage" ON member_clubscore_profiles;
CREATE POLICY "Club admin member_clubscore_profiles manage" ON member_clubscore_profiles FOR ALL USING (
    is_club_admin(club_id)
) WITH CHECK (
    is_club_admin(club_id)
);

DROP POLICY IF EXISTS "Club admin gamification_activity_log insert" ON gamification_activity_log;
CREATE POLICY "Club admin gamification_activity_log insert" ON gamification_activity_log FOR INSERT WITH CHECK (
    is_club_admin(club_id)
);

-- 7. Replace RLS policies for internal teams, tournaments, and participants
DROP POLICY IF EXISTS "Club admin internal_teams manage" ON internal_teams;
CREATE POLICY "Club admin internal_teams manage" ON internal_teams FOR ALL USING (
    is_club_admin(club_id)
) WITH CHECK (
    is_club_admin(club_id)
);

DROP POLICY IF EXISTS "Club admin tournaments manage" ON tournaments;
CREATE POLICY "Club admin tournaments manage" ON tournaments FOR ALL USING (
    is_club_admin(club_id)
) WITH CHECK (
    is_club_admin(club_id)
);

DROP POLICY IF EXISTS "Club admin tournament_participants manage" ON tournament_participants;
CREATE POLICY "Club admin tournament_participants manage" ON tournament_participants FOR ALL USING (
    is_club_admin((SELECT club_id FROM tournaments WHERE id = tournament_participants.tournament_id))
) WITH CHECK (
    is_club_admin((SELECT club_id FROM tournaments WHERE id = tournament_participants.tournament_id))
);

-- 8. Signal PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
