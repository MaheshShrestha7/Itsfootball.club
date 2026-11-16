-- ==============================================================================
-- Migration: The cup write-up (how the team finished, the cup winner, the club's own words)
--
-- When an event with linked games is marked Completed, the event page and News show a write-up
-- built from the games the club logged. Three things the games can't tell are asked for once,
-- in the Mark as completed popup, and kept on the event (public on purpose: they are printed
-- in the write-up):
--   * cup_finish: how each team finished, keyed by team id ('club' for games with no team):
--     {"<key>": {"stage": "won|final|semi|quarter|group", "place": 3, "through": 2}}
--   * cup_winner: who won the cup, as typed
--   * writeup_note: a few words from the club printed at the end (thanks, congratulations)
-- The committee's private notes stay in event_reviews.
-- The app hides the popup's questions until this has run; the write-up still shows without them.
--
-- Safe to run more than once.
-- ==============================================================================

ALTER TABLE events ADD COLUMN IF NOT EXISTS cup_finish JSONB;
ALTER TABLE events ADD COLUMN IF NOT EXISTS cup_winner TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS writeup_note TEXT;

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_cup_finish_shape;
ALTER TABLE events ADD CONSTRAINT events_cup_finish_shape
    CHECK (cup_finish IS NULL OR (jsonb_typeof(cup_finish) = 'object' AND pg_column_size(cup_finish) < 4000));
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_cup_winner_len;
ALTER TABLE events ADD CONSTRAINT events_cup_winner_len CHECK (cup_winner IS NULL OR char_length(cup_winner) <= 120);
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_writeup_note_len;
ALTER TABLE events ADD CONSTRAINT events_writeup_note_len CHECK (writeup_note IS NULL OR char_length(writeup_note) <= 1000);

NOTIFY pgrst, 'reload schema';
