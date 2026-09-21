-- ==============================================================================
-- 20260921_tournaments_internal_teams.sql
-- Tournaments & Internal Teams Engine (Challonge Parity for Football)
-- ==============================================================================

-- 1. Internal Teams Table
CREATE TABLE IF NOT EXISTS internal_teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    short_name VARCHAR(16) NOT NULL,
    color VARCHAR(32) DEFAULT '#10B981',
    logo_url TEXT,
    captain_id UUID REFERENCES club_members(id) ON DELETE SET NULL,
    coach_name VARCHAR(128),
    player_ids JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_internal_teams_club ON internal_teams (club_id);

-- 2. Tournaments Table
CREATE TABLE IF NOT EXISTS tournaments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    season VARCHAR(32) DEFAULT '2026/27',
    format VARCHAR(32) NOT NULL DEFAULT 'knockout' CHECK (format IN ('knockout', 'league', 'group_knockout')),
    status VARCHAR(32) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ongoing', 'completed')),
    points_win INTEGER DEFAULT 3,
    points_draw INTEGER DEFAULT 1,
    points_loss INTEGER DEFAULT 0,
    group_count INTEGER DEFAULT 2,
    teams_advancing_per_group INTEGER DEFAULT 2,
    has_third_place_match BOOLEAN DEFAULT FALSE,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ,
    venue VARCHAR(255),
    description TEXT,
    banner_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournaments_club ON tournaments (club_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_slug ON tournaments (club_id, slug);

-- 3. Tournament Participants Table
CREATE TABLE IF NOT EXISTS tournament_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    team_type VARCHAR(16) NOT NULL DEFAULT 'internal' CHECK (team_type IN ('internal', 'external')),
    internal_team_id UUID REFERENCES internal_teams(id) ON DELETE SET NULL,
    name VARCHAR(128) NOT NULL,
    short_name VARCHAR(16) NOT NULL,
    logo_url TEXT,
    color VARCHAR(32),
    seed INTEGER,
    "group" VARCHAR(8),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournament_participants_tourn ON tournament_participants (tournament_id);

-- 4. Extend Matches Table with Tournament Relational Columns
ALTER TABLE matches
    ADD COLUMN IF NOT EXISTS tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS tournament_stage VARCHAR(32) CHECK (tournament_stage IN ('group', 'round_of_16', 'quarter_final', 'semi_final', 'final', 'third_place')),
    ADD COLUMN IF NOT EXISTS tournament_group VARCHAR(16),
    ADD COLUMN IF NOT EXISTS tournament_round INTEGER,
    ADD COLUMN IF NOT EXISTS tournament_match_number INTEGER,
    ADD COLUMN IF NOT EXISTS home_team_source VARCHAR(64),
    ADD COLUMN IF NOT EXISTS away_team_source VARCHAR(64),
    ADD COLUMN IF NOT EXISTS home_penalty_score INTEGER,
    ADD COLUMN IF NOT EXISTS away_penalty_score INTEGER,
    ADD COLUMN IF NOT EXISTS winner_side VARCHAR(8) CHECK (winner_side IN ('home', 'away')),
    ADD COLUMN IF NOT EXISTS next_match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS next_match_slot VARCHAR(8) CHECK (next_match_slot IN ('home', 'away'));

CREATE INDEX IF NOT EXISTS idx_matches_tournament ON matches (tournament_id);
CREATE INDEX IF NOT EXISTS idx_matches_tournament_stage ON matches (tournament_id, tournament_stage);
