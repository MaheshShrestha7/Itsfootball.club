-- ==============================================================================
-- Migration: Score by chat (Itsfootball.club Bot on Telegram)
--
--   * club_chat_settings: per club, whether linked members may score by chat (the club admin's switch)
--     and whether the AI may read their messages (Mission Control's switch; new clubs start off).
--   * platform_chat_settings: one row. The AI master switch and the daily limits.
--   * chat_links: a member's chat (a Telegram chat id) linked to their club membership, plus the
--     bot's short memory for that chat (the game picked, a question waiting for an answer).
--   * chat_link_codes: one-time codes behind the "Link chat" link, valid 24 hours.
--   * chat_messages: what each chat sent and what the bot did, for Undo, disputes and the AI counts.
--     Kept 30 days (the reminders cron deletes older rows).
--   * match_events.logged_via: "chat:Raj Thapa" on events sent by chat, for the "by chat" tag.
--   * chat_member_can_score(member): the same rule as has_club_perm(['match-center'], 'edit'), for a
--     member the server acts for (the bot has no signed-in user).
--   * chat_log_event / chat_undo_event: save or remove an event and move the score by one in the same
--     statement, so two phones scoring one game can't overwrite each other's goal.
--
-- Every table is server-only: RLS on, no policies; the API routes use the service role.
-- The app hides score by chat until this runs. Safe to run more than once.
-- ==============================================================================

ALTER TABLE match_events ADD COLUMN IF NOT EXISTS logged_via TEXT CHECK (logged_via IS NULL OR char_length(logged_via) <= 80);

CREATE TABLE IF NOT EXISTS club_chat_settings (
    club_id UUID PRIMARY KEY REFERENCES clubs(id) ON DELETE CASCADE,
    scoring_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ai_allowed BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_chat_settings (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    ai_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    daily_limit INT NOT NULL DEFAULT 400 CHECK (daily_limit BETWEEN 0 AND 100000),
    club_daily_limit INT NOT NULL DEFAULT 50 CHECK (club_daily_limit BETWEEN 0 AND 100000),
    per_minute INT NOT NULL DEFAULT 30 CHECK (per_minute BETWEEN 1 AND 600),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO platform_chat_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS chat_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES club_members(id) ON DELETE CASCADE,
    channel TEXT NOT NULL DEFAULT 'telegram' CHECK (channel IN ('telegram')),
    chat_id TEXT NOT NULL CHECK (char_length(chat_id) <= 40),
    active_match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
    pending JSONB CHECK (pending IS NULL OR (jsonb_typeof(pending) = 'object' AND pg_column_size(pending) < 4000)),
    linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    UNIQUE (channel, chat_id, member_id)
);
CREATE INDEX IF NOT EXISTS chat_links_chat ON chat_links (channel, chat_id);
CREATE INDEX IF NOT EXISTS chat_links_member ON chat_links (member_id);

CREATE TABLE IF NOT EXISTS chat_link_codes (
    code TEXT PRIMARY KEY CHECK (code ~ '^[A-Za-z0-9_-]{8,64}$'),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES club_members(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
    member_id UUID REFERENCES club_members(id) ON DELETE SET NULL,
    match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
    channel TEXT NOT NULL DEFAULT 'telegram',
    chat_id TEXT NOT NULL,
    body TEXT NOT NULL CHECK (char_length(body) <= 500),
    -- Who read it: 'short' (plain code), 'flash-lite', 'gemma', 'none' (not understood / AI off or at its limit)
    reader TEXT NOT NULL DEFAULT 'short' CHECK (reader IN ('short', 'flash-lite', 'gemma', 'none')),
    result TEXT CHECK (result IS NULL OR char_length(result) <= 500),
    event_id UUID,
    ai_error BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS chat_messages_day ON chat_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS chat_messages_club_day ON chat_messages (club_id, created_at DESC);

ALTER TABLE club_chat_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_chat_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_link_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- has_club_perm(p_club_id, ['match-center'], 'edit') for a given member instead of auth.uid()
CREATE OR REPLACE FUNCTION chat_member_can_score(p_member_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM club_members m
         WHERE m.id = p_member_id
           AND COALESCE(m.membership_status, 'approved') = 'approved'
           AND COALESCE(m.status, 'active') <> 'suspended'
           AND (
               member_is_admin(m.role, m.roles)
               OR (m.user_id IS NOT NULL AND EXISTS (SELECT 1 FROM clubs c WHERE c.id = m.club_id AND c.owner_id = m.user_id))
               OR EXISTS (
                   SELECT 1 FROM club_access_roles r
                    WHERE r.club_id = m.club_id
                      AND lower(r.name) = ANY (member_labels(m.role, m.roles))
                      AND (r.is_super OR perm_rank(r.permissions ->> 'match-center') >= perm_rank('edit'))
               )
           )
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Saves one event and, for a goal, adds one to the right side's score in the same statement.
-- An own goal counts for the other side (as goalScoringSide does in the app).
CREATE OR REPLACE FUNCTION chat_log_event(
    p_match_id UUID, p_event_type TEXT, p_team_side TEXT, p_player_name TEXT,
    p_minute INT, p_added_minute INT, p_detail TEXT, p_logged_via TEXT
) RETURNS TABLE (event_id UUID, home_score INT, away_score INT) AS $$
#variable_conflict use_column
DECLARE
    v_club UUID;
    v_id UUID := gen_random_uuid();
    v_side TEXT;
BEGIN
    SELECT m.club_id INTO v_club FROM matches m WHERE m.id = p_match_id AND m.status IN ('live', 'halftime') FOR UPDATE;
    IF v_club IS NULL THEN RAISE EXCEPTION 'match is not live'; END IF;
    INSERT INTO match_events (id, match_id, club_id, minute, added_minute, event_type, team_side, player_name, detail_text, logged_via)
    VALUES (v_id, p_match_id, v_club, p_minute, COALESCE(p_added_minute, 0), p_event_type, p_team_side, p_player_name, NULLIF(p_detail, ''), p_logged_via);
    v_side := CASE
        WHEN p_event_type IN ('goal', 'penalty') THEN p_team_side
        WHEN p_event_type = 'own_goal' THEN CASE p_team_side WHEN 'home' THEN 'away' ELSE 'home' END
    END;
    RETURN QUERY UPDATE matches m SET
        home_score = m.home_score + CASE WHEN v_side = 'home' THEN 1 ELSE 0 END,
        away_score = m.away_score + CASE WHEN v_side = 'away' THEN 1 ELSE 0 END
     WHERE m.id = p_match_id
     RETURNING v_id, m.home_score, m.away_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Removes an event the chat logged and takes its goal off the score (never below 0)
CREATE OR REPLACE FUNCTION chat_undo_event(p_event_id UUID)
RETURNS TABLE (home_score INT, away_score INT) AS $$
#variable_conflict use_column
DECLARE
    v_ev match_events%ROWTYPE;
    v_side TEXT;
BEGIN
    SELECT * INTO v_ev FROM match_events e WHERE e.id = p_event_id;
    IF v_ev.id IS NULL THEN RAISE EXCEPTION 'event not found'; END IF;
    PERFORM 1 FROM matches m WHERE m.id = v_ev.match_id FOR UPDATE;
    DELETE FROM match_events e WHERE e.id = p_event_id;
    v_side := CASE
        WHEN v_ev.event_type IN ('goal', 'penalty') THEN v_ev.team_side
        WHEN v_ev.event_type = 'own_goal' THEN CASE v_ev.team_side WHEN 'home' THEN 'away' ELSE 'home' END
    END;
    RETURN QUERY UPDATE matches m SET
        home_score = GREATEST(0, m.home_score - CASE WHEN v_side = 'home' THEN 1 ELSE 0 END),
        away_score = GREATEST(0, m.away_score - CASE WHEN v_side = 'away' THEN 1 ELSE 0 END)
     WHERE m.id = v_ev.match_id
     RETURNING m.home_score, m.away_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION chat_member_can_score(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION chat_log_event(UUID, TEXT, TEXT, TEXT, INT, INT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION chat_undo_event(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION chat_member_can_score(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION chat_log_event(UUID, TEXT, TEXT, TEXT, INT, INT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION chat_undo_event(UUID) TO service_role;
