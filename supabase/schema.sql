-- ==============================================================================
-- itsfootball.club: Multi-Tenant Database Schema
-- Supabase PostgreSQL with Row Level Security (RLS) & Realtime
-- ==============================================================================

-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Clean Up (for fresh migrations if re-run)
-- DROP TABLE IF EXISTS contact_inquiries CASCADE;
-- DROP TABLE IF EXISTS club_analytics CASCADE;
-- DROP TABLE IF EXISTS media_gallery CASCADE;
-- DROP TABLE IF EXISTS news_articles CASCADE;
-- DROP TABLE IF EXISTS sponsors CASCADE;
-- DROP TABLE IF EXISTS event_attendees CASCADE;
-- DROP TABLE IF EXISTS events CASCADE;
-- DROP TABLE IF EXISTS match_events CASCADE;
-- DROP TABLE IF EXISTS matches CASCADE;
-- DROP TABLE IF EXISTS player_stats CASCADE;
-- DROP TABLE IF EXISTS club_members CASCADE;
-- DROP TABLE IF EXISTS clubs CASCADE;

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
-- 15. CLUBSCORE RULES (Per-Club Point Weights & Multipliers)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clubscore_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    points_training_checkin INTEGER NOT NULL DEFAULT 10,
    points_social_checkin INTEGER NOT NULL DEFAULT 5,
    points_match_appearance INTEGER NOT NULL DEFAULT 5,
    points_goal_forward INTEGER NOT NULL DEFAULT 10,
    points_goal_midfielder INTEGER NOT NULL DEFAULT 12,
    points_goal_defender INTEGER NOT NULL DEFAULT 15,
    points_assist INTEGER NOT NULL DEFAULT 7,
    points_clean_sheet_gk_def INTEGER NOT NULL DEFAULT 10,
    points_motm INTEGER NOT NULL DEFAULT 15,
    points_yellow_card_penalty INTEGER NOT NULL DEFAULT -3,
    points_red_card_penalty INTEGER NOT NULL DEFAULT -10,
    streak_multiplier_3w NUMERIC(3,2) NOT NULL DEFAULT 1.15,
    streak_multiplier_5w NUMERIC(3,2) NOT NULL DEFAULT 1.25,
    streak_multiplier_10w NUMERIC(3,2) NOT NULL DEFAULT 1.50,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(club_id)
);

CREATE INDEX IF NOT EXISTS idx_clubscore_rules_club ON clubscore_rules(club_id);

-- ------------------------------------------------------------------------------
-- 16. MEMBER CLUBSCORE PROFILES (Season Totals, Streaks & Tiers)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS member_clubscore_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES club_members(id) ON DELETE CASCADE,
    season VARCHAR(32) NOT NULL DEFAULT '2025/2026',
    total_points INTEGER NOT NULL DEFAULT 0,
    weekly_points INTEGER NOT NULL DEFAULT 0,
    monthly_points INTEGER NOT NULL DEFAULT 0,
    current_streak INTEGER NOT NULL DEFAULT 0,
    highest_streak INTEGER NOT NULL DEFAULT 0,
    tier VARCHAR(32) NOT NULL DEFAULT 'Rookie' CHECK (tier IN ('Rookie', 'Prospect', 'First Team', 'All-Star', 'Club Legend')),
    badges JSONB NOT NULL DEFAULT '[]'::jsonb,
    last_activity_date DATE,
    streak_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(member_id, season)
);

CREATE INDEX IF NOT EXISTS idx_clubscore_profiles_club_season ON member_clubscore_profiles(club_id, season);
CREATE INDEX IF NOT EXISTS idx_clubscore_profiles_total_pts ON member_clubscore_profiles(total_points DESC);
CREATE INDEX IF NOT EXISTS idx_clubscore_profiles_weekly_pts ON member_clubscore_profiles(weekly_points DESC);
CREATE INDEX IF NOT EXISTS idx_clubscore_profiles_streak ON member_clubscore_profiles(current_streak DESC);

