-- ==============================================================================
-- Migration: door QR self check-in for events (mirrors the match door check-in
-- added in 20260925_public_pass_and_checkin.sql). Safe to run more than once.
-- ==============================================================================

ALTER TABLE events ADD COLUMN IF NOT EXISTS door_qr_checkin_enabled BOOLEAN DEFAULT TRUE;

CREATE OR REPLACE FUNCTION public_event_checkin(
    p_event_id UUID,
    p_token TEXT DEFAULT NULL,
    p_name TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL
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

    -- One check-in per member (or per guest email / name) per event
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
                COALESCE(v_event.season, '2025/2026')
            );
        EXCEPTION WHEN OTHERS THEN
            NULL; -- points are a bonus; never block the check-in
        END;
    END IF;

    RETURN QUERY SELECT TRUE, 'You''re checked in at ' || v_event.location || '. See you there!', v_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public_event_checkin(UUID, TEXT, TEXT, TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
