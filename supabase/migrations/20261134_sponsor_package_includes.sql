-- ==============================================================================
-- Migration: what's included in each sponsorship package (SP-F6 from the 28 Oct 2026 sponsors review)
--
--   sponsorship_packages.includes
--       The ticks on the public package cards. Fixed places are stored by their key (home_page,
--       footer, match_pages, match_graphics, reports_news, event_pages; lib/sponsors.ts
--       PACKAGE_INCLUDES); anything else is an extra the club typed, such as "Matchday banner".
--       Display only: where a logo actually shows still follows the sponsor's tier and Logo size.
--
-- The site works before this runs: the ticks stay hidden until then. Read by the public with the
-- existing "Public sponsorship packages read" policy (20261010). Safe to run more than once.
-- ==============================================================================

ALTER TABLE sponsorship_packages ADD COLUMN IF NOT EXISTS includes TEXT[] NOT NULL DEFAULT '{}';

-- A short list of short lines
ALTER TABLE sponsorship_packages DROP CONSTRAINT IF EXISTS sponsorship_packages_includes_check;
ALTER TABLE sponsorship_packages ADD CONSTRAINT sponsorship_packages_includes_check
    CHECK (cardinality(includes) <= 16 AND length(array_to_string(includes, '')) <= 1200);

NOTIFY pgrst, 'reload schema';
