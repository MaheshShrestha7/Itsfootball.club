-- ==============================================================================
-- Migration: align the live database with the app so Supabase can be the source of truth
-- Date: 2026-09-22
--
-- Safe to run more than once. Run it in the Supabase SQL editor.
--
--   1. clubs           : add the columns the app reads/writes (backfilled from the old `config` JSON)
--   2. club_members    : add missing columns, relax role/status checks, copy rows over from the
--                        legacy `members` table
--   3. matches/sponsors: add missing columns
--   4. member_messages : new table
--   5. Security        : is_club_admin() no longer treats signed-out visitors as admins, club owners
--                        are recognised via clubs.owner_id, missing admin write policies are added,
--                        and member personal details are no longer world-readable
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CLUBS
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    needs_backfill BOOLEAN;
BEGIN
    needs_backfill := NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'clubs' AND column_name = 'primary_color'
    );

    ALTER TABLE clubs ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}'::jsonb;
    ALTER TABLE clubs ADD COLUMN IF NOT EXISTS founded_year INTEGER DEFAULT 2024;
    ALTER TABLE clubs ADD COLUMN IF NOT EXISTS banner_url TEXT;
    ALTER TABLE clubs ADD COLUMN IF NOT EXISTS slider_images JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE clubs ADD COLUMN IF NOT EXISTS hero_pinned_items JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE clubs ADD COLUMN IF NOT EXISTS primary_color VARCHAR(16) DEFAULT '#10B981';
    ALTER TABLE clubs ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(16) DEFAULT '#0F172A';
    ALTER TABLE clubs ADD COLUMN IF NOT EXISTS accent_color VARCHAR(16) DEFAULT '#F59E0B';
    ALTER TABLE clubs ADD COLUMN IF NOT EXISTS stadium_name VARCHAR(255);
    ALTER TABLE clubs ADD COLUMN IF NOT EXISTS stadium_address TEXT;
    ALTER TABLE clubs ADD COLUMN IF NOT EXISTS stadium_lat DOUBLE PRECISION;
    ALTER TABLE clubs ADD COLUMN IF NOT EXISTS stadium_lng DOUBLE PRECISION;
    ALTER TABLE clubs ADD COLUMN IF NOT EXISTS stadium_capacity INTEGER DEFAULT 0;
    ALTER TABLE clubs ADD COLUMN IF NOT EXISTS stadium_pitch_type VARCHAR(64);
    ALTER TABLE clubs ADD COLUMN IF NOT EXISTS stadium_parking_info TEXT;
    ALTER TABLE clubs ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);
    ALTER TABLE clubs ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(64);
    ALTER TABLE clubs ADD COLUMN IF NOT EXISTS previous_slugs JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE clubs ADD COLUMN IF NOT EXISTS current_season_id UUID;
    ALTER TABLE clubs ADD COLUMN IF NOT EXISTS owner_id UUID;

    -- Only on the first run: copy theme / contact details out of the older `config` JSON
    IF needs_backfill THEN
        UPDATE clubs SET
            primary_color   = COALESCE(NULLIF(config->'theme'->>'primaryColor', ''), primary_color),
            secondary_color = COALESCE(NULLIF(config->'theme'->>'secondaryColor', ''), secondary_color),
            accent_color    = COALESCE(NULLIF(config->'theme'->>'accentColor', ''), accent_color),
            contact_email   = COALESCE(NULLIF(config->'contact'->>'email', ''), contact_email),
            contact_phone   = COALESCE(NULLIF(config->'contact'->>'phone', ''), contact_phone),
            stadium_address = COALESCE(NULLIF(config->'contact'->>'address', ''), stadium_address),
            motto           = COALESCE(NULLIF(motto, ''), NULLIF(config->'identity'->>'motto', '')),
            founded_year    = COALESCE(EXTRACT(YEAR FROM created_at)::INTEGER, founded_year);
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. CLUB MEMBERS
--    (password_hash / magic tokens are deliberately NOT added: they must never live in a table
--     that the browser can read. Member sign-in needs a server-side flow.)
-- ------------------------------------------------------------------------------
ALTER TABLE club_members ADD COLUMN IF NOT EXISTS first_name VARCHAR(128);
ALTER TABLE club_members ADD COLUMN IF NOT EXISTS last_name VARCHAR(128);
ALTER TABLE club_members ADD COLUMN IF NOT EXISTS roles JSONB DEFAULT '[]'::jsonb;
ALTER TABLE club_members ADD COLUMN IF NOT EXISTS secondary_positions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE club_members ADD COLUMN IF NOT EXISTS membership_status VARCHAR(16) DEFAULT 'approved';
ALTER TABLE club_members ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ;
ALTER TABLE club_members ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE club_members ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(255);
ALTER TABLE club_members ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE club_members ADD COLUMN IF NOT EXISTS application_notes TEXT;
ALTER TABLE club_members ADD COLUMN IF NOT EXISTS emergency_contact TEXT;
ALTER TABLE club_members ADD COLUMN IF NOT EXISTS executive_season VARCHAR(64);

