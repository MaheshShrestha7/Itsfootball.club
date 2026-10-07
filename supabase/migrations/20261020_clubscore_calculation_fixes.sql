-- ==============================================================================
-- ClubScore calculation fixes
-- 1. fn_award_clubscore locks the profile row. Awards that ran at the same time (a match
--    audit sends goal, assist, appearance, MOTM and clean sheet at once) all read the same
--    total and the last write won, so the profile ended up below its own ledger.
-- 2. Streak multipliers come from the club's clubscore_rules (they were hardcoded, so the
--    admin settings did nothing).
-- 3. Streaks count consecutive calendar weeks (Monday start) with an attendance, and reset
--    after a missed week. Before, they never reset, and any award (goal, card, admin) moved
--    last_activity_date, which could stop the next attendance from counting.
-- 4. weekly_points / monthly_points restart at the start of each week / month. They were
--    never reset, so they were just a second season total.
-- 5. Profiles are rebuilt from the ledger once, to repair totals the race lost.
-- 6. Ticketed check-ins and the legacy event_attendees trigger use the club's season and
--    point rules instead of '2025/2026' and hardcoded points.
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

    SELECT * INTO v_rules FROM clubscore_rules WHERE club_id = p_club_id;

    -- Week of the last attendance (older rows only have last_activity_date)
    v_streak_week := date_trunc('week', COALESCE(v_profile.streak_updated_at, v_profile.last_activity_date::timestamptz))::date;
    -- A streak is only alive if the last attendance was this week or last week
    v_streak := CASE WHEN v_streak_week >= v_this_week - 7 THEN v_profile.current_streak ELSE 0 END;
    v_streak_at := v_profile.streak_updated_at;

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

-- ------------------------------------------------------------------------------
-- Legacy trigger on event_attendees (ticket scans set checkin_status = 'checked_in')
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_fn_on_event_checkin()
RETURNS TRIGGER AS $$
DECLARE
    v_event events%ROWTYPE;
    v_social BOOLEAN;
BEGIN
    IF (OLD.checkin_status IS DISTINCT FROM NEW.checkin_status AND NEW.checkin_status = 'checked_in')
       AND NEW.member_id IS NOT NULL THEN
        SELECT * INTO v_event FROM events WHERE id = NEW.event_id;
        v_social := v_event.category = 'social';
        BEGIN
            PERFORM fn_award_clubscore(
                NEW.club_id,
                NEW.member_id,
                CASE WHEN v_social THEN 'social_checkin' ELSE 'training_checkin' END,
                COALESCE(
                    (SELECT CASE WHEN v_social THEN r.points_social_checkin ELSE r.points_training_checkin END
                       FROM clubscore_rules r WHERE r.club_id = NEW.club_id),
                    CASE WHEN v_social THEN 5 ELSE 10 END
                ),
                'Verified QR Check-In: ' || COALESCE(v_event.category, 'Event'),
                NEW.event_id,
                COALESCE(v_event.season, club_current_season(NEW.club_id))
            );
        EXCEPTION WHEN OTHERS THEN
            NULL; -- points are a bonus; never block the check-in
        END;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ------------------------------------------------------------------------------
-- public_event_checkin: as in 20261018, with the season fallback from 20261008 restored
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public_event_checkin(
    p_event_id UUID,
    p_token TEXT DEFAULT NULL,
    p_name TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_door_code TEXT DEFAULT NULL
)
RETURNS TABLE (success BOOLEAN, message TEXT, attendee_name TEXT) AS $$
DECLARE
    v_event events%ROWTYPE;
    v_member club_members%ROWTYPE;
    v_ticket event_attendees%ROWTYPE;
    v_name TEXT := NULLIF(trim(COALESCE(p_name, '')), '');
    v_token TEXT := NULLIF(trim(COALESCE(p_token, '')), '');
    v_email TEXT := NULLIF(lower(trim(COALESCE(p_email, ''))), '');
    v_scan_key TEXT;
    v_points INTEGER;
