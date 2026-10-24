-- ==============================================================================
-- Migration: per-match player stats, so saved stats can be fixed later
-- Date: 2026-11-21
--
-- Saving a match's player stats (Match Centre) adds to each player's season totals and gives
-- ClubScore points. Until now only the season totals were kept, so a mistake could not be undone.
--   1. match_player_stats: what each player got from one match (played, minutes, goals, assists,
--      cards, clean sheet, Player of the Match). Written when the stats are saved; the "Fix stats"
--      screen edits it and moves the season totals and points by the difference.
--   2. fn_award_clubscore: a fix that takes an appearance away can send its negative points, and
--      putting it back is allowed again (the one-appearance-per-match rule still holds).
-- Matches saved before this migration have no per-match rows: their stats can't be fixed this way.
--
-- Safe to run more than once.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS match_player_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES club_members(id) ON DELETE CASCADE,
    season TEXT,
    played BOOLEAN NOT NULL DEFAULT FALSE,
    minutes INTEGER NOT NULL DEFAULT 0 CHECK (minutes BETWEEN 0 AND 200),
    goals INTEGER NOT NULL DEFAULT 0 CHECK (goals BETWEEN 0 AND 50),
    assists INTEGER NOT NULL DEFAULT 0 CHECK (assists BETWEEN 0 AND 50),
    yellow_cards INTEGER NOT NULL DEFAULT 0 CHECK (yellow_cards BETWEEN 0 AND 2),
    red_cards INTEGER NOT NULL DEFAULT 0 CHECK (red_cards BETWEEN 0 AND 1),
    clean_sheet BOOLEAN NOT NULL DEFAULT FALSE,
    motm BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (match_id, member_id)
);
CREATE INDEX IF NOT EXISTS idx_match_player_stats_club ON match_player_stats (club_id);

-- A row's club always follows its match, and the member must be in that club
CREATE OR REPLACE FUNCTION match_player_stats_check()
RETURNS TRIGGER AS $$
DECLARE
    v_club UUID;
BEGIN
    SELECT club_id INTO v_club FROM matches WHERE id = NEW.match_id;
    IF v_club IS NULL OR NOT EXISTS (SELECT 1 FROM club_members WHERE id = NEW.member_id AND club_id = v_club) THEN
        RAISE EXCEPTION 'The match and the player must belong to the same club' USING ERRCODE = '23514';
    END IF;
    NEW.club_id := v_club;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS match_player_stats_check ON match_player_stats;
CREATE TRIGGER match_player_stats_check BEFORE INSERT OR UPDATE ON match_player_stats
    FOR EACH ROW EXECUTE FUNCTION match_player_stats_check();

ALTER TABLE match_player_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Match stats read" ON match_player_stats;
CREATE POLICY "Match stats read" ON match_player_stats FOR SELECT TO authenticated
    USING (has_club_perm(club_id, '{match-center,matches}', 'view'));
DROP POLICY IF EXISTS "Match stats write" ON match_player_stats;
CREATE POLICY "Match stats write" ON match_player_stats FOR ALL TO authenticated
    USING (has_club_perm(club_id, '{match-center,matches}', 'edit'))
    WITH CHECK (has_club_perm(club_id, '{match-center,matches}', 'edit'));
GRANT SELECT, INSERT, UPDATE, DELETE ON match_player_stats TO authenticated;

CREATE OR REPLACE FUNCTION fn_award_clubscore(
    p_club_id UUID,
    p_member_id UUID,
    p_event_type VARCHAR(64),
    p_points INTEGER,
    p_description TEXT,
    p_reference_id UUID DEFAULT NULL,
    p_season VARCHAR(32) DEFAULT '2025/2026'
)
RETURNS VOID AS $$
DECLARE
    v_profile member_clubscore_profiles%ROWTYPE;
    v_rules clubscore_rules%ROWTYPE;
    v_multiplier NUMERIC(3,2) := 1.00;
    v_final_points INTEGER;
    v_this_week DATE := date_trunc('week', CURRENT_DATE)::date;
    v_this_month DATE := date_trunc('month', CURRENT_DATE)::date;
    v_streak_week DATE;
    v_streak INTEGER;
    v_streak_at TIMESTAMPTZ;
    v_weekly INTEGER;
    v_monthly INTEGER;
    v_total INTEGER;
    v_badges JSONB;
