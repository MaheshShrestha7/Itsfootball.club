-- ==============================================================================
-- Migration: Hosted tournaments with guest clubs (plan 18 Nov 2026, TS-1..3 + TX-1..13)
--
-- tournaments gains:
--   * parent_id / age_group: one tournament holds several age groups. Each age group is its own
--     tournament row (own teams and draw) whose parent_id points at the first one.
--   * is_junior: player names in this tournament are shortened on public pages ("Ruby S.").
--   * match_minutes / pitches / day_end_time: each game gets its own kick-off and pitch, day by day.
--   * entry_fee_cents / entry_deadline / max_squad / team_info: what the team entry link asks for.
--   * event_id: the club event this tournament belongs to (flyer, tickets, gallery, write-up).
-- tournament_participants gains a second colour and the manager and coach (shown publicly).
--
-- tournament_entries (private, one row per guest team): the entry link's key, the contact's details,
-- the entry's state, the entry fee bill and check-in. Only staff who can edit Tournaments read it;
-- guests reach their own row through /api/tournament-entry with the key.
-- tournament_squads: the players a guest club entered. Staff read and write the table. Everyone else
-- reads tournament_squads_public, which leaves out hidden players and shortens junior names.
--
-- The app hides every new control until this has run. Safe to run more than once.
-- ==============================================================================

ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES tournaments(id) ON DELETE CASCADE;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS age_group VARCHAR(32);
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS is_junior BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS match_minutes INTEGER;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS pitches INTEGER;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS day_end_time VARCHAR(5);
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS entry_fee_cents INTEGER;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS entry_deadline TIMESTAMPTZ;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS max_squad INTEGER;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS team_info TEXT;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE SET NULL;

ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS tournaments_hosted_check;
ALTER TABLE tournaments ADD CONSTRAINT tournaments_hosted_check CHECK (
    (parent_id IS NULL OR parent_id <> id)
    AND (match_minutes IS NULL OR match_minutes BETWEEN 5 AND 180)
    AND (pitches IS NULL OR pitches BETWEEN 1 AND 20)
    AND (day_end_time IS NULL OR day_end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
    AND (entry_fee_cents IS NULL OR entry_fee_cents BETWEEN 0 AND 10000000)
    AND (max_squad IS NULL OR max_squad BETWEEN 1 AND 60)
    AND (team_info IS NULL OR char_length(team_info) <= 4000)
    AND (age_group IS NULL OR char_length(trim(age_group)) BETWEEN 1 AND 32)
);
CREATE INDEX IF NOT EXISTS idx_tournaments_parent ON tournaments (parent_id);

ALTER TABLE tournament_participants ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(32);
ALTER TABLE tournament_participants ADD COLUMN IF NOT EXISTS manager_name VARCHAR(128);
ALTER TABLE tournament_participants ADD COLUMN IF NOT EXISTS coach_name VARCHAR(128);

-- ------------------------------------------------------------------------------
-- Private entry details, one row per guest team
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tournament_entries (
    participant_id UUID PRIMARY KEY REFERENCES tournament_participants(id) ON DELETE CASCADE,
    -- Both filled in from the participant by the trigger below, never from the browser
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    entry_key TEXT UNIQUE CHECK (entry_key IS NULL OR entry_key ~ '^te-[0-9a-f]{32}$'),
    contact_name VARCHAR(128),
    contact_email VARCHAR(254),
    contact_phone VARCHAR(40),
    assistant_name VARCHAR(128),
    first_aid_name VARCHAR(128),
    status VARCHAR(16) NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'submitted')),
    submitted_at TIMESTAMPTZ,
    reminded_at TIMESTAMPTZ,
    info_sent_at TIMESTAMPTZ,
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    checked_in_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tournament_entries_tournament ON tournament_entries (tournament_id);

