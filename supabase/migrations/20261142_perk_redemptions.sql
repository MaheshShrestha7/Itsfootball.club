-- ==============================================================================
-- Migration: perk redemptions (plans/003-member-perks.md, phase 3)
-- Date: 2026-10-31
--
-- The business taps "Mark as used" on the verify page after giving a member their perk, so the
-- sponsor's page and the club can say how often members used the offer.
--
-- perk_redemptions   one row per member, per perk, per day (Sydney date, as club_perks_public)
-- redeem_perk        the verify page's button: a valid pass and a live perk of the same club
-- perk_use_counts    uses per perk between two dates; runs as the caller, so RLS keeps it to
--                    club admins (the sponsor's page counts with the service role on the server)
--
-- Needs 20261141_member_perks.sql. Safe to run more than once.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS perk_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    perk_id UUID NOT NULL REFERENCES club_perks(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES club_members(id) ON DELETE CASCADE,
    redeemed_on DATE NOT NULL DEFAULT (NOW() AT TIME ZONE 'Australia/Sydney')::date,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (perk_id, member_id, redeemed_on)
);
CREATE INDEX IF NOT EXISTS idx_perk_redemptions_perk ON perk_redemptions (perk_id, redeemed_on);

ALTER TABLE perk_redemptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Club admin redemptions read" ON perk_redemptions;
CREATE POLICY "Club admin redemptions read" ON perk_redemptions FOR SELECT USING (is_club_admin(club_id));

-- ponytail: anyone holding the pass link can tap the button (the member too), so a count can be
-- padded by one a day per member. Upgrade: a redeem link only the sponsor holds, keyed by their
-- access_key (20261138), if a sponsor ever disputes the numbers.
CREATE OR REPLACE FUNCTION redeem_perk(p_token TEXT, p_perk_id UUID)
RETURNS TABLE (success BOOLEAN, message TEXT) AS $$
DECLARE
    v_today DATE := (NOW() AT TIME ZONE 'Australia/Sydney')::date;
    v_member club_members%ROWTYPE;
BEGIN
    -- The same pass rules as the verify page (verify_member_pass + verifyMemberPassPublic)
    SELECT * INTO v_member FROM club_members m
     WHERE m.qr_code_token = trim(COALESCE(p_token, ''))
       AND COALESCE(m.membership_status, 'approved') = 'approved'
       AND m.status <> 'suspended'
       AND (m.membership_expires_at IS NULL OR m.membership_expires_at >= v_today)
     LIMIT 1;
    IF NOT FOUND OR trim(COALESCE(p_token, '')) = '' THEN
        RETURN QUERY SELECT FALSE, 'This pass is not valid, so the perk can''t be used.'::TEXT;
        RETURN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM club_perks_public p WHERE p.id = p_perk_id AND p.club_id = v_member.club_id) THEN
        RETURN QUERY SELECT FALSE, 'This perk isn''t available any more.'::TEXT;
        RETURN;
    END IF;

    INSERT INTO perk_redemptions (club_id, perk_id, member_id, redeemed_on)
    VALUES (v_member.club_id, p_perk_id, v_member.id, v_today)
    ON CONFLICT (perk_id, member_id, redeemed_on) DO NOTHING;
    IF FOUND THEN
        RETURN QUERY SELECT TRUE, 'Marked as used. Thanks!'::TEXT;
    ELSE
        RETURN QUERY SELECT TRUE, 'Already marked as used today.'::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION redeem_perk(TEXT, UUID) TO anon, authenticated;

-- SECURITY INVOKER: perk_redemptions' RLS decides what the caller can count
CREATE OR REPLACE FUNCTION perk_use_counts(p_club_id UUID, p_since DATE DEFAULT NULL, p_until DATE DEFAULT NULL)
RETURNS TABLE (perk_id UUID, sponsor_id UUID, uses BIGINT) AS $$
    SELECT r.perk_id, p.sponsor_id, COUNT(*)
      FROM perk_redemptions r
      JOIN club_perks p ON p.id = r.perk_id
     WHERE r.club_id = p_club_id
       AND (p_since IS NULL OR r.redeemed_on >= p_since)
       AND (p_until IS NULL OR r.redeemed_on <= p_until)
     GROUP BY r.perk_id, p.sponsor_id;
$$ LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public;

REVOKE ALL ON FUNCTION perk_use_counts(UUID, DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION perk_use_counts(UUID, DATE, DATE) TO authenticated;

NOTIFY pgrst, 'reload schema';
