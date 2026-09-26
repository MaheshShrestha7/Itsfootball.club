-- ==============================================================================
-- Security hardening
--  1. Internal SECURITY DEFINER helpers are no longer callable over the REST API
--  2. Membership applications can't carry admin role labels
--  3. Door self check-in needs the door code printed at the entrance
--  4. Sponsor analytics insert policy checks the row's own club_id
--  5. Database-generated tokens use a cryptographic random source
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. fn_award_clubscore / fn_publish_draft_lineup never checked the caller, and
--    Postgres (plus Supabase's default privileges) let anon/authenticated run them.
--    They are only meant to be called from other SECURITY DEFINER functions, which
--    run as the owner and keep their access.
-- ------------------------------------------------------------------------------
ALTER FUNCTION fn_award_clubscore(UUID, UUID, VARCHAR, INTEGER, TEXT, UUID, VARCHAR) SET search_path = public;
ALTER FUNCTION fn_publish_draft_lineup(UUID) SET search_path = public;
REVOKE ALL ON FUNCTION fn_award_clubscore(UUID, UUID, VARCHAR, INTEGER, TEXT, UUID, VARCHAR) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION fn_publish_draft_lineup(UUID) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 2. The application policy only blocked role IN ('owner','admin','staff'), but
--    member_is_admin() also accepts labels such as 'Club Admin' in role or roles.
--    An approved application keeps those labels and claim_my_memberships() then
--    links it to the applicant's account as an admin.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public membership applications" ON club_members;
CREATE POLICY "Public membership applications" ON club_members FOR INSERT
    WITH CHECK (
        membership_status = 'pending'
        AND user_id IS NULL
        AND COALESCE(is_executive, FALSE) = FALSE
        AND lower(COALESCE(role, 'player')) IN ('player', 'member', 'supporter')
        AND COALESCE(roles, '[]'::jsonb) = '[]'::jsonb
    );

-- Applications already sitting in the queue with admin labels are reset to a plain player
UPDATE club_members
   SET role = 'player', roles = '[]'::jsonb
 WHERE membership_status = 'pending'
   AND member_is_admin(role, roles);

-- ------------------------------------------------------------------------------
-- 3. Door codes. matches.door_qr_code was publicly readable and never checked, so
--    anyone with a match/event id could check in remotely. Codes now live in a table
--    with no policies (only the functions below touch it) and must be presented by
--    the door page; club admins at the scanner don't need one.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS door_checkin_codes (
    target_id UUID PRIMARY KEY, -- a matches.id or events.id
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    code TEXT NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE door_checkin_codes ENABLE ROW LEVEL SECURITY;

ALTER TABLE matches DROP COLUMN IF EXISTS door_qr_code;

-- Admin-only: returns the door code for a match or event, creating it on first use
CREATE OR REPLACE FUNCTION get_door_checkin_code(p_target_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_club_id UUID;
    v_code TEXT;
BEGIN
    SELECT club_id INTO v_club_id FROM matches WHERE id = p_target_id;
    IF v_club_id IS NULL THEN
        SELECT club_id INTO v_club_id FROM events WHERE id = p_target_id;
    END IF;
    IF v_club_id IS NULL OR NOT is_club_admin(v_club_id) THEN
        RETURN NULL;
    END IF;

    INSERT INTO door_checkin_codes (target_id, club_id)
    VALUES (p_target_id, v_club_id)
    ON CONFLICT (target_id) DO NOTHING;

    SELECT code INTO v_code FROM door_checkin_codes WHERE target_id = p_target_id;
    RETURN v_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION get_door_checkin_code(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_door_checkin_code(UUID) TO authenticated;

-- True for a club admin, or when the right door code for the fixture is given
CREATE OR REPLACE FUNCTION door_checkin_allowed(p_target_id UUID, p_club_id UUID, p_door_code TEXT)
RETURNS BOOLEAN AS $$
    SELECT is_club_admin(p_club_id) OR EXISTS (
        SELECT 1 FROM door_checkin_codes d
         WHERE d.target_id = p_target_id
           AND d.code = NULLIF(trim(COALESCE(p_door_code, '')), '')
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

REVOKE ALL ON FUNCTION door_checkin_allowed(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- The check-in functions gain a p_door_code argument, so the old signatures go
DROP FUNCTION IF EXISTS public_match_checkin(UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public_event_checkin(UUID, TEXT, TEXT, TEXT);

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
                COALESCE(v_match.season, '2025/2026')
            );
        EXCEPTION WHEN OTHERS THEN
            NULL; -- points are a bonus; never block the check-in
        END;
    END IF;

    RETURN QUERY SELECT TRUE, 'Welcome to ' || v_match.venue || '! Entry check-in confirmed.', v_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public_match_checkin(UUID, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

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
                COALESCE(v_event.season, '2025/2026')
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
-- 4. Inside the subquery the bare club_id resolved to s.club_id (always equal to
--    itself), so a row could claim any club. Qualify the new row's columns.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public sponsor_analytics log" ON sponsor_analytics;
CREATE POLICY "Public sponsor_analytics log" ON sponsor_analytics FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM sponsors s
            JOIN clubs c ON c.id = s.club_id
            WHERE s.id = sponsor_analytics.sponsor_id
              AND s.club_id = sponsor_analytics.club_id
              AND s.is_active AND c.is_active
        )
    );

-- ------------------------------------------------------------------------------
-- 5. md5(random()) is not a cryptographic source. Existing tokens are left alone so
--    passes already issued keep working.
-- ------------------------------------------------------------------------------
ALTER TABLE club_members ALTER COLUMN qr_code_token SET DEFAULT replace(gen_random_uuid()::text, '-', '');
ALTER TABLE event_attendees ALTER COLUMN qr_ticket_code SET DEFAULT replace(gen_random_uuid()::text, '-', '');
ALTER TABLE player_availabilities ALTER COLUMN response_token SET DEFAULT replace(gen_random_uuid()::text, '-', '');

NOTIFY pgrst, 'reload schema';
