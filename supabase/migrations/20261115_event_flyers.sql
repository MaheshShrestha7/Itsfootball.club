-- ==============================================================================
-- Migration: event flyers
-- Date: 2026-11-15
--
-- events.flyer_url   an image (poster / flyer) the club uploads in Admin -> Events. It shows on the
--                    public event page, on the club home page's event cards, and as the event's
--                    link preview. NULL = no flyer. Files live with the club's other uploads
--                    (/api/upload, folder 'event-flyers').
--
-- Until this runs, the event form hides the flyer upload and everything else works as before.
-- Safe to run more than once.
-- ==============================================================================

ALTER TABLE events ADD COLUMN IF NOT EXISTS flyer_url TEXT;

NOTIFY pgrst, 'reload schema';
