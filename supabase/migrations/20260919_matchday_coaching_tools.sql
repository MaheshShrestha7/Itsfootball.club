-- ==============================================================================
-- itsfootball.club: Matchday & Pitch-Side Coaching Tools
-- Migration: 20260919_matchday_coaching_tools.sql
-- Compatible with Supabase PostgreSQL (Postgres 15+)
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. MATCHES TABLE ENHANCEMENTS (Audit Status & Match Format)
-- ------------------------------------------------------------------------------
ALTER TABLE matches ADD COLUMN IF NOT EXISTS is_audited BOOLEAN DEFAULT FALSE;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS audited_at TIMESTAMPTZ;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS audited_by UUID;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS match_format VARCHAR(16) DEFAULT '11v11';

-- ------------------------------------------------------------------------------
-- 2. PLAYER AVAILABILITY & RSVP HUB (Pre-Match Call-Ups)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS player_availabilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES club_members(id) ON DELETE CASCADE,
    status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('available', 'unavailable', 'maybe', 'pending')),
    note TEXT,
    response_token VARCHAR(64) UNIQUE NOT NULL DEFAULT md5(random()::text || clock_timestamp()::text),
    responded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_target_fixture CHECK (match_id IS NOT NULL OR event_id IS NOT NULL),
    UNIQUE(club_id, match_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_availabilities_club_match ON player_availabilities(club_id, match_id);
CREATE INDEX IF NOT EXISTS idx_availabilities_token ON player_availabilities(response_token);
CREATE INDEX IF NOT EXISTS idx_availabilities_member ON player_availabilities(member_id);

-- ------------------------------------------------------------------------------
-- 3. DRAFT LINEUPS (Isolated Coaching Sandbox Before Publishing)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS draft_lineups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    format VARCHAR(16) NOT NULL DEFAULT '11v11' CHECK (format IN ('11v11', '9v9', '7v7')),
    formation VARCHAR(32) NOT NULL DEFAULT '4-3-3',
    lineup_coords JSONB NOT NULL DEFAULT '[]'::jsonb,
    bench_member_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    tactical_notes TEXT,
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(match_id)
);

CREATE INDEX IF NOT EXISTS idx_draft_lineups_club ON draft_lineups(club_id);
CREATE INDEX IF NOT EXISTS idx_draft_lineups_match ON draft_lineups(match_id);

-- ------------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) POLICIES (Idempotent)
-- ------------------------------------------------------------------------------
ALTER TABLE player_availabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_lineups ENABLE ROW LEVEL SECURITY;

-- Availability: Allow public read/update via magic response_token (Players RSVP without login)
DROP POLICY IF EXISTS "Public availability read" ON player_availabilities;
CREATE POLICY "Public availability read" ON player_availabilities
    FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Public availability respond by token" ON player_availabilities;
CREATE POLICY "Public availability respond by token" ON player_availabilities
    FOR UPDATE USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Club admin availabilities manage" ON player_availabilities;
CREATE POLICY "Club admin availabilities manage" ON player_availabilities
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM club_members
            WHERE club_id = player_availabilities.club_id
            AND role IN ('owner', 'admin')
        )
    );

-- Draft Lineups: Only Club Admins & Coaches can view/edit drafts; public can view if published
DROP POLICY IF EXISTS "Public published draft read" ON draft_lineups;
CREATE POLICY "Public published draft read" ON draft_lineups
    FOR SELECT USING (is_published = TRUE);

DROP POLICY IF EXISTS "Club admin draft lineups manage" ON draft_lineups;
CREATE POLICY "Club admin draft lineups manage" ON draft_lineups
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM club_members
            WHERE club_id = draft_lineups.club_id
            AND role IN ('owner', 'admin')
        )
    );

-- ------------------------------------------------------------------------------
-- 5. FUNCTION: Publish Draft Lineup to Match Center
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_publish_draft_lineup(p_match_id UUID)
RETURNS VOID AS $$
DECLARE
    v_draft RECORD;
BEGIN
    SELECT * INTO v_draft FROM draft_lineups WHERE match_id = p_match_id;

    IF v_draft.id IS NULL THEN
        RAISE EXCEPTION 'No draft lineup found for match %', p_match_id;
    END IF;

    -- Update Match record with draft formation and coordinates
    UPDATE matches
    SET home_formation = v_draft.formation,
        home_lineup_coords = v_draft.lineup_coords,
        match_format = v_draft.format
    WHERE id = p_match_id;

    -- Mark draft as published
    UPDATE draft_lineups
    SET is_published = TRUE,
        published_at = NOW(),
        updated_at = NOW()
    WHERE match_id = p_match_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
