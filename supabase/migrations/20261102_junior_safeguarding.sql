-- ==============================================================================
-- Migration: junior (kids) team safeguarding
-- Date: 2026-11-02
--
-- Phase 3 of multiple teams per club. A player in an active team flagged junior (club_teams.is_junior,
-- 20261031_club_teams.sql) is treated as a junior on the public site:
--   * club_members_public shows them as first name + last initial, without nationality, and without
--     a photo unless a parent or guardian gave photo consent. A new is_junior column lets the site
--     leave juniors out of leaderboards and rankings.
--   * player_availabilities_public (the public matchday squad) leaves them out.
--
-- New columns:
--   clubs.junior_includes_u18       whether U18 teams count as junior (admin toggle; default yes)
--   clubs.welfare_officer_*         the club's welfare / safeguarding officer, shown on junior team pages
--   club_members.guardian_*         parent or guardian name, email and phone as proper fields
--   club_members.photo_consent      TRUE / FALSE as given by the guardian, NULL = not asked yet
--   club_members.safeguarding_check_*  staff background check (type, date, expiry)
--
-- reapply_for_membership (20261030) also takes the guardian fields, photo consent and team.
-- Guardian, consent and check columns are never in a public view: only the club's admins read them.
--
-- Safe to run more than once.
-- ==============================================================================

ALTER TABLE clubs ADD COLUMN IF NOT EXISTS junior_includes_u18 BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS welfare_officer_name TEXT;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS welfare_officer_email TEXT;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS welfare_officer_phone TEXT;

ALTER TABLE club_members ADD COLUMN IF NOT EXISTS guardian_name TEXT;
ALTER TABLE club_members ADD COLUMN IF NOT EXISTS guardian_email TEXT;
ALTER TABLE club_members ADD COLUMN IF NOT EXISTS guardian_phone TEXT;
ALTER TABLE club_members ADD COLUMN IF NOT EXISTS photo_consent BOOLEAN;
ALTER TABLE club_members ADD COLUMN IF NOT EXISTS safeguarding_check_type TEXT;
ALTER TABLE club_members ADD COLUMN IF NOT EXISTS safeguarding_check_date DATE;
ALTER TABLE club_members ADD COLUMN IF NOT EXISTS safeguarding_check_expiry_date DATE;

-- ------------------------------------------------------------------------------
-- 1. Who is a junior: a player in an active junior team
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION member_is_junior(p_member_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1
          FROM club_team_members tm
          JOIN club_teams t ON t.id = tm.team_id
         WHERE tm.member_id = p_member_id
           AND tm.team_role = 'player'
           AND tm.is_active
           AND t.is_active
           AND t.is_junior
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- "Sam Taylor" -> "Sam T.": first word and the initial of the last word of the full name (as
-- juniorPublicName in lib/teams.ts does); first / last name are used only when there's no full name
CREATE OR REPLACE FUNCTION junior_public_name(p_first TEXT, p_last TEXT, p_full TEXT)
RETURNS TEXT AS $$
    WITH n AS (
        SELECT regexp_split_to_array(
                   trim(COALESCE(NULLIF(trim(p_full), ''), concat_ws(' ', NULLIF(trim(p_first), ''), NULLIF(trim(p_last), '')), '')),
                   '\s+') AS parts
    )
    SELECT CASE
        WHEN array_length(parts, 1) IS NULL OR parts[1] = '' THEN ''
        WHEN array_length(parts, 1) = 1 THEN parts[1]
        ELSE parts[1] || ' ' || upper(left(parts[array_length(parts, 1)], 1)) || '.'
    END FROM n;
$$ LANGUAGE sql IMMUTABLE;

-- ------------------------------------------------------------------------------
-- 2. Public member view with juniors masked (same columns as 20261023, plus is_junior at the end)
-- ------------------------------------------------------------------------------
DROP VIEW IF EXISTS club_members_public;
CREATE VIEW club_members_public AS
    SELECT
        m.id, m.club_id,
        CASE WHEN j.junior THEN junior_public_name(m.first_name, m.last_name, m.full_name) ELSE m.full_name END AS full_name,
        CASE WHEN j.junior THEN split_part(junior_public_name(m.first_name, m.last_name, m.full_name), ' ', 1) ELSE m.first_name END AS first_name,
        CASE WHEN j.junior THEN NULLIF(split_part(junior_public_name(m.first_name, m.last_name, m.full_name), ' ', 2), '') ELSE m.last_name END AS last_name,
        m.role, m.roles, m.player_position, m.secondary_positions, m.jersey_number,
        CASE WHEN j.junior AND m.photo_consent IS NOT TRUE THEN NULL ELSE m.photo_url END AS photo_url,
        CASE WHEN j.junior THEN NULL ELSE m.nationality END AS nationality,
        m.preferred_foot, m.status,
        m.membership_tier, m.is_executive, m.executive_title, m.executive_bio, m.executive_order,
        m.executive_season, m.membership_status, m.created_at,
        j.junior AS is_junior
    FROM club_members m
    CROSS JOIN LATERAL (SELECT member_is_junior(m.id) AS junior) j
    WHERE COALESCE(m.membership_status, 'approved') = 'approved';
GRANT SELECT ON club_members_public TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 3. Public matchday squad without juniors (20261001_public_matchday_squad.sql)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW player_availabilities_public AS
    SELECT id, club_id, match_id, event_id, member_id, status
    FROM player_availabilities
    WHERE status = 'available' AND match_id IS NOT NULL
      AND NOT member_is_junior(member_id);
GRANT SELECT ON player_availabilities_public TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 4. Apply again after a rejection, now with the guardian, photo consent and team
--    (the new arguments default to NULL, so the earlier call still works)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS reapply_for_membership(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, DATE, TEXT, BOOLEAN, BOOLEAN);
DROP FUNCTION IF EXISTS reapply_for_membership(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, DATE, TEXT, BOOLEAN, BOOLEAN, TEXT, TEXT, TEXT, BOOLEAN, UUID);
CREATE FUNCTION reapply_for_membership(
    p_club_id UUID,
    p_full_name TEXT,
    p_phone TEXT,
    p_tier TEXT,
    p_role TEXT,
    p_position TEXT,
    p_jersey INTEGER,
    p_notes TEXT,
    p_date_of_birth DATE,
    p_emergency_contact TEXT,
    p_terms_accepted BOOLEAN,
    p_guardian_consent BOOLEAN,
    p_guardian_name TEXT DEFAULT NULL,
    p_guardian_email TEXT DEFAULT NULL,
    p_guardian_phone TEXT DEFAULT NULL,
    p_photo_consent BOOLEAN DEFAULT NULL,
    p_requested_team_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
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
           membership_tier = left(trim(p_tier), 32),
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION reapply_for_membership(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, DATE, TEXT, BOOLEAN, BOOLEAN, TEXT, TEXT, TEXT, BOOLEAN, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION reapply_for_membership(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, DATE, TEXT, BOOLEAN, BOOLEAN, TEXT, TEXT, TEXT, BOOLEAN, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
