-- ==============================================================================
-- Migration: live member <-> admin messages
-- Date: 2026-10-13
--
-- Adds member_messages to the realtime publication so a member's message appears in the admin
-- inbox (and an admin's reply in the member's inbox) without a reload. Realtime applies the
-- table's row-level security, so admins receive their club's messages and members only their own.
--
-- Safe to run more than once.
-- ==============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                   WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'member_messages') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE member_messages;
    END IF;
END $$;
