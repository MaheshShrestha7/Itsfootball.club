-- ==============================================================================
-- Migration: member perks (plans/003-member-perks.md, phase 1)
-- Date: 2026-10-31
--
-- "Show your pass at Joe's Pizza for 10% off": offers members get, usually from a sponsor.
--
-- club_perks              the offer. Admins only; everyone else reads club_perks_public
-- club_perk_codes         an optional discount code, in its own table so no public read can show it
-- club_perks_public       the live perks: switched on, not past ends_on, and their sponsor (if any)
--                         still on the site (sponsors_public), with the business name and logo
-- is_active_club_member   the signed-in user is an approved, unsuspended, in-date member of the
--                         club, or the guardian of one (phase 4's member prices use it too)
-- my_perk_codes           the codes, for active members, their guardians and club admins
--
-- Safe to run more than once.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS club_perks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    sponsor_id UUID REFERENCES sponsors(id) ON DELETE SET NULL,
    title VARCHAR(120) NOT NULL,
    details TEXT,
    -- Used when there is no sponsor_id
    business_name VARCHAR(120),
    url TEXT,
    -- Last day it shows (YYYY-MM-DD); blank = no end date
    ends_on DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_club_perks_club ON club_perks (club_id, sort_order);

CREATE TABLE IF NOT EXISTS club_perk_codes (
    perk_id UUID PRIMARY KEY REFERENCES club_perks(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    code VARCHAR(60) NOT NULL
);

ALTER TABLE club_perks ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_perk_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Club admin perks manage" ON club_perks;
CREATE POLICY "Club admin perks manage" ON club_perks FOR ALL
    USING (is_club_admin(club_id)) WITH CHECK (is_club_admin(club_id));
DROP POLICY IF EXISTS "Club admin perk codes manage" ON club_perk_codes;
CREATE POLICY "Club admin perk codes manage" ON club_perk_codes FOR ALL
    USING (is_club_admin(club_id)) WITH CHECK (is_club_admin(club_id));

-- Same dates as sponsors_public (20261132): a perk shows to the end of its ends_on, Sydney time
CREATE OR REPLACE VIEW club_perks_public AS
    SELECT
        p.id, p.club_id, p.sponsor_id, p.title, p.details, p.url, p.ends_on, p.sort_order,
        COALESCE(s.name, p.business_name)::TEXT AS business_name,
        s.logo_url
    FROM club_perks p
    LEFT JOIN sponsors_public s ON s.id = p.sponsor_id AND s.club_id = p.club_id
    WHERE p.is_active = TRUE
      AND (p.ends_on IS NULL OR p.ends_on >= (NOW() AT TIME ZONE 'Australia/Sydney')::date)
      AND (p.sponsor_id IS NULL OR s.id IS NOT NULL);

GRANT SELECT ON club_perks_public TO anon, authenticated;

CREATE OR REPLACE FUNCTION is_active_club_member(p_club_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM club_members m
         WHERE m.club_id = p_club_id
           AND (m.user_id = auth.uid()
                OR (COALESCE(m.guardian_email, '') <> '' AND lower(m.guardian_email) = my_confirmed_email()))
           AND COALESCE(m.membership_status, 'approved') = 'approved'
           AND m.status <> 'suspended'
           AND (m.membership_expires_at IS NULL OR m.membership_expires_at >= (NOW() AT TIME ZONE 'Australia/Sydney')::date)
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION my_perk_codes(p_club_id UUID)
RETURNS TABLE (perk_id UUID, code TEXT) AS $$
    SELECT c.perk_id, c.code::TEXT
      FROM club_perk_codes c
      JOIN club_perks_public p ON p.id = c.perk_id
     WHERE c.club_id = p_club_id
       AND (is_active_club_member(p_club_id) OR is_club_admin(p_club_id));
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION is_active_club_member(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION my_perk_codes(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION is_active_club_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION my_perk_codes(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
