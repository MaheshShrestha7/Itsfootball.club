-- ==============================================================================
-- Migration: sponsors fixes from the 28 Oct 2026 review (SP-B2, SP-B6, SP-B9)
--
--   SP-B6  sponsors_public (what visitors' browsers read) leaves out sponsorships marked Expired or
--          Cancelled, as well as hidden ones. The site checks this too, so it works before this runs.
--   SP-B2  Website sign-ups were saved with the itsfootball.club logo as a placeholder. They now
--          have no logo (their initials show) until the club uploads one; old rows are cleared here.
--   SP-B9  Website sign-ups wrote the package's name into the badge label. Labels that exactly
--          match one of the club's package names are cleared, so the badge shows the tier name
--          ("Gold Partner") unless an admin types a label.
--
-- No new columns (label is from 20261127 and is added here too if missing). Run after 20261129 (or 20261130 if that has run). Safe to run more than once.
-- ==============================================================================

-- The label column from 20261127, in case that one hasn't run yet
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS label VARCHAR(60);

-- SP-B6: same columns as 20261127, plus the ended check
CREATE OR REPLACE VIEW sponsors_public AS
    SELECT
        id, club_id, event_id, name, logo_url, website_url, tier, size_scale,
        display_order, is_active, season, label
    FROM sponsors
    WHERE is_active = TRUE
      AND COALESCE(package_status, '') NOT IN ('expired', 'cancelled');

GRANT SELECT ON sponsors_public TO anon, authenticated;

-- SP-B2: the platform logo was never the sponsor's own
UPDATE sponsors SET logo_url = '' WHERE logo_url = '/logo-96.png';

-- SP-B9: badge labels that are just a package name
UPDATE sponsors s
   SET label = NULL
 WHERE s.label IS NOT NULL
   AND EXISTS (
       SELECT 1 FROM sponsorship_packages p
        WHERE p.club_id = s.club_id
          AND lower(trim(p.name)) = lower(trim(s.label))
   );
