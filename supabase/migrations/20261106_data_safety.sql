-- ==============================================================================
-- Migration: data safety fixes from the whole-project review (2026-10-14)
--
--   S1  A public membership application can no longer pre-set its own membership dates
--   S2  Door self check-in turns away lapsed memberships (and gives them no ClubScore points)
--   S3  A suspended or unapproved member labelled Admin (or holding a role) loses that access
--   S4  Only ClubScore (gamification) editors can award any number of points; match, scanner,
--       event and member roles can only award rule-sized points for their own fixtures
--   F1  Membership tiers can be as long as plan names (32 -> 120 characters)
--   F5  Seasons can be as long as season names (32 -> 64 characters) everywhere they're stored
--
-- Safe to run more than once.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- F1 / F5. Column sizes. A view that shows a column has to be dropped while the column changes,
-- so each view is saved, dropped and put back exactly as it was (with its grants).
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_members_public TEXT := pg_get_viewdef('club_members_public'::regclass);
    v_sponsors_public TEXT := pg_get_viewdef('sponsors_public'::regclass);
BEGIN
    DROP VIEW club_members_public;
    DROP VIEW sponsors_public;

    ALTER TABLE club_members ALTER COLUMN membership_tier TYPE VARCHAR(120);

    ALTER TABLE matches ALTER COLUMN season TYPE VARCHAR(64);
    ALTER TABLE player_stats ALTER COLUMN season TYPE VARCHAR(64);
    ALTER TABLE tournaments ALTER COLUMN season TYPE VARCHAR(64);
    ALTER TABLE member_clubscore_profiles ALTER COLUMN season TYPE VARCHAR(64);
    ALTER TABLE payments ALTER COLUMN season TYPE VARCHAR(64);
    ALTER TABLE expenses ALTER COLUMN season TYPE VARCHAR(64);
    ALTER TABLE sponsors ALTER COLUMN season TYPE VARCHAR(64);

    EXECUTE 'CREATE VIEW club_members_public AS ' || v_members_public;
    EXECUTE 'CREATE VIEW sponsors_public AS ' || v_sponsors_public;
END $$;

