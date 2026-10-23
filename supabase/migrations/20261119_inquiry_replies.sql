-- Replies to contact-form enquiries, sent from the Inbox (ADM-P10).
-- Before this, "Reply" only opened the admin's own mail app, so the club had no record of what
-- was said or who answered. Each reply is kept here, and emailed to the enquirer when email is set up.
--
-- Written only by /api/admin/inquiries/reply (service role, after checking the caller's Inbox
-- permission); admins who can see the Inbox can read the history.

CREATE TABLE IF NOT EXISTS contact_inquiry_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inquiry_id UUID NOT NULL REFERENCES contact_inquiries(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
    sent_by_name VARCHAR(255),
    sent_by_user UUID,
    emailed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inquiry_replies_inquiry ON contact_inquiry_replies (inquiry_id, created_at);
CREATE INDEX IF NOT EXISTS idx_inquiry_replies_club ON contact_inquiry_replies (club_id, created_at DESC);

ALTER TABLE contact_inquiry_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Club admin inquiry replies read" ON contact_inquiry_replies;
CREATE POLICY "Club admin inquiry replies read" ON contact_inquiry_replies FOR SELECT
    USING (has_club_perm(club_id, '{inquiries}', 'view'));
