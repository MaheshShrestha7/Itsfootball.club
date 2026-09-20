-- Migration: Add Match Scheduling, Type, Flyer, and Door QR Check-in columns to matches table

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS title VARCHAR(255),
  ADD COLUMN IF NOT EXISTS match_type VARCHAR(32) DEFAULT 'friendly' CHECK (match_type IN ('internal', 'friendly', 'tournament')),
  ADD COLUMN IF NOT EXISTS opponent_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS opponent_short_name VARCHAR(32),
  ADD COLUMN IF NOT EXISTS match_time VARCHAR(16),
  ADD COLUMN IF NOT EXISTS match_flyer_url TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS featured_on_hero BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS door_qr_checkin_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS door_qr_code VARCHAR(128),
  ADD COLUMN IF NOT EXISTS checkin_count INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_matches_type ON matches (club_id, match_type);
CREATE INDEX IF NOT EXISTS idx_matches_door_qr ON matches (door_qr_code);
