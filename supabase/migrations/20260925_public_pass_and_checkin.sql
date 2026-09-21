-- ==============================================================================
-- Migration: public pass verification and door check-in, checked on the server
-- Date: 2026-09-25
--
-- Visitors can no longer read member pass tokens or write to matches, so these two actions run
-- inside functions that check everything themselves. Safe to run more than once.
-- ==============================================================================

-- 1. Verify a member pass by its QR token. Returns only what a gate steward needs to see.
CREATE OR REPLACE FUNCTION verify_member_pass(p_token TEXT)
RETURNS TABLE (
    id UUID,
    club_id UUID,
    full_name TEXT,
    membership_tier TEXT,
    membership_expires_at DATE,
    status TEXT,
    membership_status TEXT,
    photo_url TEXT,
    role TEXT,
    player_position TEXT,
    jersey_number INTEGER,
    is_executive BOOLEAN,
    executive_title TEXT
) AS $$
    SELECT
        m.id, m.club_id, m.full_name::TEXT, m.membership_tier::TEXT, m.membership_expires_at,
        m.status::TEXT, COALESCE(m.membership_status, 'approved')::TEXT, m.photo_url, m.role::TEXT,
        m.player_position::TEXT, m.jersey_number, COALESCE(m.is_executive, FALSE), m.executive_title::TEXT
    FROM club_members m
    WHERE m.qr_code_token = trim(p_token)
    LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION verify_member_pass(TEXT) TO anon, authenticated;

-- 2. Door check-in for a match: counts the visit, logs the scan, awards ClubScore points to members
CREATE OR REPLACE FUNCTION public_match_checkin(
    p_match_id UUID,
    p_token TEXT DEFAULT NULL,
    p_name TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL
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

    -- One check-in per member (or per guest email / name) per match
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

GRANT EXECUTE ON FUNCTION public_match_checkin(UUID, TEXT, TEXT, TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
