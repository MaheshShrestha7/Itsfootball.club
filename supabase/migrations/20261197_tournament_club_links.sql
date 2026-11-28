-- ==============================================================================
-- Migration: link a club that is already on itsfootball.club as a team in another club's tournament
-- Date: 2026-11-28
--
-- The host adds a team by finding the club (e.g. ANCC FC) instead of typing it in. The team row in
-- tournament_participants stays as it is (name, crest and colours are copied at link time and the host
-- can change them); this table only records which club and team it is, and whether that club agreed:
--   status 'pending'   the linked club's admins see an invitation on their dashboard
--          'accepted'  the team links to the club's page, and (when show_on_linked_site) the games show
--                      in that club's own Fixtures and Results
--          'declined'  the team stays in the host's tournament as a typed-in team
-- Only the linked club can accept or decline (respond_tournament_link); only the host's Tournaments
-- editors can add, change or remove a link. Accepted links are public (they only name the two clubs).
-- Until this runs the "Find a club" search stays hidden and nothing changes.
--
-- Safe to run more than once.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS tournament_club_links (
    participant_id UUID PRIMARY KEY REFERENCES tournament_participants(id) ON DELETE CASCADE,
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    host_club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    linked_club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    linked_team_id UUID REFERENCES club_teams(id) ON DELETE SET NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    show_on_linked_site BOOLEAN NOT NULL DEFAULT TRUE,
    responded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tournament_club_links_linked ON tournament_club_links (linked_club_id, status);
CREATE INDEX IF NOT EXISTS idx_tournament_club_links_tournament ON tournament_club_links (tournament_id);

-- tournament_id and host_club_id always come from the team; only the linked club moves the status
CREATE OR REPLACE FUNCTION tournament_club_link_fill()
RETURNS TRIGGER AS $$
BEGIN
    SELECT p.tournament_id, t.club_id INTO NEW.tournament_id, NEW.host_club_id
    FROM tournament_participants p JOIN tournaments t ON t.id = p.tournament_id
    WHERE p.id = NEW.participant_id;
    IF NEW.host_club_id IS NULL THEN
        RAISE EXCEPTION 'Unknown tournament team';
    END IF;
    IF NEW.linked_club_id = NEW.host_club_id THEN
        RAISE EXCEPTION 'A club can''t link itself as a guest team';
    END IF;
    IF NEW.linked_team_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM club_teams ct WHERE ct.id = NEW.linked_team_id AND ct.club_id = NEW.linked_club_id) THEN
        NEW.linked_team_id := NULL;
    END IF;

    IF TG_OP = 'INSERT' OR NEW.linked_club_id IS DISTINCT FROM OLD.linked_club_id THEN
        -- A new link (or a different club) always waits for that club to answer
        NEW.status := 'pending';
        NEW.responded_at := NULL;
    ELSIF NEW.status IS DISTINCT FROM OLD.status
          AND NOT (is_club_admin(NEW.linked_club_id) OR has_club_perm(NEW.linked_club_id, '{tournaments}', 'edit')) THEN
        NEW.status := OLD.status;
        NEW.responded_at := OLD.responded_at;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tournament_club_links_fill ON tournament_club_links;
CREATE TRIGGER tournament_club_links_fill BEFORE INSERT OR UPDATE ON tournament_club_links
    FOR EACH ROW EXECUTE FUNCTION tournament_club_link_fill();

ALTER TABLE tournament_club_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads accepted tournament links" ON tournament_club_links;
CREATE POLICY "Anyone reads accepted tournament links" ON tournament_club_links FOR SELECT TO anon, authenticated
    USING (status = 'accepted');

DROP POLICY IF EXISTS "Both clubs read their tournament links" ON tournament_club_links;
CREATE POLICY "Both clubs read their tournament links" ON tournament_club_links FOR SELECT TO authenticated
    USING (has_club_perm(host_club_id, '{tournaments}', 'view') OR is_club_admin(linked_club_id)
           OR has_club_perm(linked_club_id, '{tournaments}', 'edit'));

DROP POLICY IF EXISTS "Host staff add tournament links" ON tournament_club_links;
CREATE POLICY "Host staff add tournament links" ON tournament_club_links FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM tournament_participants p JOIN tournaments t ON t.id = p.tournament_id
                        WHERE p.id = participant_id AND has_club_perm(t.club_id, '{tournaments}', 'edit')));

DROP POLICY IF EXISTS "Host staff change tournament links" ON tournament_club_links;
CREATE POLICY "Host staff change tournament links" ON tournament_club_links FOR UPDATE TO authenticated
    USING (has_club_perm(host_club_id, '{tournaments}', 'edit'))
    WITH CHECK (has_club_perm(host_club_id, '{tournaments}', 'edit'));

DROP POLICY IF EXISTS "Host staff remove tournament links" ON tournament_club_links;
CREATE POLICY "Host staff remove tournament links" ON tournament_club_links FOR DELETE TO authenticated
    USING (has_club_perm(host_club_id, '{tournaments}', 'edit'));

GRANT SELECT ON tournament_club_links TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON tournament_club_links TO authenticated;

-- The linked club's answer: its admins (or Tournaments editors) accept or decline
CREATE OR REPLACE FUNCTION respond_tournament_link(p_participant_id UUID, p_accept BOOLEAN)
RETURNS TEXT AS $$
DECLARE
    v_linked UUID;
BEGIN
    SELECT linked_club_id INTO v_linked FROM tournament_club_links WHERE participant_id = p_participant_id;
    IF v_linked IS NULL THEN
        RAISE EXCEPTION 'That invitation has gone';
    END IF;
    IF NOT (is_club_admin(v_linked) OR has_club_perm(v_linked, '{tournaments}', 'edit')) THEN
        RAISE EXCEPTION 'Only the invited club''s admins can answer';
    END IF;
    UPDATE tournament_club_links
       SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END, responded_at = NOW()
     WHERE participant_id = p_participant_id;
    RETURN CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION respond_tournament_link(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION respond_tournament_link(UUID, BOOLEAN) TO authenticated;

