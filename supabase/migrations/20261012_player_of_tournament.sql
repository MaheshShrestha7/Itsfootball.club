-- ==============================================================================
-- Migration: Player of the Tournament award
-- Date: 2026-10-12
--
-- Set from the admin tournament page. The name is stored as well as the member id, so the
-- award still reads correctly for a guest-team player or a member who later leaves.
-- Written directly by the admin page (club admins can already update tournaments), not by the
-- background sync, so existing tournament saves are unaffected.
--
-- Safe to run more than once.
-- ==============================================================================

ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS player_of_tournament_member_id UUID REFERENCES club_members(id) ON DELETE SET NULL;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS player_of_tournament_name VARCHAR(255);
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS player_of_tournament_note TEXT;

NOTIFY pgrst, 'reload schema';