-- ------------------------------------------------------------------------------
-- 17. GAMIFICATION ACTIVITY LOG (Immutable Point Ledger)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gamification_activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES club_members(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL CHECK (
        event_type IN (
            'training_checkin',
            'social_checkin',
            'match_appearance',
            'match_goal',
            'match_assist',
            'match_clean_sheet',
            'match_motm',
            'disciplinary_card',
            'streak_bonus',
            'admin_award'
        )
    ),
    points_awarded INTEGER NOT NULL,
    multiplier NUMERIC(3,2) NOT NULL DEFAULT 1.00,
    final_points INTEGER NOT NULL,
    description TEXT NOT NULL,
    reference_id UUID,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_member ON gamification_activity_log(member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_club ON gamification_activity_log(club_id, created_at DESC);

-- ==============================================================================
-- 18. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
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
ALTER TABLE clubscore_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_clubscore_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE gamification_activity_log ENABLE ROW LEVEL SECURITY;

-- Public READ policies for active clubs & content
DROP POLICY IF EXISTS "Public clubs read" ON clubs;
CREATE POLICY "Public clubs read" ON clubs FOR SELECT USING (is_active = TRUE);

-- Member personal details (email, phone, QR pass token) are NOT public read.
-- The "Members read own or admin" policy (needs is_club_admin(), defined further
-- below) replaces this once that function exists.
DROP POLICY IF EXISTS "Public members read" ON club_members;

DROP POLICY IF EXISTS "Public player_stats read" ON player_stats;
CREATE POLICY "Public player_stats read" ON player_stats FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Public matches read" ON matches;
CREATE POLICY "Public matches read" ON matches FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Public match_events read" ON match_events;
CREATE POLICY "Public match_events read" ON match_events FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Public events read" ON events;
CREATE POLICY "Public events read" ON events FOR SELECT USING (is_public = TRUE);

-- Sponsorship deal details (contact info, package value/status) are admin-only;
-- the public site instead reads sponsors_public (defined further below), which
-- excludes those columns entirely.
DROP POLICY IF EXISTS "Public sponsors read" ON sponsors;

DROP POLICY IF EXISTS "Public news read" ON news_articles;
CREATE POLICY "Public news read" ON news_articles FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Public media read" ON media_gallery;
CREATE POLICY "Public media read" ON media_gallery FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Public clubscore_rules read" ON clubscore_rules;
CREATE POLICY "Public clubscore_rules read" ON clubscore_rules FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Public member_clubscore_profiles read" ON member_clubscore_profiles;
CREATE POLICY "Public member_clubscore_profiles read" ON member_clubscore_profiles FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Public gamification_activity_log read" ON gamification_activity_log;
CREATE POLICY "Public gamification_activity_log read" ON gamification_activity_log FOR SELECT USING (TRUE);

-- Allow public contact submission & analytics logging
DROP POLICY IF EXISTS "Public contact submit" ON contact_inquiries;
CREATE POLICY "Public contact submit" ON contact_inquiries FOR INSERT WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Public analytics log" ON club_analytics;
CREATE POLICY "Public analytics log" ON club_analytics FOR INSERT WITH CHECK (TRUE);

-- Both public INSERT policies above have no volume limit of their own, so a durable,
-- deployment-topology-independent cooldown is enforced here in Postgres (the app's
-- /api/contact route and client-side sessionStorage throttle are the first line of
-- defense, but this holds even against a direct REST call bypassing the app).
CREATE OR REPLACE FUNCTION enforce_contact_inquiry_cooldown()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM contact_inquiries
        WHERE club_id = NEW.club_id
          AND sender_email = NEW.sender_email
          AND created_at > NOW() - INTERVAL '2 minutes'
    ) THEN
        RAISE EXCEPTION 'rate limit: a message from this email was already submitted to this club in the last 2 minutes';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_contact_inquiry_cooldown ON contact_inquiries;
CREATE TRIGGER trg_contact_inquiry_cooldown
    BEFORE INSERT ON contact_inquiries
    FOR EACH ROW
    EXECUTE FUNCTION enforce_contact_inquiry_cooldown();

CREATE OR REPLACE FUNCTION enforce_club_analytics_rate_limit()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.event_type = 'page_view' AND (
        SELECT COUNT(*) FROM club_analytics
        WHERE club_id = NEW.club_id
          AND visitor_hash = NEW.visitor_hash
          AND event_type = 'page_view'
          AND created_at > NOW() - INTERVAL '1 minute'
    ) >= 20 THEN
        RAISE EXCEPTION 'rate limit: too many page view events from this visitor';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_club_analytics_rate_limit ON club_analytics;
CREATE TRIGGER trg_club_analytics_rate_limit
    BEFORE INSERT ON club_analytics
    FOR EACH ROW
    EXECUTE FUNCTION enforce_club_analytics_rate_limit();

-- Helper security function to prevent recursive RLS evaluations
-- Drop all previous overloads to prevent 'function is_club_admin(uuid) is not unique' error (42725)
DROP FUNCTION IF EXISTS is_club_admin(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS is_club_admin(UUID) CASCADE;

-- Who counts as a club admin: the club's owner, or a member with an owner/admin role.
-- Signed-out visitors are NEVER admins (auth.uid() IS NOT NULL is required first).
CREATE OR REPLACE FUNCTION is_club_admin(p_club_id UUID)
RETURNS BOOLEAN AS $$
    SELECT auth.uid() IS NOT NULL AND (
        EXISTS (SELECT 1 FROM clubs c WHERE c.id = p_club_id AND c.owner_id = auth.uid())
        OR EXISTS (
            SELECT 1 FROM club_members m
            WHERE m.club_id = p_club_id
              AND m.user_id = auth.uid()
              AND m.role IN ('owner', 'admin')
        )
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Authenticated Admin / Club Owner policies (checked against is_club_admin).
-- WITH CHECK also allows owner_id = auth.uid() so a brand-new club (not yet
-- linked via club_members) can still be inserted by the user creating it.
DROP POLICY IF EXISTS "Club admin clubs edit" ON clubs;
CREATE POLICY "Club admin clubs edit" ON clubs FOR ALL USING (
    is_club_admin(id)
) WITH CHECK (
    is_club_admin(id) OR owner_id = auth.uid()
);

-- A member may read their own row; club admins may read every member of their club.
-- The public site instead reads the club_members_public view (below).
DROP POLICY IF EXISTS "Members read own or admin" ON club_members;
CREATE POLICY "Members read own or admin" ON club_members FOR SELECT
    USING (is_club_admin(club_id) OR user_id = auth.uid());

DROP POLICY IF EXISTS "Club admin members manage" ON club_members;
CREATE POLICY "Club admin members manage" ON club_members FOR ALL USING (
    is_club_admin(club_id)
) WITH CHECK (
    is_club_admin(club_id)
);

-- Anyone may submit a membership application (it stays 'pending' until an admin approves it)
DROP POLICY IF EXISTS "Public membership applications" ON club_members;
CREATE POLICY "Public membership applications" ON club_members FOR INSERT
    WITH CHECK (
        membership_status = 'pending'
        AND user_id IS NULL
        AND COALESCE(is_executive, FALSE) = FALSE
        AND role NOT IN ('owner', 'admin', 'staff')
    );

-- What the public site may show: approved members, without contact details or pass tokens
CREATE OR REPLACE VIEW club_members_public AS
    SELECT
        id, club_id, full_name, first_name, last_name, role, roles, player_position,
        secondary_positions, jersey_number, photo_url, nationality, preferred_foot, status,
        membership_tier, is_executive, executive_title, executive_bio, executive_order,
        executive_season, membership_status, created_at
    FROM club_members
    WHERE COALESCE(membership_status, 'approved') = 'approved';

GRANT SELECT ON club_members_public TO anon, authenticated;

DROP POLICY IF EXISTS "Club admin matches manage" ON matches;
CREATE POLICY "Club admin matches manage" ON matches FOR ALL USING (
    is_club_admin(club_id)
) WITH CHECK (
    is_club_admin(club_id)
);

DROP POLICY IF EXISTS "Club admin match events manage" ON match_events;
CREATE POLICY "Club admin match events manage" ON match_events FOR ALL USING (
    is_club_admin(club_id)
) WITH CHECK (
    is_club_admin(club_id)
);

DROP POLICY IF EXISTS "Club admin events manage" ON events;
CREATE POLICY "Club admin events manage" ON events FOR ALL USING (
    is_club_admin(club_id)
) WITH CHECK (
    is_club_admin(club_id)
);

DROP POLICY IF EXISTS "Club admin sponsors manage" ON sponsors;
CREATE POLICY "Club admin sponsors manage" ON sponsors FOR ALL USING (
    is_club_admin(club_id)
) WITH CHECK (
    is_club_admin(club_id)
);

-- What the public site may show: active sponsors, without contact/package deal details.
CREATE OR REPLACE VIEW sponsors_public AS
    SELECT
        id, club_id, event_id, name, logo_url, website_url, tier, size_scale,
        display_order, is_active, season
    FROM sponsors
    WHERE is_active = TRUE;

GRANT SELECT ON sponsors_public TO anon, authenticated;

DROP POLICY IF EXISTS "Club admin news manage" ON news_articles;
CREATE POLICY "Club admin news manage" ON news_articles FOR ALL USING (
    is_club_admin(club_id)
) WITH CHECK (
    is_club_admin(club_id)
);

DROP POLICY IF EXISTS "Club admin inquiries read" ON contact_inquiries;
CREATE POLICY "Club admin inquiries read" ON contact_inquiries FOR ALL USING (
    is_club_admin(club_id)
) WITH CHECK (
    is_club_admin(club_id)
);

DROP POLICY IF EXISTS "Club admin clubscore_rules manage" ON clubscore_rules;
CREATE POLICY "Club admin clubscore_rules manage" ON clubscore_rules FOR ALL USING (
    is_club_admin(club_id)
) WITH CHECK (
    is_club_admin(club_id)
);

DROP POLICY IF EXISTS "Club admin member_clubscore_profiles manage" ON member_clubscore_profiles;
CREATE POLICY "Club admin member_clubscore_profiles manage" ON member_clubscore_profiles FOR ALL USING (
    is_club_admin(club_id)
) WITH CHECK (
    is_club_admin(club_id)
);

DROP POLICY IF EXISTS "Club admin gamification_activity_log insert" ON gamification_activity_log;
CREATE POLICY "Club admin gamification_activity_log insert" ON gamification_activity_log FOR INSERT WITH CHECK (
    is_club_admin(club_id)
);

-- ==============================================================================
-- 19. AUTOMATED POINT & STREAK FUNCTIONS
-- ==============================================================================
CREATE OR REPLACE FUNCTION fn_get_clubscore_tier(points INTEGER)
RETURNS VARCHAR(32) AS $$
BEGIN
    IF points >= 500 THEN
        RETURN 'Club Legend';
    ELSIF points >= 300 THEN
        RETURN 'All-Star';
    ELSIF points >= 150 THEN
        RETURN 'First Team';
    ELSIF points >= 50 THEN
        RETURN 'Prospect';
    ELSE
        RETURN 'Rookie';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION fn_award_clubscore(
    p_club_id UUID,
    p_member_id UUID,
    p_event_type VARCHAR(64),
    p_points INTEGER,
    p_description TEXT,
    p_reference_id UUID DEFAULT NULL,
    p_season VARCHAR(32) DEFAULT '2025/2026'
)
RETURNS VOID AS $$
DECLARE
    v_multiplier NUMERIC(3,2) := 1.00;
    v_final_points INTEGER;
    v_current_streak INTEGER := 0;
    v_last_activity DATE;
BEGIN
    INSERT INTO member_clubscore_profiles (club_id, member_id, season)
    VALUES (p_club_id, p_member_id, p_season)
    ON CONFLICT (member_id, season) DO NOTHING;

    SELECT current_streak, last_activity_date
    INTO v_current_streak, v_last_activity
    FROM member_clubscore_profiles
    WHERE member_id = p_member_id AND season = p_season;

    IF v_current_streak >= 10 THEN
        v_multiplier := 1.50;
    ELSIF v_current_streak >= 5 THEN
        v_multiplier := 1.25;
    ELSIF v_current_streak >= 3 THEN
        v_multiplier := 1.15;
    END IF;

    IF p_points > 0 THEN
        v_final_points := ROUND(p_points * v_multiplier);
    ELSE
        v_final_points := p_points;
    END IF;

    IF p_event_type IN ('training_checkin', 'social_checkin', 'match_appearance') THEN
        IF v_last_activity IS NULL OR v_last_activity < (CURRENT_DATE - INTERVAL '6 days') THEN
            v_current_streak := v_current_streak + 1;
        END IF;
    END IF;

    INSERT INTO gamification_activity_log (
        club_id,
        member_id,
        event_type,
        points_awarded,
        multiplier,
        final_points,
        description,
        reference_id
    ) VALUES (
        p_club_id,
        p_member_id,
        p_event_type,
        p_points,
        v_multiplier,
        v_final_points,
        p_description,
        p_reference_id
    );

    UPDATE member_clubscore_profiles
    SET total_points = total_points + v_final_points,
        weekly_points = weekly_points + v_final_points,
        monthly_points = monthly_points + v_final_points,
        current_streak = v_current_streak,
        highest_streak = GREATEST(highest_streak, v_current_streak),
        tier = fn_get_clubscore_tier(total_points + v_final_points),
        last_activity_date = CURRENT_DATE,
        updated_at = NOW()
    WHERE member_id = p_member_id AND season = p_season;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION trg_fn_on_event_checkin()
RETURNS TRIGGER AS $$
DECLARE
    v_event_category VARCHAR(32);
    v_points INTEGER := 10;
BEGIN
    IF (OLD.checkin_status IS DISTINCT FROM NEW.checkin_status AND NEW.checkin_status = 'checked_in') THEN
        IF NEW.member_id IS NOT NULL THEN
            SELECT category INTO v_event_category FROM events WHERE id = NEW.event_id;
            
            IF v_event_category = 'social' THEN
                v_points := 5;
            ELSE
                v_points := 10;
            END IF;

            PERFORM fn_award_clubscore(
                NEW.club_id,
                NEW.member_id,
                CASE WHEN v_event_category = 'social' THEN 'social_checkin' ELSE 'training_checkin' END,
                v_points,
                'Verified QR Check-In: ' || COALESCE(v_event_category, 'Event'),
                NEW.event_id
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_event_attendee_clubscore ON event_attendees;
CREATE TRIGGER trg_event_attendee_clubscore
    AFTER UPDATE ON event_attendees
    FOR EACH ROW
    EXECUTE FUNCTION trg_fn_on_event_checkin();

-- ==============================================================================
-- 20. PLAYER AVAILABILITY & RSVP HUB (Pre-Match Call-Ups)
-- ==============================================================================
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

ALTER TABLE player_availabilities ENABLE ROW LEVEL SECURITY;

-- No direct public read/write policy: an unauthenticated player answers their
-- availability request through their personal link, which calls these
-- SECURITY DEFINER functions instead of touching the table directly. This avoids
-- ever exposing the whole table (with everyone's response_token) to anonymous reads,
-- and stops an anonymous caller from updating an arbitrary row via a guessed id.
DROP POLICY IF EXISTS "Public availability read" ON player_availabilities;
DROP POLICY IF EXISTS "Public availability respond by token" ON player_availabilities;

CREATE OR REPLACE FUNCTION get_availability_by_token(p_token TEXT)
RETURNS SETOF player_availabilities AS $$
    SELECT * FROM player_availabilities WHERE response_token = p_token LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION respond_availability(p_token TEXT, p_status TEXT, p_note TEXT DEFAULT NULL)
RETURNS SETOF player_availabilities AS $$
    UPDATE player_availabilities
       SET status = p_status,
           note = LEFT(p_note, 500),
           responded_at = NOW(),
           updated_at = NOW()
     WHERE response_token = p_token
       AND p_status IN ('available', 'unavailable', 'maybe')
    RETURNING *;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION get_availability_by_token(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION respond_availability(TEXT, TEXT, TEXT) TO anon, authenticated;

DROP POLICY IF EXISTS "Club admin availabilities manage" ON player_availabilities;
CREATE POLICY "Club admin availabilities manage" ON player_availabilities FOR ALL USING (
    auth.uid() IN (
        SELECT user_id FROM club_members
        WHERE club_id = player_availabilities.club_id
        AND role IN ('owner', 'admin')
    )
);

-- ==============================================================================
-- 21. DRAFT LINEUPS & MATCH EXTENSIONS
-- ==============================================================================
ALTER TABLE matches ADD COLUMN IF NOT EXISTS is_audited BOOLEAN DEFAULT FALSE;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS audited_at TIMESTAMPTZ;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS audited_by UUID;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS match_format VARCHAR(16) DEFAULT '11v11';

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

ALTER TABLE draft_lineups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public published draft read" ON draft_lineups;
CREATE POLICY "Public published draft read" ON draft_lineups FOR SELECT USING (is_published = TRUE);

DROP POLICY IF EXISTS "Club admin draft lineups manage" ON draft_lineups;
CREATE POLICY "Club admin draft lineups manage" ON draft_lineups FOR ALL USING (
    auth.uid() IN (
        SELECT user_id FROM club_members
        WHERE club_id = draft_lineups.club_id
        AND role IN ('owner', 'admin')
    )
);

CREATE OR REPLACE FUNCTION fn_publish_draft_lineup(p_match_id UUID)
RETURNS VOID AS $$
DECLARE
    v_draft RECORD;
BEGIN
    SELECT * INTO v_draft FROM draft_lineups WHERE match_id = p_match_id;

    IF v_draft.id IS NULL THEN
        RAISE EXCEPTION 'No draft lineup found for match %', p_match_id;
    END IF;

    UPDATE matches
    SET home_formation = v_draft.formation,
        home_lineup_coords = v_draft.lineup_coords,
        match_format = v_draft.format
    WHERE id = p_match_id;

    UPDATE draft_lineups
    SET is_published = TRUE,
        published_at = NOW(),
        updated_at = NOW()
    WHERE match_id = p_match_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 22. SUPABASE REALTIME REPLICATION CONFIGURATION
-- ==============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'matches'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE matches;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'match_events'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE match_events;
    END IF;
END $$;

-- ==============================================================================
-- 23. TOURNAMENTS & INTERNAL TEAMS (Challonge Parity for Football)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS internal_teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    short_name VARCHAR(16) NOT NULL,
    color VARCHAR(32) DEFAULT '#10B981',
    logo_url TEXT,
    cover_url TEXT,
    captain_id UUID REFERENCES club_members(id) ON DELETE SET NULL,
    coach_name VARCHAR(128),
    player_ids JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_internal_teams_club ON internal_teams (club_id);

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

ALTER TABLE matches
    ADD COLUMN IF NOT EXISTS tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS tournament_stage VARCHAR(32) CHECK (tournament_stage IN ('group', 'round_of_32', 'round_of_16', 'quarter_final', 'semi_final', 'final', 'third_place')),
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

-- RLS
ALTER TABLE internal_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public internal_teams read" ON internal_teams;
CREATE POLICY "Public internal_teams read" ON internal_teams FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Club admin internal_teams manage" ON internal_teams;
CREATE POLICY "Club admin internal_teams manage" ON internal_teams FOR ALL USING (
    is_club_admin(club_id)
) WITH CHECK (
    is_club_admin(club_id)
);

DROP POLICY IF EXISTS "Public tournaments read" ON tournaments;
CREATE POLICY "Public tournaments read" ON tournaments FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Club admin tournaments manage" ON tournaments;
CREATE POLICY "Club admin tournaments manage" ON tournaments FOR ALL USING (
    is_club_admin(club_id)
) WITH CHECK (
    is_club_admin(club_id)
);

DROP POLICY IF EXISTS "Public tournament_participants read" ON tournament_participants;
CREATE POLICY "Public tournament_participants read" ON tournament_participants FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Club admin tournament_participants manage" ON tournament_participants;
CREATE POLICY "Club admin tournament_participants manage" ON tournament_participants FOR ALL USING (
    is_club_admin((SELECT club_id FROM tournaments WHERE id = tournament_participants.tournament_id))
) WITH CHECK (
    is_club_admin((SELECT club_id FROM tournaments WHERE id = tournament_participants.tournament_id))
);