-- The app uses more role / status values than the original CHECKs allow
DO $$
DECLARE
    c RECORD;
BEGIN
    FOR c IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'public.club_members'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ~ '\((role|status)\)'
    LOOP
        EXECUTE format('ALTER TABLE club_members DROP CONSTRAINT %I', c.conname);
    END LOOP;
END $$;

-- Copy the members created by the older version of the site (table `members`) into club_members
DO $$
BEGIN
    IF to_regclass('public.members') IS NOT NULL THEN
        INSERT INTO club_members (
            id, club_id, user_id, first_name, last_name, full_name, email, phone, role,
            player_position, jersey_number, photo_url, preferred_foot, membership_status,
            membership_tier, is_executive, status, created_at, updated_at
        )
        SELECT
            uuid_generate_v4(),
            m.club_id,
            m.auth_user_id,
            m.first_name,
            m.last_name,
            COALESCE(NULLIF(trim(concat_ws(' ', m.first_name, m.last_name)), ''), 'Member'),
            m.email,
            m.phone,
            CASE
                WHEN m.auth_user_id IS NOT NULL AND m.auth_user_id = cl.owner_id THEN 'owner'
                WHEN lower(coalesce(m.role, '')) = 'admin' THEN 'admin'
                WHEN lower(coalesce(m.role, '')) = 'player' THEN 'player'
                WHEN lower(coalesce(m.role, '')) IN ('manager', 'coach', 'staff') THEN 'staff'
                ELSE 'member'
            END,
            CASE lower(coalesce(m."position", ''))
                WHEN 'goalkeeper' THEN 'GK'
                WHEN 'defender' THEN 'CB'
                WHEN 'midfielder' THEN 'CM'
                WHEN 'forward' THEN 'ST'
                WHEN 'striker' THEN 'ST'
                ELSE NULL
            END,
            m.jersey_number,
            m.photo_url,
            COALESCE(m.preferred_foot, 'Right'),
            COALESCE(m.membership_status, 'approved'),
            m.membership_type,
            lower(coalesce(m.role, '')) IN ('admin', 'owner'),
            CASE WHEN m.is_active IS FALSE THEN 'alumni' ELSE 'active' END,
            COALESCE(m.created_at, NOW()),
            COALESCE(m.updated_at, NOW())
        FROM members m
        JOIN clubs cl ON cl.id = m.club_id
        WHERE NOT EXISTS (
            SELECT 1 FROM club_members c
            WHERE c.club_id = m.club_id AND lower(c.email) = lower(m.email)
        );
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 3. MATCHES & SPONSORS
-- ------------------------------------------------------------------------------
ALTER TABLE matches ADD COLUMN IF NOT EXISTS home_lineup_coords JSONB;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS away_lineup_coords JSONB;
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS size_scale VARCHAR(16) DEFAULT 'auto';

