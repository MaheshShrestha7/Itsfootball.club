-- Matchday details a coach sends every week, now kept on the fixture:
--   * meet_time: when players should be at the ground ("09:15")
--   * kit: what to wear ("Away kit, white socks")
--   * bench_member_ids: the named substitutes, saved when the line-up is published, so the public
--     match page can list Starting and Substitutes instead of everyone who said "In"
-- All optional. The app hides the new boxes until this has run.

ALTER TABLE matches ADD COLUMN IF NOT EXISTS meet_time TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS kit TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS bench_member_ids UUID[];

NOTIFY pgrst, 'reload schema';
