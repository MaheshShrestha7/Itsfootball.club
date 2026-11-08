-- ==============================================================================
-- Migration: friendly invitations, part 2 (the visitor's side)
--
--     contact_inquiries.response_token  a private link for the person who sent the invitation: when
--                                       the club suggests other dates, the visitor opens
--                                       /{club}/friendly/{token} and picks one. Set by the server only.
--     contact_inquiries.details         may now also hold the visitor's crest (a small image the form
--                                       shrinks to 96 px) and the dates the club suggested, so its
--                                       size limit goes from 8 KB to 24 KB.
--
--   The public still can't set a token or the club's dates: the insert rule from 20261157 only allows
--   a new, unread enquiry, and this adds token IS NULL and no suggested/picked dates in details.
--   Reading and answering by token goes through the server (/api/friendly), which uses the service
--   role, so no new public policy is needed.
--
-- Run after 20261157. Safe to run again.
-- ==============================================================================

ALTER TABLE contact_inquiries ADD COLUMN IF NOT EXISTS response_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_inquiries_response_token ON contact_inquiries (response_token) WHERE response_token IS NOT NULL;

ALTER TABLE contact_inquiries DROP CONSTRAINT IF EXISTS contact_inquiries_details_shape;
ALTER TABLE contact_inquiries ADD CONSTRAINT contact_inquiries_details_shape
    CHECK (details IS NULL OR (jsonb_typeof(details) = 'object' AND pg_column_size(details) <= 24576));

DROP POLICY IF EXISTS "Public contact submit" ON contact_inquiries;
CREATE POLICY "Public contact submit" ON contact_inquiries FOR INSERT
    WITH CHECK (
        status = 'unread'
        AND char_length(message) BETWEEN 1 AND 4000
        AND char_length(sender_name) BETWEEN 1 AND 255
        AND EXISTS (SELECT 1 FROM clubs c WHERE c.id = club_id AND c.is_active)
        AND match_id IS NULL
        AND response_token IS NULL
        -- Suggested and picked dates, and what was emailed, are written by the server only
        AND (details IS NULL OR NOT (details ?| ARRAY['suggested', 'picked', 'sent']))
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

COMMENT ON COLUMN contact_inquiries.response_token IS 'Private link token for the visitor to pick a suggested friendly date';

NOTIFY pgrst, 'reload schema';
