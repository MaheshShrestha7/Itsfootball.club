-- ==============================================================================
-- Baseline: the tables every later migration builds on. Running all migrations in
-- filename order sets up a fresh database; on an existing one this is a no-op
-- (IF NOT EXISTS / DROP ... IF EXISTS throughout).
-- Taken from the original supabase/schema.sql, which the migrations now replace.
-- ==============================================================================

-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ------------------------------------------------------------------------------
-- 3. CLUBS TABLE (Tenant Entity)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clubs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID, -- Supabase auth.users id of the club creator; recognised as admin by is_club_admin()
    slug VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    short_name VARCHAR(16) NOT NULL,
    motto VARCHAR(255),
    founded_year INTEGER DEFAULT 2024,
    logo_url TEXT,
    banner_url TEXT,
    primary_color VARCHAR(16) DEFAULT '#10B981',
    secondary_color VARCHAR(16) DEFAULT '#0F172A',
    accent_color VARCHAR(16) DEFAULT '#F59E0B',
    stadium_name VARCHAR(255),
    stadium_address TEXT,
    stadium_lat DOUBLE PRECISION,
    stadium_lng DOUBLE PRECISION,
    stadium_capacity INTEGER DEFAULT 5000,
    stadium_pitch_type VARCHAR(64) DEFAULT 'Natural Hybrid Turf',
    stadium_parking_info TEXT,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(64),
    custom_domain VARCHAR(255) UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by slug & domain
CREATE INDEX IF NOT EXISTS idx_clubs_slug ON clubs (slug);
CREATE INDEX IF NOT EXISTS idx_clubs_custom_domain ON clubs (custom_domain);

-- ------------------------------------------------------------------------------
-- 4. CLUB MEMBERS & SQUAD TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS club_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    user_id UUID, -- Optional link to Supabase auth.users
    full_name VARCHAR(255) NOT NULL,
    first_name VARCHAR(128),
    last_name VARCHAR(128),
    email VARCHAR(255),
    phone VARCHAR(64),
    role VARCHAR(32) DEFAULT 'player' CHECK (role IN ('owner', 'admin', 'staff', 'player', 'member', 'supporter')),
    roles JSONB DEFAULT '[]'::jsonb,
    player_position VARCHAR(32) CHECK (player_position IN ('GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST', 'SUB', NULL)),
    secondary_positions JSONB DEFAULT '[]'::jsonb,
    jersey_number INTEGER,
    photo_url TEXT,
    date_of_birth DATE,
    nationality VARCHAR(64),
    preferred_foot VARCHAR(16) DEFAULT 'Right',
    height_cm INTEGER,
    weight_kg INTEGER,
    status VARCHAR(32) DEFAULT 'active' CHECK (status IN ('active', 'injured', 'suspended', 'alumni')),
    qr_code_token VARCHAR(128) UNIQUE NOT NULL DEFAULT md5(random()::text || clock_timestamp()::text),
    membership_tier VARCHAR(32) DEFAULT 'Senior Player',
    membership_expires_at DATE DEFAULT (CURRENT_DATE + INTERVAL '1 year'),
    membership_status VARCHAR(16) DEFAULT 'approved',
    applied_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    reviewed_by VARCHAR(255),
    rejection_reason TEXT,
    application_notes TEXT,
    emergency_contact TEXT,

    -- Executive committee fields
    is_executive BOOLEAN DEFAULT FALSE,
    executive_title VARCHAR(128), -- e.g. "Club President", "Head Coach", "General Secretary"
    executive_bio TEXT,
    executive_order INTEGER DEFAULT 99,
    executive_season VARCHAR(64),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_members_club_id ON club_members (club_id);
CREATE INDEX IF NOT EXISTS idx_members_qr_token ON club_members (qr_code_token);
CREATE INDEX IF NOT EXISTS idx_members_role ON club_members (role);

-- ------------------------------------------------------------------------------
-- 5. PLAYER STATISTICS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS player_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES club_members(id) ON DELETE CASCADE,
    season VARCHAR(32) DEFAULT '2025/2026',
    appearances INTEGER DEFAULT 0,
    minutes_played INTEGER DEFAULT 0,
    goals INTEGER DEFAULT 0,
    assists INTEGER DEFAULT 0,
    clean_sheets INTEGER DEFAULT 0,
    yellow_cards INTEGER DEFAULT 0,
    red_cards INTEGER DEFAULT 0,
    motm_awards INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(member_id, season)
);