BEGIN
    SELECT * INTO v_event FROM events WHERE events.id = p_event_id;
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Event not found.', NULL::TEXT;
        RETURN;
    END IF;

    IF NOT COALESCE(v_event.door_qr_checkin_enabled, FALSE) THEN
        RETURN QUERY SELECT FALSE, 'Door QR self check-in is not active for this event.', NULL::TEXT;
        RETURN;
    END IF;

    IF NOT door_checkin_allowed(p_event_id, v_event.club_id, p_door_code) THEN
        RETURN QUERY SELECT FALSE, 'This check-in link is not valid. Please scan the QR code at the entrance.', NULL::TEXT;
        RETURN;
    END IF;

    -- A ticket for this event: valid once
    IF v_token IS NOT NULL THEN
        SELECT * INTO v_ticket FROM event_attendees a WHERE a.event_id = p_event_id AND a.qr_ticket_code = v_token;
        IF FOUND THEN
            IF v_ticket.checkin_status = 'cancelled' THEN
                RETURN QUERY SELECT FALSE, 'This ticket was cancelled (refunded).', v_ticket.attendee_name::TEXT;
                RETURN;
            END IF;
            -- The status condition makes two simultaneous scans of one ticket admit only one
            UPDATE event_attendees SET checkin_status = 'checked_in', checked_in_at = NOW()
             WHERE id = v_ticket.id AND checkin_status = 'registered';
            IF NOT FOUND THEN
                RETURN QUERY SELECT FALSE, 'This ticket has already been scanned.', v_ticket.attendee_name::TEXT;
                RETURN;
            END IF;
            INSERT INTO gate_scans (club_id, scan_type, token, member_id, member_name, event_id, event_title, valid)
            VALUES (v_event.club_id, 'event_checkin', v_token, NULL, v_ticket.attendee_name, p_event_id, v_event.title, TRUE);
            UPDATE events SET rsvp_count = COALESCE(rsvp_count, 0) + 1 WHERE events.id = p_event_id;
            RETURN QUERY SELECT TRUE, 'Ticket valid. Welcome to ' || v_event.title || '!', v_ticket.attendee_name::TEXT;
            RETURN;
        END IF;
    END IF;

    -- A ticketed event admits ticket holders only
    IF COALESCE(v_event.ticket_price_cents, 0) > 0 THEN
        RETURN QUERY SELECT FALSE, 'This event needs a ticket. Please show the QR code on your ticket.', NULL::TEXT;
        RETURN;
    END IF;

    IF v_token IS NOT NULL THEN
        SELECT * INTO v_member
          FROM club_members m
         WHERE m.club_id = v_event.club_id
           AND m.qr_code_token = v_token
           AND COALESCE(m.membership_status, 'approved') = 'approved'
           AND m.status <> 'suspended'
         LIMIT 1;
        IF FOUND THEN
            v_name := v_member.full_name;
        ELSIF v_name IS NULL THEN
            RETURN QUERY SELECT FALSE, 'Invalid member pass token provided.', NULL::TEXT;
            RETURN;
        END IF;
    END IF;

    IF v_name IS NULL THEN
        v_name := 'Guest Attendee';
    END IF;

    v_scan_key := CASE
        WHEN v_member.id IS NOT NULL THEN v_member.qr_code_token
        ELSE LEFT('guest:' || COALESCE(v_email, lower(v_name)), 128)
    END;

    IF EXISTS (
        SELECT 1 FROM gate_scans g
         WHERE g.event_id = p_event_id AND g.scan_type = 'event_checkin' AND g.valid AND g.token = v_scan_key
    ) THEN
        RETURN QUERY SELECT TRUE, 'You are already checked in for this event.', v_name;
        RETURN;
    END IF;

    INSERT INTO gate_scans (club_id, scan_type, token, member_id, member_name, event_id, event_title, valid)
    VALUES (v_event.club_id, 'event_checkin', v_scan_key, v_member.id, v_name, p_event_id, v_event.title, TRUE);

    UPDATE events SET rsvp_count = COALESCE(rsvp_count, 0) + 1 WHERE events.id = p_event_id;

    IF v_member.id IS NOT NULL THEN
        v_points := CASE WHEN v_event.category = 'social' THEN 5 ELSE 10 END;
        BEGIN
            PERFORM fn_award_clubscore(
                v_event.club_id,
                v_member.id,
                CASE WHEN v_event.category = 'social' THEN 'social_checkin' ELSE 'training_checkin' END,
                COALESCE(
                    (SELECT CASE WHEN v_event.category = 'social' THEN r.points_social_checkin ELSE r.points_training_checkin END
                       FROM clubscore_rules r WHERE r.club_id = v_event.club_id),
                    v_points
                ),
                'Door QR Check-In: ' || v_event.title,
                p_event_id,
                COALESCE(v_event.season, club_current_season(v_event.club_id))
            );
        EXCEPTION WHEN OTHERS THEN
            NULL; -- points are a bonus; never block the check-in
        END;
    END IF;

    RETURN QUERY SELECT TRUE, 'You''re checked in at ' || v_event.location || '. See you there!', v_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public_event_checkin(UUID, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- One-off repair. Lost updates only ever left a total below its ledger, so a total is
-- raised to the ledger sum and never lowered (profiles edited by hand keep their value).
-- Weekly / monthly points are rebuilt from this week's / month's rows.
-- Ledger rows have no season: a member with profiles in several seasons is matched by
-- the season's dates in club_seasons; a member with one profile takes all their rows.
-- ------------------------------------------------------------------------------
WITH profile_rows AS (
    SELECT p.id AS profile_id, l.final_points, l.created_at
      FROM member_clubscore_profiles p
      JOIN gamification_activity_log l ON l.member_id = p.member_id
      LEFT JOIN club_seasons s ON s.club_id = p.club_id AND s.name = p.season
     WHERE (SELECT count(*) FROM member_clubscore_profiles p2 WHERE p2.member_id = p.member_id) = 1
        OR (l.created_at::date BETWEEN s.start_date AND s.end_date)
),
sums AS (
    SELECT profile_id,
           GREATEST(0, SUM(final_points))::int AS total,
           GREATEST(0, COALESCE(SUM(final_points) FILTER (WHERE created_at >= date_trunc('week', NOW())), 0))::int AS weekly,
           GREATEST(0, COALESCE(SUM(final_points) FILTER (WHERE created_at >= date_trunc('month', NOW())), 0))::int AS monthly
      FROM profile_rows
     GROUP BY profile_id
)
UPDATE member_clubscore_profiles p
   SET total_points = GREATEST(p.total_points, s.total),
       weekly_points = s.weekly,
       monthly_points = s.monthly,
       tier = fn_get_clubscore_tier(GREATEST(p.total_points, s.total)),
       updated_at = NOW()
  FROM sums s
 WHERE p.id = s.profile_id
   AND (s.total > p.total_points OR p.weekly_points <> s.weekly OR p.monthly_points <> s.monthly);

NOTIFY pgrst, 'reload schema';