-- ------------------------------------------------------------------------------
-- 4. MEMBER MESSAGES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS member_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES club_members(id) ON DELETE CASCADE,
    sender_type VARCHAR(16) NOT NULL CHECK (sender_type IN ('member', 'admin')),
    sender_name VARCHAR(255),
    sender_email VARCHAR(255),
    subject VARCHAR(255),
    category VARCHAR(32),
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_member_messages_club ON member_messages (club_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_member_messages_member ON member_messages (member_id);

-- ------------------------------------------------------------------------------
-- 5. SECURITY
-- ------------------------------------------------------------------------------

-- 5a. Who counts as a club admin: the club's owner, or a member with an owner/admin role.
--     Signed-out visitors are NOT admins (the previous version returned TRUE for them).
--     Same signature as before, so the existing policies keep pointing at it.
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

-- 5b. Clubs: an owner may create a club for themselves
DROP POLICY IF EXISTS "Club admin clubs edit" ON clubs;
CREATE POLICY "Club admin clubs edit" ON clubs FOR ALL
    USING (is_club_admin(id))
    WITH CHECK (is_club_admin(id) OR owner_id = auth.uid());

-- 5c. Members: personal details are no longer public
DROP POLICY IF EXISTS "Public members read" ON club_members;
DROP POLICY IF EXISTS "Members read own or admin" ON club_members;
CREATE POLICY "Members read own or admin" ON club_members FOR SELECT
    USING (is_club_admin(club_id) OR user_id = auth.uid());

DROP POLICY IF EXISTS "Club admin members manage" ON club_members;
CREATE POLICY "Club admin members manage" ON club_members FOR ALL
    USING (is_club_admin(club_id))
    WITH CHECK (is_club_admin(club_id));

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

-- 5d. Admin write access for tables that only had public-read policies
DROP POLICY IF EXISTS "Club admin player_stats manage" ON player_stats;
CREATE POLICY "Club admin player_stats manage" ON player_stats FOR ALL
    USING (is_club_admin(club_id)) WITH CHECK (is_club_admin(club_id));

DROP POLICY IF EXISTS "Club admin media manage" ON media_gallery;
CREATE POLICY "Club admin media manage" ON media_gallery FOR ALL
    USING (is_club_admin(club_id)) WITH CHECK (is_club_admin(club_id));

DROP POLICY IF EXISTS "Club admin gamification_activity_log insert" ON gamification_activity_log;
DROP POLICY IF EXISTS "Club admin gamification_activity_log manage" ON gamification_activity_log;
CREATE POLICY "Club admin gamification_activity_log manage" ON gamification_activity_log FOR ALL
    USING (is_club_admin(club_id)) WITH CHECK (is_club_admin(club_id));

-- 5e. Tables whose admin policies looked only at club_members (so club owners were locked out)
DROP POLICY IF EXISTS "Club admin availabilities manage" ON player_availabilities;
CREATE POLICY "Club admin availabilities manage" ON player_availabilities FOR ALL
    USING (is_club_admin(club_id)) WITH CHECK (is_club_admin(club_id));

DROP POLICY IF EXISTS "Club admin draft lineups manage" ON draft_lineups;
CREATE POLICY "Club admin draft lineups manage" ON draft_lineups FOR ALL
    USING (is_club_admin(club_id)) WITH CHECK (is_club_admin(club_id));

-- Seasons were writable by anyone
DROP POLICY IF EXISTS "Club admins can insert seasons" ON club_seasons;
DROP POLICY IF EXISTS "Club admins can update seasons" ON club_seasons;
DROP POLICY IF EXISTS "Club admins can delete seasons" ON club_seasons;
DROP POLICY IF EXISTS "Club admin seasons manage" ON club_seasons;
CREATE POLICY "Club admin seasons manage" ON club_seasons FOR ALL
    USING (is_club_admin(club_id)) WITH CHECK (is_club_admin(club_id));

-- 5f. member_messages
ALTER TABLE member_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Club admin member_messages manage" ON member_messages;
CREATE POLICY "Club admin member_messages manage" ON member_messages FOR ALL
    USING (is_club_admin(club_id)) WITH CHECK (is_club_admin(club_id));

DROP POLICY IF EXISTS "Public member message submit" ON member_messages;
CREATE POLICY "Public member message submit" ON member_messages FOR INSERT
    WITH CHECK (sender_type = 'member');

-- ------------------------------------------------------------------------------
-- 6. Reload PostgREST's schema cache
-- ------------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
