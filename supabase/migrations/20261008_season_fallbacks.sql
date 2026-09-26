-- ==============================================================================
-- Season fallbacks: points awarded for a fixture without a season went to a hardcoded
-- '2025/2026'. They now use the club's current season, worked out the same way as the
-- app's seasonLabelFor() / defaultSeasonLabel() (lib/season.ts).
-- ==============================================================================

-- The club's current season, else its active one, else any, else the calendar season
-- (starting in August, labelled like '2026/27')
CREATE OR REPLACE FUNCTION club_current_season(p_club_id UUID)
RETURNS TEXT AS $$
    SELECT COALESCE(
        (SELECT s.name FROM club_seasons s
          WHERE s.club_id = p_club_id
          ORDER BY s.is_current DESC, (s.status = 'active') DESC, s.start_date DESC
          LIMIT 1),
        (SELECT y || '/' || lpad(((y + 1) % 100)::text, 2, '0')
           FROM (SELECT CASE WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 8
                             THEN EXTRACT(YEAR FROM CURRENT_DATE)::int
                             ELSE EXTRACT(YEAR FROM CURRENT_DATE)::int - 1 END AS y) t)
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION club_current_season(UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public_match_checkin(
    p_match_id UUID,
    p_token TEXT DEFAULT NULL,
    p_name TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_door_code TEXT DEFAULT NULL
)
RETURNS TABLE (success BOOLEAN, message TEXT, attendee_name TEXT) AS $$
DECLARE
    v_match matches%ROWTYPE;
    v_member club_members%ROWTYPE;
    v_name TEXT := NULLIF(trim(COALESCE(p_name, '')), '');
    v_token TEXT := NULLIF(trim(COALESCE(p_token, '')), '');
    v_email TEXT := NULLIF(lower(trim(COALESCE(p_email, ''))), '');
    v_scan_key TEXT;
    v_title TEXT;
BEGIN
    SELECT * INTO v_match FROM matches WHERE matches.id = p_match_id;
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Match fixture not found.', NULL::TEXT;
        RETURN;
    END IF;

    IF NOT COALESCE(v_match.door_qr_checkin_enabled, FALSE) THEN
        RETURN QUERY SELECT FALSE, 'Door QR self check-in is not active for this fixture.', NULL::TEXT;
        RETURN;
    END IF;

    IF NOT door_checkin_allowed(p_match_id, v_match.club_id, p_door_code) THEN
        RETURN QUERY SELECT FALSE, 'This check-in link is not valid. Please scan the QR code at the entrance.', NULL::TEXT;
        RETURN;
    END IF;

    v_title := COALESCE(NULLIF(v_match.title, ''), v_match.home_team_name || ' vs ' || v_match.away_team_name);

    IF v_token IS NOT NULL THEN
        SELECT * INTO v_member
          FROM club_members m
         WHERE m.club_id = v_match.club_id
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
        v_name := 'General Supporter';
    END IF;

    v_scan_key := CASE
        WHEN v_member.id IS NOT NULL THEN v_member.qr_code_token
        ELSE LEFT('guest:' || COALESCE(v_email, lower(v_name)), 128)
    END;

    IF EXISTS (
        SELECT 1 FROM gate_scans g
         WHERE g.match_id = p_match_id AND g.scan_type = 'match_checkin' AND g.valid AND g.token = v_scan_key
    ) THEN
        RETURN QUERY SELECT TRUE, 'You are already checked in for this match.', v_name;
        RETURN;
    END IF;

    INSERT INTO gate_scans (club_id, scan_type, token, member_id, member_name, match_id, match_title, valid)
    VALUES (v_match.club_id, 'match_checkin', v_scan_key, v_member.id, v_name, p_match_id, v_title, TRUE);

    UPDATE matches SET checkin_count = COALESCE(checkin_count, 0) + 1 WHERE matches.id = p_match_id;

    IF v_member.id IS NOT NULL THEN
        BEGIN
            PERFORM fn_award_clubscore(
                v_match.club_id,
                v_member.id,
                'match_appearance',
                COALESCE((SELECT r.points_match_appearance FROM clubscore_rules r WHERE r.club_id = v_match.club_id), 5),
                'Matchday Turnstile Check-in: ' || v_title,
                p_match_id,
                COALESCE(v_match.season, club_current_season(v_match.club_id))
            );
        EXCEPTION WHEN OTHERS THEN
            NULL; -- points are a bonus; never block the check-in
        END;
    END IF;

    RETURN QUERY SELECT TRUE, 'Welcome to ' || v_match.venue || '! Entry check-in confirmed.', v_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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

    v_season := COALESCE(NULLIF(trim(p_season), ''), club_current_season(v_club_id));

    PERFORM fn_award_clubscore(v_club_id, p_member_id, p_event_type, p_points, p_description, p_reference_id, v_season);

    SELECT * INTO v_profile FROM member_clubscore_profiles WHERE member_id = p_member_id AND season = v_season;
    -- NOW() is the transaction start, the same value the log row's created_at default got
    SELECT * INTO v_log FROM gamification_activity_log
     WHERE member_id = p_member_id AND created_at = NOW()
     ORDER BY id LIMIT 1;

    RETURN jsonb_build_object('profile', to_jsonb(v_profile), 'log', to_jsonb(v_log));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

NOTIFY pgrst, 'reload schema';
