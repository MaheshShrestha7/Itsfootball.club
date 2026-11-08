-- ==============================================================================
-- Migration: friendly match invitations
--
--   Someone from another club can invite one of our teams to a friendly, from the team's page or
--   the contact form. The invitation is a contact-form enquiry of the new type 'Friendly Match',
--   with what the fixture needs kept as structured data, so the admin never retypes it.
--
--     contact_inquiries.details   the invitation: their club and team, format, half length, up to
--                                 three dates, who hosts (see lib/friendlies.ts). NULL for every
--                                 other kind of enquiry.
--     contact_inquiries.team_id   which of our teams they invited (kept if the team is renamed)
--     contact_inquiries.match_id  the fixture the admin made from it
--     club_teams.open_to_friendlies  shows "Invite us to a friendly" on the team's page. On by
--                                 default; an admin turns it off when the team's diary is full.
--
--   The public may still only send a new, unread enquiry. They can't link it to a fixture, and an
--   invitation must be for an active team of the same club that is open to friendlies.
--
-- Run after 20261156. Safe to run again.
-- ==============================================================================

ALTER TABLE contact_inquiries DROP CONSTRAINT IF EXISTS contact_inquiries_inquiry_type_check;
ALTER TABLE contact_inquiries ADD CONSTRAINT contact_inquiries_inquiry_type_check
    CHECK (inquiry_type IN ('General Inquiry', 'Player Trial', 'Sponsorship', 'Media Request', 'Youth Academy', 'Friendly Match'));

ALTER TABLE contact_inquiries ADD COLUMN IF NOT EXISTS details JSONB;
ALTER TABLE contact_inquiries ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES club_teams(id) ON DELETE SET NULL;
ALTER TABLE contact_inquiries ADD COLUMN IF NOT EXISTS match_id UUID REFERENCES matches(id) ON DELETE SET NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contact_inquiries_details_shape') THEN
        ALTER TABLE contact_inquiries ADD CONSTRAINT contact_inquiries_details_shape
            CHECK (details IS NULL OR (jsonb_typeof(details) = 'object' AND pg_column_size(details) <= 8192));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_inquiries_match ON contact_inquiries (match_id) WHERE match_id IS NOT NULL;

ALTER TABLE club_teams ADD COLUMN IF NOT EXISTS open_to_friendlies BOOLEAN NOT NULL DEFAULT TRUE;

-- The public insert, as before, plus: no fixture link, and an invitation names an open team of this club
DROP POLICY IF EXISTS "Public contact submit" ON contact_inquiries;
CREATE POLICY "Public contact submit" ON contact_inquiries FOR INSERT
    WITH CHECK (
        status = 'unread'
        AND char_length(message) BETWEEN 1 AND 4000
        AND char_length(sender_name) BETWEEN 1 AND 255
        AND EXISTS (SELECT 1 FROM clubs c WHERE c.id = club_id AND c.is_active)
        AND match_id IS NULL
        AND (
            (inquiry_type <> 'Friendly Match' AND details IS NULL AND team_id IS NULL)
            OR (
                inquiry_type = 'Friendly Match'
                AND details IS NOT NULL
                AND EXISTS (
                    SELECT 1 FROM club_teams t
                    WHERE t.id = team_id AND t.club_id = contact_inquiries.club_id
                      AND t.is_active AND t.open_to_friendlies
                )
            )
        )
    );

COMMENT ON COLUMN contact_inquiries.details IS 'Friendly invitation details (lib/friendlies.ts); NULL for other enquiries';
COMMENT ON COLUMN contact_inquiries.team_id IS 'The team invited to a friendly';
COMMENT ON COLUMN contact_inquiries.match_id IS 'The fixture made from this invitation';
COMMENT ON COLUMN club_teams.open_to_friendlies IS 'Shows "Invite us to a friendly" on the team page';

NOTIFY pgrst, 'reload schema';
