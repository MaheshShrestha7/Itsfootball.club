-- ==============================================================================
-- Migration: live contact-form enquiries
-- Date: 2026-10-19
--
-- Adds contact_inquiries to the realtime publication so a new enquiry updates the admin Inbox
-- badge without a reload, as member_messages already does (20261013). Realtime applies the
-- table's row-level security, so only the club's admins receive its enquiries.
--
-- Safe to run more than once.
-- ==============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                   WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'contact_inquiries') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE contact_inquiries;
    END IF;
END $$;
