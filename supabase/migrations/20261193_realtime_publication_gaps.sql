-- ==============================================================================
-- Migration: live updates for the club's own tables
-- Date: 2026-11-27
--
-- The app listens for changes on 13 tables. Seven of them were never added to the realtime
-- publication by a migration: clubs, club_members, club_seasons, events, sponsors, news_articles
-- and media_gallery. They all shared one channel with matches, and Supabase sends nothing on a
-- channel when one of its tables isn't published, so public match pages stopped updating live.
-- The app now uses one channel per table (live scores work without this migration); this adds the
-- seven tables so their own changes show live too. Realtime applies each table's row-level
-- security, so nobody receives a row they couldn't already read.
--
-- Safe to run more than once.
-- ==============================================================================

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['clubs', 'club_members', 'club_seasons', 'events', 'sponsors', 'news_articles', 'media_gallery'] LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
        END IF;
    END LOOP;
END $$;
