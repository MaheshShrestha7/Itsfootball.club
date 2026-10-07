-- ==============================================================================
-- One match_appearance award per member per match. The turnstile check-in
-- (public_match_checkin) and the post-match audit both award match_appearance for the
-- same fixture, so a player who scanned in and then played got the points twice.
-- fn_award_clubscore now skips a match_appearance whose match (reference_id) already has
-- one for that member, whichever came first. The check runs after the profile row lock,
-- so two simultaneous awards for the same match can't both pass it.
-- Duplicates awarded before this migration stay in the ledger (it is append-only).
-- ==============================================================================

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
    INSERT INTO member_clubscore_profiles (club_id, member_id, season)
    VALUES (p_club_id, p_member_id, p_season)
    ON CONFLICT (member_id, season) DO NOTHING;

    -- FOR UPDATE: concurrent awards for this member wait here and then see each other's points
    SELECT * INTO v_profile
      FROM member_clubscore_profiles
     WHERE member_id = p_member_id AND season = p_season
       FOR UPDATE;

    IF p_event_type = 'match_appearance' AND p_reference_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM gamification_activity_log l
         WHERE l.member_id = p_member_id
           AND l.event_type = 'match_appearance'
           AND l.reference_id = p_reference_id
    ) THEN
        RETURN; -- already awarded for this match
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

-- Still internal only (see 20261006_security_hardening.sql)
REVOKE ALL ON FUNCTION fn_award_clubscore(UUID, UUID, VARCHAR, INTEGER, TEXT, UUID, VARCHAR) FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