GRANT SELECT ON club_members_public TO anon, authenticated;
GRANT SELECT ON sponsors_public TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- S1. Membership applications from visitors (anyone without squad / members / committee edit at
-- the club). The insert policy limits who they can claim to be; this trigger sets the fields only
-- the club decides: the membership term (set when it's paid for or approved) and review details.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION clean_public_application()
RETURNS TRIGGER AS $$
BEGIN
    IF current_user IN ('anon', 'authenticated')
       AND NOT has_club_perm(NEW.club_id, '{squad,members,committee}', 'edit') THEN
        NEW.membership_starts_at := NULL;
        -- Only a placeholder until the club approves it or it's paid for (fulfil_payment)
        NEW.membership_expires_at := membership_term_end(NEW.club_id, CURRENT_DATE, 12);
        NEW.reviewed_at := NULL;
        NEW.reviewed_by := NULL;
        NEW.rejection_reason := NULL;
        NEW.executive_title := NULL;
        NEW.executive_bio := NULL;
        NEW.executive_order := NULL;
        NEW.executive_season := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_clean_public_application ON club_members;
CREATE TRIGGER trg_clean_public_application
    BEFORE INSERT ON club_members
    FOR EACH ROW EXECUTE FUNCTION clean_public_application();

-- ------------------------------------------------------------------------------
-- S3. Admin and role access need an approved membership that isn't suspended. The club Owner
-- (clubs.owner_id) is unaffected.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_club_admin(p_club_id UUID)
RETURNS BOOLEAN AS $$
    SELECT auth.uid() IS NOT NULL AND (
        EXISTS (SELECT 1 FROM clubs c WHERE c.id = p_club_id AND c.owner_id = auth.uid())
        OR EXISTS (
            SELECT 1 FROM club_members m
             WHERE m.club_id = p_club_id
               AND m.user_id = auth.uid()
               AND COALESCE(m.membership_status, 'approved') = 'approved'
               AND COALESCE(m.status, 'active') <> 'suspended'
               AND member_is_admin(m.role, m.roles)
        )
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION has_club_perm(p_club_id UUID, p_areas TEXT[] DEFAULT NULL, p_level TEXT DEFAULT 'view')
RETURNS BOOLEAN AS $$
    SELECT is_club_admin(p_club_id) OR EXISTS (
        SELECT 1
          FROM club_members m
          JOIN club_access_roles r ON r.club_id = m.club_id
         WHERE m.club_id = p_club_id
           AND m.user_id = auth.uid()
           AND COALESCE(m.membership_status, 'approved') = 'approved'
           AND COALESCE(m.status, 'active') <> 'suspended'
           AND lower(r.name) = ANY (member_labels(m.role, m.roles))
           AND EXISTS (
               SELECT 1 FROM jsonb_each_text(r.permissions) p
                WHERE (p_areas IS NULL OR p.key = ANY (p_areas))
                  AND perm_rank(p.value) >= perm_rank(p_level)
           )
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- The admin menu reads this (lib/auth-context.tsx), so it matches has_club_perm above
CREATE OR REPLACE FUNCTION my_club_permissions()
 RETURNS TABLE(club_id uuid, is_admin boolean, role_names text[], permissions jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    WITH mine AS (
        SELECT r.club_id AS cid, r.name, r.permissions AS perms
          FROM club_members m
          JOIN club_access_roles r ON r.club_id = m.club_id AND lower(r.name) = ANY (member_labels(m.role, m.roles))
         WHERE m.user_id = auth.uid()
           AND COALESCE(m.membership_status, 'approved') = 'approved'
           AND COALESCE(m.status, 'active') <> 'suspended'
    ), my_clubs AS (
        SELECT c.id AS cid FROM clubs c WHERE c.owner_id = auth.uid()
        UNION
        SELECT m.club_id FROM club_members m WHERE m.user_id = auth.uid()
    )
    SELECT
        mc.cid,
        is_club_admin(mc.cid),
        COALESCE(ARRAY(SELECT mine.name FROM mine WHERE mine.cid = mc.cid ORDER BY mine.name), '{}'),
        COALESCE((
            SELECT jsonb_object_agg(x.area, CASE x.rk WHEN 3 THEN 'full' WHEN 2 THEN 'edit' ELSE 'view' END)
              FROM (
                  SELECT p.key AS area, max(perm_rank(p.value)) AS rk
                    FROM mine, jsonb_each_text(mine.perms) p
                   WHERE mine.cid = mc.cid
                   GROUP BY p.key
                  HAVING max(perm_rank(p.value)) > 0
              ) x
        ), '{}'::jsonb)
    FROM my_clubs mc;
$function$;

-- ------------------------------------------------------------------------------
-- S4. Who may award ClubScore points, and how many.
--   ClubScore editors (gamification): any award, as before (coach bonuses, corrections).
--   Fixtures / Match Centre editors: the post-match audit only, i.e. match award types for one of
--     the club's own matches, no bigger than the club's largest rule (or 15 if that's smaller).
--   Members editors: the one-off welcome bonus when they approve an application.
-- ------------------------------------------------------------------------------
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
    v_cap INTEGER;
    v_allowed BOOLEAN := FALSE;
    v_profile member_clubscore_profiles%ROWTYPE;
    v_log gamification_activity_log%ROWTYPE;
BEGIN
    SELECT club_id INTO v_club_id FROM club_members WHERE id = p_member_id;
    IF v_club_id IS NULL THEN
        RAISE EXCEPTION 'Only club admins can award ClubScore points' USING ERRCODE = '42501';
    END IF;

    IF has_club_perm(v_club_id, '{gamification}', 'edit') THEN
        v_allowed := TRUE;
    ELSIF p_event_type IN ('match_appearance', 'match_goal', 'match_assist', 'match_clean_sheet', 'match_motm', 'disciplinary_card')
          AND has_club_perm(v_club_id, '{match-center,matches}', 'edit')
          AND EXISTS (SELECT 1 FROM matches mt WHERE mt.id = p_reference_id AND mt.club_id = v_club_id) THEN
        SELECT GREATEST(15, MAX(abs(v.value::INTEGER))) INTO v_cap
          FROM clubscore_rules r, jsonb_each_text(to_jsonb(r)) v
         WHERE r.club_id = v_club_id AND v.key LIKE 'points\_%' AND v.value ~ '^-?[0-9]+$';
        v_allowed := abs(p_points) <= COALESCE(v_cap, 15);
    ELSIF p_event_type = 'admin_award'
          AND p_description = 'Membership Application Approved & Welcome Pack'
          AND p_points BETWEEN 0 AND 50
          AND has_club_perm(v_club_id, '{members}', 'edit')
          AND NOT EXISTS (
              SELECT 1 FROM gamification_activity_log l
               WHERE l.member_id = p_member_id AND l.event_type = 'admin_award' AND l.description = p_description
          ) THEN
        v_allowed := TRUE;
    END IF;

    IF NOT v_allowed THEN
        RAISE EXCEPTION 'Your role can''t award these ClubScore points' USING ERRCODE = '42501';
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

-- ------------------------------------------------------------------------------
-- S2. Door self check-in: the 20261020 versions with an expiry check in the member-pass branch.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public_match_checkin(p_match_id uuid, p_token text DEFAULT NULL::text, p_name text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_door_code text DEFAULT NULL::text)
 RETURNS TABLE(success boolean, message text, attendee_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
            -- A lapsed membership no longer gets in (or earns points), the same as the steward scanner
            IF v_member.membership_expires_at IS NOT NULL AND v_member.membership_expires_at < CURRENT_DATE THEN
                RETURN QUERY SELECT FALSE,
                    'This membership expired on ' || to_char(v_member.membership_expires_at, 'FMDD Mon YYYY') || '. Please renew to check in.',
                    v_member.full_name::TEXT;
                RETURN;
            END IF;
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
$function$;

CREATE OR REPLACE FUNCTION public_event_checkin(p_event_id uuid, p_token text DEFAULT NULL::text, p_name text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_door_code text DEFAULT NULL::text)
 RETURNS TABLE(success boolean, message text, attendee_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
            -- A lapsed membership no longer gets in (or earns points), the same as the steward scanner
            IF v_member.membership_expires_at IS NOT NULL AND v_member.membership_expires_at < CURRENT_DATE THEN
                RETURN QUERY SELECT FALSE,
                    'This membership expired on ' || to_char(v_member.membership_expires_at, 'FMDD Mon YYYY') || '. Please renew to check in.',
                    v_member.full_name::TEXT;
                RETURN;
            END IF;
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
$function$;

-- ------------------------------------------------------------------------------
-- F1. Applying again keeps the whole plan name (it was cut to 32 characters)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION reapply_for_membership(p_club_id uuid, p_full_name text, p_phone text, p_tier text, p_role text, p_position text, p_jersey integer, p_notes text, p_date_of_birth date, p_emergency_contact text, p_terms_accepted boolean, p_guardian_consent boolean, p_guardian_name text DEFAULT NULL::text, p_guardian_email text DEFAULT NULL::text, p_guardian_phone text DEFAULT NULL::text, p_photo_consent boolean DEFAULT NULL::boolean, p_requested_team_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_id UUID;
    v_team UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Sign in to apply again' USING ERRCODE = '42501';
    END IF;
    IF COALESCE(trim(p_full_name), '') = '' OR COALESCE(trim(p_tier), '') = '' THEN
        RAISE EXCEPTION 'Name and membership tier are required' USING ERRCODE = '22023';
    END IF;
    IF NOT COALESCE(p_terms_accepted, FALSE) THEN
        RAISE EXCEPTION 'Please accept the terms and privacy policy' USING ERRCODE = '22023';
    END IF;

    -- Only an active team of this club, and only for players
    IF p_role IS DISTINCT FROM 'supporter' THEN
        SELECT id INTO v_team FROM club_teams WHERE id = p_requested_team_id AND club_id = p_club_id AND is_active;
    END IF;

    UPDATE club_members m
       SET full_name = left(trim(p_full_name), 255),
           phone = NULLIF(left(trim(COALESCE(p_phone, '')), 64), ''),
           membership_tier = left(trim(p_tier), 120),
           -- Only the roles a public application may have (see the insert policy)
           role = CASE WHEN p_role = 'supporter' THEN 'supporter' ELSE 'player' END,
           roles = '[]'::jsonb,
           player_position = CASE WHEN p_role = 'supporter' THEN NULL ELSE NULLIF(p_position, '') END,
           jersey_number = CASE WHEN p_role = 'supporter' THEN NULL ELSE p_jersey END,
           application_notes = NULLIF(left(COALESCE(p_notes, ''), 2000), ''),
           date_of_birth = p_date_of_birth,
           emergency_contact = NULLIF(left(trim(COALESCE(p_emergency_contact, '')), 255), ''),
           guardian_name = NULLIF(left(trim(COALESCE(p_guardian_name, '')), 255), ''),
           guardian_email = NULLIF(left(lower(trim(COALESCE(p_guardian_email, ''))), 255), ''),
           guardian_phone = NULLIF(left(trim(COALESCE(p_guardian_phone, '')), 64), ''),
           photo_consent = p_photo_consent,
           requested_team_id = v_team,
           terms_accepted_at = NOW(),
           guardian_consent_at = CASE WHEN COALESCE(p_guardian_consent, FALSE) THEN NOW() END,
           membership_status = 'pending',
           rejection_reason = NULL,
           reviewed_at = NULL,
           reviewed_by = NULL,
           applied_at = NOW(),
           updated_at = NOW()
      FROM auth.users u
     WHERE u.id = auth.uid()
       AND u.email_confirmed_at IS NOT NULL
       AND m.club_id = p_club_id
       AND m.user_id IS NULL
       AND m.membership_status = 'rejected'
       AND COALESCE(m.is_executive, FALSE) = FALSE
       AND lower(m.email) = lower(u.email)
    RETURNING m.id INTO v_id;

    IF v_id IS NULL THEN
        RAISE EXCEPTION 'No rejected application to reopen' USING ERRCODE = 'P0002';
    END IF;
    RETURN v_id;
END;
$function$;
