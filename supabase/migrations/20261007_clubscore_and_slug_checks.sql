-- ==============================================================================
-- 1. ClubScore points are awarded only by the database. Admin awards from the app go
--    through admin_award_clubscore(); the old client-side calculation (different streak
--    rules, no season matching) is gone. fn_award_clubscore now also clamps totals at 0
--    and grants the Iron Man / Centurion badges the app used to add itself.
-- 2. club_slug_available(): slug check that also sees inactive clubs and old slugs.
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
    v_multiplier NUMERIC(3,2) := 1.00;
    v_final_points INTEGER;
    v_current_streak INTEGER := 0;
    v_last_activity DATE;
    v_total INTEGER;
    v_badges JSONB;
BEGIN
    INSERT INTO member_clubscore_profiles (club_id, member_id, season)
    VALUES (p_club_id, p_member_id, p_season)
    ON CONFLICT (member_id, season) DO NOTHING;

    SELECT current_streak, last_activity_date, total_points, COALESCE(badges, '[]'::jsonb)
      INTO v_current_streak, v_last_activity, v_total, v_badges
      FROM member_clubscore_profiles
     WHERE member_id = p_member_id AND season = p_season;

    IF v_current_streak >= 10 THEN
        v_multiplier := 1.50;
    ELSIF v_current_streak >= 5 THEN
        v_multiplier := 1.25;
    ELSIF v_current_streak >= 3 THEN
        v_multiplier := 1.15;
    END IF;

    IF p_points > 0 THEN
        v_final_points := ROUND(p_points * v_multiplier);
    ELSE
        v_final_points := p_points;
    END IF;

    -- Streaks count weeks with at least one attendance
    IF p_event_type IN ('training_checkin', 'social_checkin', 'match_appearance') THEN
        IF v_last_activity IS NULL OR v_last_activity < (CURRENT_DATE - INTERVAL '6 days') THEN
            v_current_streak := v_current_streak + 1;
        END IF;
    END IF;

    v_total := GREATEST(0, v_total + v_final_points);

    -- Same badge objects as STANDARD_BADGES in lib/clubscore-defaults.ts
    IF v_current_streak >= 5 AND NOT v_badges @> '[{"id": "badge-ironman"}]' THEN
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
           weekly_points = GREATEST(0, weekly_points + v_final_points),
           monthly_points = GREATEST(0, monthly_points + v_final_points),
           current_streak = v_current_streak,
           highest_streak = GREATEST(highest_streak, v_current_streak),
           tier = fn_get_clubscore_tier(v_total),
           badges = v_badges,
           last_activity_date = CURRENT_DATE,
           updated_at = NOW()
     WHERE member_id = p_member_id AND season = p_season;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Still internal only (see 20261006_security_hardening.sql)
REVOKE ALL ON FUNCTION fn_award_clubscore(UUID, UUID, VARCHAR, INTEGER, TEXT, UUID, VARCHAR) FROM PUBLIC, anon, authenticated;

-- Club admins award points through this; returns the updated profile and the new log row
CREATE OR REPLACE FUNCTION admin_award_clubscore(
    p_member_id UUID,
    p_event_type TEXT,
    p_points INTEGER,
    p_description TEXT,
    p_reference_id UUID DEFAULT NULL,
    p_season TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_club_id UUID;
    v_season TEXT;
    v_profile member_clubscore_profiles%ROWTYPE;
    v_log gamification_activity_log%ROWTYPE;
BEGIN
    SELECT club_id INTO v_club_id FROM club_members WHERE id = p_member_id;
    IF v_club_id IS NULL OR NOT is_club_admin(v_club_id) THEN
        RAISE EXCEPTION 'Only club admins can award ClubScore points' USING ERRCODE = '42501';
    END IF;

    v_season := COALESCE(
        NULLIF(trim(p_season), ''),
        (SELECT s.name FROM club_seasons s WHERE s.club_id = v_club_id AND s.is_current LIMIT 1),
        '2025/2026'
    );

    PERFORM fn_award_clubscore(v_club_id, p_member_id, p_event_type, p_points, p_description, p_reference_id, v_season);

    SELECT * INTO v_profile FROM member_clubscore_profiles WHERE member_id = p_member_id AND season = v_season;
    -- NOW() is the transaction start, the same value the log row's created_at default got
    SELECT * INTO v_log FROM gamification_activity_log
     WHERE member_id = p_member_id AND created_at = NOW()
     ORDER BY id LIMIT 1;

    RETURN jsonb_build_object('profile', to_jsonb(v_profile), 'log', to_jsonb(v_log));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION admin_award_clubscore(UUID, TEXT, INTEGER, TEXT, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_award_clubscore(UUID, TEXT, INTEGER, TEXT, UUID, TEXT) TO authenticated;

-- True when no other club uses the slug, now or as an old (redirecting) slug
CREATE OR REPLACE FUNCTION club_slug_available(p_slug TEXT, p_club_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
    SELECT NOT EXISTS (
        SELECT 1 FROM clubs c
         WHERE (p_club_id IS NULL OR c.id <> p_club_id)
           AND (lower(c.slug) = lower(trim(p_slug))
                OR COALESCE(c.previous_slugs, '[]'::jsonb) ? lower(trim(p_slug)))
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION club_slug_available(TEXT, UUID) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