CREATE TABLE IF NOT EXISTS tournament_squads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_id UUID NOT NULL REFERENCES tournament_participants(id) ON DELETE CASCADE,
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    name VARCHAR(80) NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 80),
    shirt_number INTEGER CHECK (shirt_number IS NULL OR shirt_number BETWEEN 0 AND 99),
    position VARCHAR(16),
    is_junior BOOLEAN NOT NULL DEFAULT FALSE,
    hide_public BOOLEAN NOT NULL DEFAULT FALSE,
    present BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tournament_squads_participant ON tournament_squads (participant_id);
CREATE INDEX IF NOT EXISTS idx_tournament_squads_tournament ON tournament_squads (tournament_id);

-- tournament_id and club_id always come from the participant, so a row can't be filed under
-- another club's tournament
CREATE OR REPLACE FUNCTION tournament_child_fill()
RETURNS TRIGGER AS $$
BEGIN
    SELECT p.tournament_id, t.club_id INTO NEW.tournament_id, NEW.club_id
      FROM tournament_participants p JOIN tournaments t ON t.id = p.tournament_id
     WHERE p.id = NEW.participant_id;
    IF NEW.tournament_id IS NULL THEN
        RAISE EXCEPTION 'Unknown tournament team';
    END IF;
    IF TG_TABLE_NAME = 'tournament_entries' THEN
        NEW.updated_at := NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tournament_entries_fill ON tournament_entries;
CREATE TRIGGER tournament_entries_fill BEFORE INSERT OR UPDATE ON tournament_entries
    FOR EACH ROW EXECUTE FUNCTION tournament_child_fill();
DROP TRIGGER IF EXISTS tournament_squads_fill ON tournament_squads;
CREATE TRIGGER tournament_squads_fill BEFORE INSERT OR UPDATE ON tournament_squads
    FOR EACH ROW EXECUTE FUNCTION tournament_child_fill();

ALTER TABLE tournament_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_squads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage tournament entries" ON tournament_entries;
CREATE POLICY "Staff manage tournament entries" ON tournament_entries FOR ALL TO authenticated
    USING (has_club_perm(club_id, '{tournaments}', 'edit'))
    WITH CHECK (has_club_perm(club_id, '{tournaments}', 'edit'));

DROP POLICY IF EXISTS "Staff manage tournament squads" ON tournament_squads;
CREATE POLICY "Staff manage tournament squads" ON tournament_squads FOR ALL TO authenticated
    USING (has_club_perm(club_id, '{tournaments}', 'edit'))
    WITH CHECK (has_club_perm(club_id, '{tournaments}', 'edit'));

REVOKE ALL ON tournament_entries FROM anon;
REVOKE ALL ON tournament_squads FROM anon;

-- "Ruby Smith" -> "Ruby S.", the same as juniorPublicName() in lib/teams.ts
CREATE OR REPLACE FUNCTION junior_public_name(p_name TEXT)
RETURNS TEXT AS $$
    SELECT CASE WHEN n = 0 THEN '' WHEN n = 1 THEN w[1] ELSE w[1] || ' ' || upper(left(w[n], 1)) || '.' END
      FROM (SELECT w, COALESCE(array_length(w, 1), 0) AS n
              FROM (SELECT CASE WHEN trim(COALESCE(p_name, '')) = '' THEN ARRAY[]::TEXT[]
                                ELSE regexp_split_to_array(trim(p_name), '\s+') END AS w) a) b;
$$ LANGUAGE sql IMMUTABLE;

-- What visitors see of a guest squad: no hidden players, junior names shortened
CREATE OR REPLACE VIEW tournament_squads_public AS
    SELECT s.id, s.participant_id, s.tournament_id, s.club_id,
           CASE WHEN s.is_junior OR t.is_junior THEN junior_public_name(s.name) ELSE s.name END AS name,
           s.shirt_number, s.position, s.sort_order
      FROM tournament_squads s
      JOIN tournaments t ON t.id = s.tournament_id
     WHERE NOT s.hide_public;

GRANT SELECT ON tournament_squads_public TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