CREATE INDEX IF NOT EXISTS idx_player_stats_club ON player_stats (club_id);
CREATE INDEX IF NOT EXISTS idx_player_stats_goals ON player_stats (goals DESC);

-- ------------------------------------------------------------------------------
-- 6. MATCHES TABLE (Fixtures & Results)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    title VARCHAR(255),
    match_type VARCHAR(32) DEFAULT 'friendly' CHECK (match_type IN ('internal', 'friendly', 'tournament')),
    competition VARCHAR(128) NOT NULL DEFAULT 'Premier Championship',
    season VARCHAR(32) DEFAULT '2025/2026',
    opponent_name VARCHAR(255),
    opponent_short_name VARCHAR(32),
    home_team_name VARCHAR(255) NOT NULL,
    away_team_name VARCHAR(255) NOT NULL,
    home_team_logo TEXT,
    away_team_logo TEXT,
    is_club_home BOOLEAN DEFAULT TRUE,
    match_date TIMESTAMPTZ NOT NULL,
    match_time VARCHAR(16),
    venue VARCHAR(255) NOT NULL,
    match_flyer_url TEXT,
    description TEXT,
    status VARCHAR(32) DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'halftime', 'completed', 'postponed', 'cancelled')),
    featured_on_hero BOOLEAN DEFAULT FALSE,
    door_qr_checkin_enabled BOOLEAN DEFAULT FALSE,
    door_qr_code VARCHAR(128),
    checkin_count INTEGER DEFAULT 0,
    home_score INTEGER DEFAULT 0,
    away_score INTEGER DEFAULT 0,
    current_minute INTEGER DEFAULT 0,
    period_started_at TIMESTAMPTZ, -- when the current period (re)started; live minute = current_minute + elapsed
    is_paused BOOLEAN DEFAULT FALSE, -- freezes the live clock at current_minute without leaving 'live' status/period
    added_time INTEGER DEFAULT 0,
    period VARCHAR(32) DEFAULT 'pre_match' CHECK (period IN ('pre_match', 'first_half', 'halftime', 'second_half', 'extra_time', 'penalties', 'full_time')),
    home_formation VARCHAR(16) DEFAULT '4-3-3',
    away_formation VARCHAR(16) DEFAULT '4-2-3-1',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matches_club ON matches (club_id);
CREATE INDEX IF NOT EXISTS idx_matches_date ON matches (match_date);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches (status);

-- ------------------------------------------------------------------------------
-- 7. MATCH EVENTS (Live Match-Day Events)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS match_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    minute INTEGER NOT NULL,
    added_minute INTEGER DEFAULT 0,
    event_type VARCHAR(32) NOT NULL CHECK (event_type IN ('goal', 'penalty', 'own_goal', 'yellow_card', 'red_card', 'sub', 'var', 'commentary', 'whistle')),
    team_side VARCHAR(16) NOT NULL CHECK (team_side IN ('home', 'away')),
    player_name VARCHAR(255),
    assist_player_name VARCHAR(255),
    detail_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_match_events_match ON match_events (match_id, minute);

-- ------------------------------------------------------------------------------
-- 8. CLUB EVENTS (Matches, Training, Socials, AGM)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(32) NOT NULL CHECK (category IN ('match', 'training', 'social', 'agm', 'trial', 'tournament')),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    location VARCHAR(255) NOT NULL,
    max_capacity INTEGER DEFAULT 200,
    rsvp_count INTEGER DEFAULT 0,
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_club ON events (club_id, start_time);

-- ------------------------------------------------------------------------------
-- 9. EVENT ATTENDEES & CHECK-IN
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_attendees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    member_id UUID REFERENCES club_members(id) ON DELETE SET NULL,
    attendee_name VARCHAR(255) NOT NULL,
    attendee_email VARCHAR(255),
    checkin_status VARCHAR(32) DEFAULT 'registered' CHECK (checkin_status IN ('registered', 'checked_in', 'cancelled')),
    checked_in_at TIMESTAMPTZ,
    qr_ticket_code VARCHAR(128) UNIQUE NOT NULL DEFAULT md5(random()::text || clock_timestamp()::text),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendees_event ON event_attendees (event_id);
