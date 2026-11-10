-- ==============================================================================
-- Migration: the home page's demo club (F10-9, project scan 2026-11-10)
-- Date: 2026-11-10
--
-- itsfootball.club's home page links to one club as "See a live club site". It used to be whichever
-- club happened to be listed first. Now a platform admin picks it in Mission Control -> Clubs ->
-- (a club) -> "Use as the home page demo". Until one is picked, the home page keeps the old behaviour.
--
-- platform_home_demo     one row at most: the club the home page shows. Anyone can read it.
-- platform_set_home_demo  Super admins and Operators only (is_platform_operator, two-step sign-in).
--                         NULL clears it.
-- Safe to run more than once.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS platform_home_demo (
    id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
    club_id UUID REFERENCES clubs(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID
);

ALTER TABLE platform_home_demo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone reads the home demo" ON platform_home_demo;
CREATE POLICY "Anyone reads the home demo" ON platform_home_demo FOR SELECT USING (TRUE);
-- No insert, update or delete policies: platform_set_home_demo() below does that
GRANT SELECT ON platform_home_demo TO anon, authenticated;

CREATE OR REPLACE FUNCTION platform_set_home_demo(p_club_id UUID)
RETURNS VOID AS $$
BEGIN
    IF NOT COALESCE(is_platform_operator(), FALSE) THEN
        RAISE EXCEPTION 'Only platform Operators can choose the home page demo';
    END IF;
    IF p_club_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM clubs WHERE id = p_club_id AND is_active) THEN
        RAISE EXCEPTION 'Pick an active club';
    END IF;
    INSERT INTO platform_home_demo (id, club_id, updated_at, updated_by)
    VALUES (TRUE, p_club_id, NOW(), auth.uid())
    ON CONFLICT (id) DO UPDATE SET club_id = EXCLUDED.club_id, updated_at = NOW(), updated_by = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION platform_set_home_demo(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION platform_set_home_demo(UUID) TO authenticated;