BEGIN
    -- ClubScore switched off on the admin ClubScore page: nothing is awarded, logged or streaked
    IF EXISTS (SELECT 1 FROM clubscore_rules WHERE club_id = p_club_id AND NOT is_active) THEN
        RETURN;
    END IF;

    INSERT INTO member_clubscore_profiles (club_id, member_id, season)
    VALUES (p_club_id, p_member_id, p_season)
    ON CONFLICT (member_id, season) DO NOTHING;

    -- FOR UPDATE: concurrent awards for this member wait here and then see each other's points
    SELECT * INTO v_profile
      FROM member_clubscore_profiles
     WHERE member_id = p_member_id AND season = p_season
       FOR UPDATE;

    -- One appearance award per match. A stats fix that takes the appearance away sends negative
    -- points, and giving it back later is allowed again once those have cancelled it out. So: a
    -- positive award is skipped while the appearance stands, a negative one when there is none.
    IF p_event_type = 'match_appearance' AND p_reference_id IS NOT NULL AND p_points <> 0 AND (
        SELECT CASE WHEN p_points > 0 THEN COALESCE(SUM(l.final_points), 0) > 0 ELSE COALESCE(SUM(l.final_points), 0) <= 0 END
          FROM gamification_activity_log l
         WHERE l.member_id = p_member_id
           AND l.event_type = 'match_appearance'
           AND l.reference_id = p_reference_id
    ) THEN
        RETURN; -- already awarded (or already taken off) for this match
    END IF;

    SELECT * INTO v_rules FROM clubscore_rules WHERE club_id = p_club_id;

    -- Week of the last attendance (older rows only have last_activity_date)
    v_streak_week := date_trunc('week', COALESCE(v_profile.streak_updated_at, v_profile.last_activity_date::timestamptz))::date;
    -- A streak is only alive if the last attendance was this week or last week
    v_streak := CASE WHEN v_streak_week >= v_this_week - 7 THEN v_profile.current_streak ELSE 0 END;
    -- Kept on non-attendance awards, which move last_activity_date but not the streak week
    v_streak_at := COALESCE(v_profile.streak_updated_at, v_profile.last_activity_date::timestamptz);

    IF v_streak >= 10 THEN
        v_multiplier := COALESCE(v_rules.streak_multiplier_10w, 1.50);
    ELSIF v_streak >= 5 THEN
        v_multiplier := COALESCE(v_rules.streak_multiplier_5w, 1.25);
    ELSIF v_streak >= 3 THEN
        v_multiplier := COALESCE(v_rules.streak_multiplier_3w, 1.15);
    END IF;

    IF p_points > 0 THEN
        v_final_points := ROUND(p_points * v_multiplier);
    ELSE
        v_final_points := p_points;
    END IF;

    IF p_event_type IN ('training_checkin', 'social_checkin', 'match_appearance') THEN
        IF v_streak_week IS NULL OR v_streak_week < v_this_week - 7 THEN
            v_streak := 1;                    -- first attendance, or a week was missed
        ELSIF v_streak_week = v_this_week - 7 THEN
            v_streak := v_streak + 1;         -- first attendance of a consecutive week
        ELSE
            v_streak := GREATEST(v_streak, 1); -- already counted this week
        END IF;
        v_streak_at := NOW();
    END IF;

    v_weekly := CASE WHEN v_profile.last_activity_date >= v_this_week THEN v_profile.weekly_points ELSE 0 END;
    v_monthly := CASE WHEN v_profile.last_activity_date >= v_this_month THEN v_profile.monthly_points ELSE 0 END;
    v_total := GREATEST(0, v_profile.total_points + v_final_points);
    v_badges := COALESCE(v_profile.badges, '[]'::jsonb);

    -- Same badge objects as STANDARD_BADGES in lib/clubscore-defaults.ts
    IF v_streak >= 5 AND NOT v_badges @> '[{"id": "badge-ironman"}]' THEN
        v_badges := v_badges || jsonb_build_array(jsonb_build_object(
            'id', 'badge-ironman',
            'name', 'Iron Man 5-Streak',
            'description', 'Maintained 5 consecutive weeks of verified training & match attendance.',
            'icon', 'flame',
            'tier_required', 'Prospect'
        ));
    END IF;
    IF v_total >= 500 AND NOT v_badges @> '[{"id": "badge-centurion"}]' THEN
        v_badges := v_badges || jsonb_build_array(jsonb_build_object(
            'id', 'badge-centurion',
            'name', 'Club Centurion',
            'description', 'Crossed 500 lifetime ClubScore fantasy points.',
            'icon', 'crown',
            'tier_required', 'Club Legend'
        ));
    END IF;

    INSERT INTO gamification_activity_log (
        club_id, member_id, event_type, points_awarded, multiplier, final_points, description, reference_id
    ) VALUES (
        p_club_id, p_member_id, p_event_type, p_points, v_multiplier, v_final_points, p_description, p_reference_id
    );

    UPDATE member_clubscore_profiles
       SET total_points = v_total,
           weekly_points = GREATEST(0, v_weekly + v_final_points),
           monthly_points = GREATEST(0, v_monthly + v_final_points),
           current_streak = v_streak,
           highest_streak = GREATEST(highest_streak, v_streak),
           tier = fn_get_clubscore_tier(v_total),
           badges = v_badges,
           last_activity_date = CURRENT_DATE,
           streak_updated_at = v_streak_at,
           updated_at = NOW()
     WHERE id = v_profile.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
