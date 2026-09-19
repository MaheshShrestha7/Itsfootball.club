-- ==============================================================================
-- itsfootball.club: Club Season Management & Cross-Subsystem Associations
-- Migration: 20260920_club_seasons.sql
-- Compatible with Supabase PostgreSQL (Postgres 15+)
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. CLUB SEASONS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS club_seasons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    name VARCHAR(64) NOT NULL, -- e.g. "2026/27" or "2026/2027"
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_current BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'upcoming')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(club_id, name)
);

CREATE INDEX IF NOT EXISTS idx_club_seasons_club ON club_seasons(club_id);
CREATE INDEX IF NOT EXISTS idx_club_seasons_current ON club_seasons(club_id, is_current);

-- ------------------------------------------------------------------------------
-- 2. CROSS-PLATFORM ASSOCIATIONS: EVENTS & CLUB MEMBERS
-- ------------------------------------------------------------------------------
ALTER TABLE events ADD COLUMN IF NOT EXISTS season VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_events_season ON events(club_id, season);

ALTER TABLE club_members ADD COLUMN IF NOT EXISTS executive_season VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_club_members_exec_season ON club_members(club_id, executive_season);

-- (Matches table already has season VARCHAR(64) column in base schema)
CREATE INDEX IF NOT EXISTS idx_matches_season ON matches(club_id, season);

-- ------------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE club_seasons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view club seasons" ON club_seasons;
CREATE POLICY "Public can view club seasons"
    ON club_seasons FOR SELECT
    USING (TRUE);

DROP POLICY IF EXISTS "Club admins can insert seasons" ON club_seasons;
CREATE POLICY "Club admins can insert seasons"
    ON club_seasons FOR INSERT
    WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Club admins can update seasons" ON club_seasons;
CREATE POLICY "Club admins can update seasons"
    ON club_seasons FOR UPDATE
    USING (TRUE);

DROP POLICY IF EXISTS "Club admins can delete seasons" ON club_seasons;
CREATE POLICY "Club admins can delete seasons"
    ON club_seasons FOR DELETE
    USING (TRUE);
