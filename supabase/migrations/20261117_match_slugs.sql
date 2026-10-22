-- Readable match addresses: /{club}/match/riverside-fc-vs-parramatta-city-2026-10-16 instead of the id.
-- The id address keeps working (it redirects), and so does an old slug after a fixture is renamed or
-- moved (previous_slugs). The slug is always worked out here, never sent by the app, so the app keeps
-- working the same before and after this migration. Safe to run more than once.

ALTER TABLE matches ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS previous_slugs TEXT[] NOT NULL DEFAULT '{}';

-- "riverside-fc-vs-parramatta-city-2026-10-16": the teams, then the day in Sydney time
CREATE OR REPLACE FUNCTION match_slug_base(home TEXT, away TEXT, kickoff TIMESTAMPTZ)
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(
    trim(BOTH '-' FROM left(
      trim(BOTH '-' FROM regexp_replace(
        -- "St. George's" -> st-georges, "Café" -> cafe (common accents; anything else is dropped)
        translate(regexp_replace(lower(COALESCE(home, '') || ' vs ' || COALESCE(away, '')), '[''’]', '', 'g'),
          'áàâäãåāéèêëēíìîïīóòôöõøōúùûüūçñýÿ', 'aaaaaaaeeeeeiiiiiooooooouuuuucnyy'),
        '[^a-z0-9]+', '-', 'g')),
      80
    ))
    || COALESCE('-' || to_char(kickoff AT TIME ZONE 'Australia/Sydney', 'YYYY-MM-DD'), ''),
    ''), 'match')
$$;

CREATE OR REPLACE FUNCTION assign_match_slug()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_base TEXT := match_slug_base(NEW.home_team_name, NEW.away_team_name, NEW.match_date);
  v_slug TEXT := v_base;
  v_n INT := 1;
BEGIN
  -- The app never sets these: on an update, keep what was there
  IF TG_OP = 'UPDATE' THEN
    NEW.previous_slugs := COALESCE(OLD.previous_slugs, '{}');
    -- Same teams and day: keep the slug (including a -2 suffix it already has)
    IF OLD.slug IS NOT NULL AND (OLD.slug = v_base OR OLD.slug ~ ('^' || v_base || '-[0-9]+$')) THEN
      NEW.slug := OLD.slug;
      RETURN NEW;
    END IF;
  ELSE
    NEW.previous_slugs := '{}';
  END IF;

  -- Two matches of one club can share teams and a day (a cup group and a final): add -2, -3...
  WHILE EXISTS (
    SELECT 1 FROM matches m
    WHERE m.club_id = NEW.club_id AND m.id <> NEW.id
      AND (m.slug = v_slug OR v_slug = ANY(m.previous_slugs))
  ) LOOP
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  END LOOP;

  -- Renamed or moved: the old address keeps working
  IF TG_OP = 'UPDATE' AND OLD.slug IS NOT NULL AND OLD.slug <> v_slug THEN
    NEW.previous_slugs := array_append(array_remove(NEW.previous_slugs, OLD.slug), OLD.slug);
  END IF;
  NEW.previous_slugs := array_remove(NEW.previous_slugs, v_slug);
  NEW.slug := v_slug;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS matches_assign_slug ON matches;
CREATE TRIGGER matches_assign_slug
  BEFORE INSERT OR UPDATE OF home_team_name, away_team_name, match_date, slug, previous_slugs ON matches
  FOR EACH ROW EXECUTE FUNCTION assign_match_slug();

-- Lookups by club and slug. Not unique on purpose: two admins saving the same fixture at the same
-- moment must never get an error; the page picks the earliest match if that ever happens.
CREATE INDEX IF NOT EXISTS matches_club_slug_idx ON matches (club_id, slug);
CREATE INDEX IF NOT EXISTS matches_previous_slugs_idx ON matches USING gin (previous_slugs);

-- Existing matches, oldest first, so the earlier of two same-day fixtures keeps the plain slug
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM matches WHERE slug IS NULL ORDER BY created_at NULLS FIRST, id LOOP
    UPDATE matches SET slug = NULL WHERE id = r.id;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
