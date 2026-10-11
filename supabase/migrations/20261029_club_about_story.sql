-- ==============================================================================
-- Migration: club story for the About page
-- Date: 2026-10-29
--
-- Each club can tell its story on /<club>/about. Admins write it on the Branding page with the
-- news editor, so it is the same HTML as a news article body (sanitised in the browser before it
-- is shown). Written like the rest of the branding (clubs update policy).
--
-- Run this before deploying the code that uses it: the app writes the column when a story is saved.
-- Safe to run more than once.
-- ==============================================================================

ALTER TABLE clubs ADD COLUMN IF NOT EXISTS about_story TEXT;

NOTIFY pgrst, 'reload schema';