CREATE INDEX IF NOT EXISTS idx_attendees_qr ON event_attendees (qr_ticket_code);

-- ------------------------------------------------------------------------------
-- 10. SPONSORS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sponsors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    -- When set, this sponsor is scoped to one event instead of the whole club.
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    logo_url TEXT NOT NULL,
    website_url TEXT,
    tier VARCHAR(32) NOT NULL DEFAULT 'gold' CHECK (tier IN ('platinum', 'gold', 'silver', 'bronze', 'grassroots')),
    size_scale VARCHAR(16) DEFAULT 'auto',
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    -- Sponsorship deal / CRM fields - admin-only, see sponsors_public view below.
    contact_name VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(64),
    package_value NUMERIC(12, 2),
    package_status VARCHAR(32) DEFAULT 'confirmed' CHECK (package_status IN ('prospect', 'confirmed', 'paid', 'expired', 'cancelled')),
    season VARCHAR(32),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sponsors_club ON sponsors (club_id, tier, display_order);
CREATE INDEX IF NOT EXISTS idx_sponsors_event ON sponsors (event_id);

-- ------------------------------------------------------------------------------
-- 11. NEWS & CONTENT TABLE (CMS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS news_articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    summary TEXT,
    content TEXT NOT NULL,
    cover_image_url TEXT,
    video_embed_url TEXT,
    author_name VARCHAR(128) DEFAULT 'Club Media Team',
    tags TEXT[] DEFAULT ARRAY['Club News'],
    is_featured BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(club_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_news_club ON news_articles (club_id, published_at DESC);

-- ------------------------------------------------------------------------------
-- 12. MEDIA GALLERY TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS media_gallery (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    media_type VARCHAR(16) NOT NULL CHECK (media_type IN ('image', 'video')),
    media_url TEXT NOT NULL,
    thumbnail_url TEXT,
    album_name VARCHAR(128) DEFAULT 'Matchday Moments',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gallery_club ON media_gallery (club_id, created_at DESC);

-- ------------------------------------------------------------------------------
-- 13. CLUB PUBLIC PAGE ANALYTICS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS club_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL, -- e.g. 'page_view', 'pass_scanned', 'match_view', 'fixture_click'
    page_path VARCHAR(255),
    visitor_hash VARCHAR(64),
    referrer TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_club ON club_analytics (club_id, created_at);

-- ------------------------------------------------------------------------------
-- 14. CONTACT INQUIRIES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contact_inquiries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    sender_name VARCHAR(255) NOT NULL,
    sender_email VARCHAR(255) NOT NULL,
    sender_phone VARCHAR(64),
    inquiry_type VARCHAR(64) DEFAULT 'General Inquiry' CHECK (inquiry_type IN ('General Inquiry', 'Player Trial', 'Sponsorship', 'Media Request', 'Youth Academy')),
    message TEXT NOT NULL,
    status VARCHAR(32) DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'replied', 'archived')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inquiries_club ON contact_inquiries (club_id, created_at DESC);


-- ------------------------------------------------------------------------------
-- Row level security. Admin policies come from 20260921_fix_rls_recursion_and_accent_color
-- and later; these are the public reads the base tables start with.
-- ------------------------------------------------------------------------------
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_gallery ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public clubs read" ON clubs;
CREATE POLICY "Public clubs read" ON clubs FOR SELECT USING (is_active = TRUE);

DROP POLICY IF EXISTS "Public player_stats read" ON player_stats;
CREATE POLICY "Public player_stats read" ON player_stats FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Public matches read" ON matches;
CREATE POLICY "Public matches read" ON matches FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Public match_events read" ON match_events;
CREATE POLICY "Public match_events read" ON match_events FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Public events read" ON events;
CREATE POLICY "Public events read" ON events FOR SELECT USING (is_public = TRUE);

DROP POLICY IF EXISTS "Public news read" ON news_articles;
CREATE POLICY "Public news read" ON news_articles FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Public media read" ON media_gallery;
CREATE POLICY "Public media read" ON media_gallery FOR SELECT USING (TRUE);
