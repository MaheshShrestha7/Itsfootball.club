-- ==============================================================================
-- itsfootball.club: Player Gamification & Retention Engine ("ClubScore")
-- Migration: 20260919_clubscore_gamification.sql
-- Compatible with Supabase PostgreSQL (Postgres 15+)
--
-- NOTE FOR FRESH SUPABASE PROJECTS:
-- If setting up a new Supabase database, run `supabase/schema.sql` first!
-- That script creates the base tables (`clubs`, `club_members`, `events`, etc.)
-- which are referenced by this migration.
-- Alternatively, `supabase/schema.sql` now already includes all Gamification tables!
-- ==============================================================================

-- 1. Ensure UUID extension is active
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 2. CLUBSCORE RULES (Per-Club Point Weights & Multipliers)
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
-- 3. MEMBER CLUBSCORE PROFILES (Season Totals, Streaks & Tiers)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS member_clubscore_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES club_members(id) ON DELETE CASCADE,
    season VARCHAR(32) NOT NULL DEFAULT '2025/2026',
    total_points INTEGER NOT NULL DEFAULT 0,
    weekly_points INTEGER NOT NULL DEFAULT 0,
    monthly_points INTEGER NOT NULL DEFAULT 0,
    current_streak INTEGER NOT NULL DEFAULT 0, -- Consecutive weeks with at least 1 verified activity
    highest_streak INTEGER NOT NULL DEFAULT 0,
    tier VARCHAR(32) NOT NULL DEFAULT 'Rookie' CHECK (tier IN ('Rookie', 'Prospect', 'First Team', 'All-Star', 'Club Legend')),
    badges JSONB NOT NULL DEFAULT '[]'::jsonb,
    last_activity_date DATE,
    streak_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(member_id, season)
);

-- Fast lookup indexes for leaderboards and member queries
CREATE INDEX IF NOT EXISTS idx_clubscore_profiles_club_season ON member_clubscore_profiles(club_id, season);
CREATE INDEX IF NOT EXISTS idx_clubscore_profiles_total_pts ON member_clubscore_profiles(total_points DESC);
CREATE INDEX IF NOT EXISTS idx_clubscore_profiles_weekly_pts ON member_clubscore_profiles(weekly_points DESC);
CREATE INDEX IF NOT EXISTS idx_clubscore_profiles_streak ON member_clubscore_profiles(current_streak DESC);

-- ------------------------------------------------------------------------------
-- 4. GAMIFICATION ACTIVITY LOG (Immutable Point Ledger)
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
    reference_id UUID, -- Optional foreign key to events(id) or matches(id)
    created_by UUID, -- Optional user_id of coach/admin who granted points
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_member ON gamification_activity_log(member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_club ON gamification_activity_log(club_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_event_type ON gamification_activity_log(event_type);

-- ------------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE clubscore_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_clubscore_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE gamification_activity_log ENABLE ROW LEVEL SECURITY;

-- Public READ for active clubs
DROP POLICY IF EXISTS "Public clubscore_rules read" ON clubscore_rules;
CREATE POLICY "Public clubscore_rules read" ON clubscore_rules
    FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Public member_clubscore_profiles read" ON member_clubscore_profiles;
CREATE POLICY "Public member_clubscore_profiles read" ON member_clubscore_profiles
    FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Public gamification_activity_log read" ON gamification_activity_log;
CREATE POLICY "Public gamification_activity_log read" ON gamification_activity_log
    FOR SELECT USING (TRUE);

-- STRICT WRITE PERMISSIONS:
-- Only authenticated club owners & admins can edit rules or grant manual points.
-- Regular players CANNOT forge or update their point totals directly.
DROP POLICY IF EXISTS "Club admin clubscore_rules manage" ON clubscore_rules;
CREATE POLICY "Club admin clubscore_rules manage" ON clubscore_rules
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM club_members
            WHERE club_id = clubscore_rules.club_id
            AND role IN ('owner', 'admin')
        )
    );

DROP POLICY IF EXISTS "Club admin member_clubscore_profiles manage" ON member_clubscore_profiles;
CREATE POLICY "Club admin member_clubscore_profiles manage" ON member_clubscore_profiles
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM club_members
            WHERE club_id = member_clubscore_profiles.club_id
            AND role IN ('owner', 'admin')
        )
    );

DROP POLICY IF EXISTS "Club admin gamification_activity_log insert" ON gamification_activity_log;
CREATE POLICY "Club admin gamification_activity_log insert" ON gamification_activity_log
    FOR INSERT WITH CHECK (
        auth.uid() IN (
            SELECT user_id FROM club_members
            WHERE club_id = gamification_activity_log.club_id
            AND role IN ('owner', 'admin')
        )
    );

-- ------------------------------------------------------------------------------
-- 6. AUTOMATED POINT & STREAK CALCULATION FUNCTIONS (SECURITY DEFINER)
-- ------------------------------------------------------------------------------

-- Function to determine tier based on total points
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

-- Function: Award Points to Member & Update Profile + Ledger
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
    v_new_tier VARCHAR(32);
BEGIN
    -- Ensure profile exists
    INSERT INTO member_clubscore_profiles (club_id, member_id, season)
    VALUES (p_club_id, p_member_id, p_season)
    ON CONFLICT (member_id, season) DO NOTHING;

    -- Fetch current streak & last activity
    SELECT current_streak, last_activity_date
    INTO v_current_streak, v_last_activity
    FROM member_clubscore_profiles
    WHERE member_id = p_member_id AND season = p_season;

    -- Calculate streak multiplier
    IF v_current_streak >= 10 THEN
        v_multiplier := 1.50;
    ELSIF v_current_streak >= 5 THEN
        v_multiplier := 1.25;
    ELSIF v_current_streak >= 3 THEN
        v_multiplier := 1.15;
    END IF;

    -- Only apply multiplier to positive points
    IF p_points > 0 THEN
        v_final_points := ROUND(p_points * v_multiplier);
    ELSE
        v_final_points := p_points;
    END IF;

    -- Update streak if event is attendance/training and hasn't occurred this week
    IF p_event_type IN ('training_checkin', 'social_checkin', 'match_appearance') THEN
        IF v_last_activity IS NULL OR v_last_activity < (CURRENT_DATE - INTERVAL '6 days') THEN
            v_current_streak := v_current_streak + 1;
        END IF;
    END IF;

    -- Insert into immutable activity log
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

    -- Recalculate profile points and tier
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

-- ------------------------------------------------------------------------------
-- 7. TRIGGER: Auto-Award Points on Event QR Check-In
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_fn_on_event_checkin()
RETURNS TRIGGER AS $$
DECLARE
    v_event_category VARCHAR(32);
    v_points INTEGER := 10;
BEGIN
    -- Only trigger when checkin_status transitions to 'checked_in'
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
