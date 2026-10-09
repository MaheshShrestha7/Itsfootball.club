-- ==============================================================================
-- Migration: club access roles (granular admin permissions)
-- Date: 2026-10-23
--
-- Until now the admin area was all or nothing: the Owner and "Club Admin" members could do
-- everything, everyone else nothing. Each club now has its own list of access roles
-- (Treasurer, Manager, Secretary, ...), each with a level per admin area:
--     view  - open the page and read its data
--     edit  - also create and change records
--     full  - also delete records
-- A member holds a role by carrying its name as one of their squad role labels (club_members.role
-- / roles, the same labels the squad screen already saves). Several roles combine: the highest
-- level any of them gives wins, per area.
--
-- The Owner and the locked "Club Admin" role are super users: every area at full, plus managing
-- the roles themselves and who holds them. Nobody else can change a member's access roles.
--
-- Area keys are the admin page names (the URL segment after /admin/), listed in lib/permissions.ts.
--
-- Safe to run more than once.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Roles
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS club_access_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    -- No commas: club_members.role stores labels as one comma-joined string
    name VARCHAR(64) NOT NULL CHECK (length(trim(name)) > 0 AND position(',' IN name) = 0),
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(permissions) = 'object'),
    is_super BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL DEFAULT 100,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_club_access_roles_name ON club_access_roles (club_id, lower(name));

-- Role labels can now be longer than the original 32 characters ('Player, Treasurer, Secretary').
-- The view and the policy that read the column have to be dropped around the type change.
DROP VIEW IF EXISTS club_members_public;
DROP POLICY IF EXISTS "Public membership applications" ON club_members;
ALTER TABLE club_members ALTER COLUMN role TYPE TEXT;
CREATE POLICY "Public membership applications" ON club_members FOR INSERT
    WITH CHECK (
        membership_status = 'pending'
        AND user_id IS NULL
        AND COALESCE(is_executive, FALSE) = FALSE
        AND lower(COALESCE(role, 'player')) IN ('player', 'member', 'supporter')
        AND COALESCE(roles, '[]'::jsonb) = '[]'::jsonb
    );
CREATE VIEW club_members_public AS
    SELECT
        id, club_id, full_name, first_name, last_name, role, roles, player_position,
        secondary_positions, jersey_number, photo_url, nationality, preferred_foot, status,
        membership_tier, is_executive, executive_title, executive_bio, executive_order,
        executive_season, membership_status, created_at
    FROM club_members
    WHERE COALESCE(membership_status, 'approved') = 'approved';
GRANT SELECT ON club_members_public TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 2. Permission checks
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION perm_rank(p_level TEXT)
RETURNS INTEGER AS $$
    SELECT CASE p_level WHEN 'full' THEN 3 WHEN 'edit' THEN 2 WHEN 'view' THEN 1 ELSE 0 END;
$$ LANGUAGE sql IMMUTABLE;

-- Lower-cased squad labels of a member row ('Player, Treasurer' + ["Player","Treasurer"])
CREATE OR REPLACE FUNCTION member_labels(p_role TEXT, p_roles JSONB)
RETURNS TEXT[] AS $$
    SELECT COALESCE(array_agg(DISTINCT l), '{}') FROM (
        SELECT lower(trim(r)) AS l FROM unnest(string_to_array(COALESCE(p_role, ''), ',')) r
        UNION ALL
        SELECT lower(trim(r)) FROM jsonb_array_elements_text(
            CASE WHEN jsonb_typeof(p_roles) = 'array' THEN p_roles ELSE '[]'::jsonb END
        ) r
    ) x
    WHERE l <> '';
$$ LANGUAGE sql IMMUTABLE;

-- Does the caller reach p_level on any of p_areas at this club? p_areas NULL = on any area at all.
-- Super users (Owner, Club Admin) always do. Suspended or pending members get nothing.
CREATE OR REPLACE FUNCTION has_club_perm(p_club_id UUID, p_areas TEXT[] DEFAULT NULL, p_level TEXT DEFAULT 'view')
RETURNS BOOLEAN AS $$
    SELECT is_club_admin(p_club_id) OR EXISTS (
        SELECT 1
          FROM club_members m
          JOIN club_access_roles r ON r.club_id = m.club_id
         WHERE m.club_id = p_club_id
           AND m.user_id = auth.uid()
           AND COALESCE(m.membership_status, 'approved') = 'approved'
           AND lower(r.name) = ANY (member_labels(m.role, m.roles))
           AND EXISTS (
               SELECT 1 FROM jsonb_each_text(r.permissions) p
                WHERE (p_areas IS NULL OR p.key = ANY (p_areas))
                  AND perm_rank(p.value) >= perm_rank(p_level)
           )
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- The signed-in user's access per club, for the admin menu: super flag, role names, and the
-- highest level per area across all their roles
CREATE OR REPLACE FUNCTION my_club_permissions()
RETURNS TABLE (club_id UUID, is_admin BOOLEAN, role_names TEXT[], permissions JSONB) AS $$
    WITH mine AS (
        SELECT r.club_id AS cid, r.name, r.permissions AS perms
          FROM club_members m
          JOIN club_access_roles r ON r.club_id = m.club_id AND lower(r.name) = ANY (member_labels(m.role, m.roles))
         WHERE m.user_id = auth.uid()
           AND COALESCE(m.membership_status, 'approved') = 'approved'
    ), my_clubs AS (
        SELECT c.id AS cid FROM clubs c WHERE c.owner_id = auth.uid()
        UNION
        SELECT m.club_id FROM club_members m WHERE m.user_id = auth.uid()
    )
    SELECT
        mc.cid,
        is_club_admin(mc.cid),
        COALESCE(ARRAY(SELECT mine.name FROM mine WHERE mine.cid = mc.cid ORDER BY mine.name), '{}'),
        COALESCE((
            SELECT jsonb_object_agg(x.area, CASE x.rk WHEN 3 THEN 'full' WHEN 2 THEN 'edit' ELSE 'view' END)
              FROM (
                  SELECT p.key AS area, max(perm_rank(p.value)) AS rk
                    FROM mine, jsonb_each_text(mine.perms) p
                   WHERE mine.cid = mc.cid
                   GROUP BY p.key
                  HAVING max(perm_rank(p.value)) > 0
              ) x
        ), '{}'::jsonb)
    FROM my_clubs mc;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION has_club_perm(UUID, TEXT[], TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION my_club_permissions() TO authenticated;

-- ------------------------------------------------------------------------------
-- 3. Default roles for every club (existing ones now, new ones when created)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION seed_club_access_roles(p_club_id UUID)
RETURNS VOID AS $$
    INSERT INTO club_access_roles (club_id, name, description, is_super, sort_order, permissions)
    VALUES
        (p_club_id, 'Club Admin', 'Super user: every area, plus managing roles and who holds them', TRUE, 0, '{}'),
        (p_club_id, 'Treasurer', 'Money: payments, receipts, fees, shop and sponsor invoices', FALSE, 10,
         '{"finance":"full","shop":"full","sponsors":"edit","events":"edit","seasons":"view","squad":"view","members":"view","committee":"view","emails":"edit","analytics":"view"}'),
        (p_club_id, 'Manager', 'Head coach / manager: the football side for every team', FALSE, 20,
         '{"inquiries":"view","match-center":"full","availability":"full","lineup":"full","scanner":"edit","matches":"full","tournaments":"full","events":"edit","seasons":"view","squad":"edit","teams":"full","members":"view","committee":"view","emails":"edit","gamification":"edit","content":"edit","gallery":"edit"}'),
        (p_club_id, 'Youth Coach', 'Youth / academy coach: matchday tools, no deleting fixtures or teams', FALSE, 30,
         '{"inquiries":"view","match-center":"edit","availability":"edit","lineup":"edit","scanner":"edit","matches":"view","tournaments":"edit","events":"edit","seasons":"view","squad":"edit","teams":"edit","members":"view","committee":"view","emails":"edit","gamification":"edit","content":"edit","gallery":"edit"}'),
        (p_club_id, 'Secretary', 'Membership, committee, inbox and events', FALSE, 40,
         '{"inquiries":"full","match-center":"view","availability":"view","scanner":"edit","matches":"edit","tournaments":"edit","events":"full","seasons":"edit","squad":"edit","teams":"view","members":"full","committee":"full","emails":"full","gamification":"edit","shop":"edit","content":"edit"}'),
        (p_club_id, 'Welfare Officer', 'Safeguarding: member records and photo consent', FALSE, 50,
         '{"matches":"view","events":"view","squad":"view","teams":"view","members":"view","committee":"view","gallery":"edit"}'),
        (p_club_id, 'Media Officer', 'Website, news, gallery and live match updates', FALSE, 60,
         '{"inquiries":"view","match-center":"edit","matches":"view","tournaments":"view","events":"view","gamification":"edit","shop":"view","sponsors":"view","branding":"edit","hero-slider":"full","content":"full","gallery":"full","analytics":"view"}'),
        (p_club_id, 'Commercial Officer', 'Sponsors and sponsor slides', FALSE, 70,
         '{"inquiries":"edit","sponsors":"full","hero-slider":"edit","analytics":"view"}'),
        (p_club_id, 'Volunteer', 'Matchday helper: gate scanner, live score, handing out shop orders', FALSE, 80,
         '{"match-center":"edit","scanner":"full","matches":"view","events":"view","shop":"edit"}')
    ON CONFLICT DO NOTHING;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION seed_club_access_roles(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION trg_seed_club_access_roles()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM seed_club_access_roles(NEW.id);
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_clubs_seed_access_roles ON clubs;
CREATE TRIGGER trg_clubs_seed_access_roles AFTER INSERT ON clubs
    FOR EACH ROW EXECUTE FUNCTION trg_seed_club_access_roles();

SELECT seed_club_access_roles(id) FROM clubs;

-- ------------------------------------------------------------------------------
-- 4. Who may change roles
-- ------------------------------------------------------------------------------
ALTER TABLE club_access_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read access roles" ON club_access_roles;
CREATE POLICY "Staff read access roles" ON club_access_roles FOR SELECT
    USING (has_club_perm(club_id));
DROP POLICY IF EXISTS "Club admins manage access roles" ON club_access_roles;
CREATE POLICY "Club admins manage access roles" ON club_access_roles FOR ALL
    USING (is_club_admin(club_id)) WITH CHECK (is_club_admin(club_id));

-- The Club Admin role is fixed (is_club_admin() recognises it by name), and the names that
-- already mean something elsewhere can't become roles
CREATE OR REPLACE FUNCTION guard_club_access_role()
RETURNS TRIGGER AS $$
BEGIN
    -- Migrations, seeding (SECURITY DEFINER) and the service role
    IF current_user NOT IN ('authenticated', 'anon') THEN
        RETURN COALESCE(NEW, OLD);
    END IF;
    IF TG_OP = 'DELETE' THEN
        IF OLD.is_super THEN
            RAISE EXCEPTION 'The Club Admin role cannot be deleted' USING ERRCODE = '42501';
        END IF;
        RETURN OLD;
    END IF;
    IF TG_OP = 'INSERT' AND NEW.is_super THEN
        RAISE EXCEPTION 'There can only be one Club Admin role' USING ERRCODE = '42501';
    END IF;
    IF TG_OP = 'UPDATE' AND (
        NEW.club_id <> OLD.club_id
        OR NEW.is_super IS DISTINCT FROM OLD.is_super
        OR (OLD.is_super AND NEW.name <> OLD.name)
    ) THEN
        RAISE EXCEPTION 'The Club Admin role is fixed' USING ERRCODE = '42501';
    END IF;
    NEW.name := trim(NEW.name);
    IF NOT NEW.is_super AND lower(NEW.name) IN ('owner', 'admin', 'club admin', 'player', 'member', 'supporter') THEN
        RAISE EXCEPTION '"%" is a reserved name', NEW.name USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_guard_club_access_role ON club_access_roles;
CREATE TRIGGER trg_guard_club_access_role BEFORE INSERT OR UPDATE OR DELETE ON club_access_roles
    FOR EACH ROW EXECUTE FUNCTION guard_club_access_role();

-- Renaming or deleting a role relabels its holders, so a later role with the old name can't
-- silently hand them access again
CREATE OR REPLACE FUNCTION relabel_role_holders()
RETURNS TRIGGER AS $$
DECLARE
    v_old TEXT := lower(OLD.name);
    v_new TEXT := CASE WHEN TG_OP = 'UPDATE' THEN NEW.name END;
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.name = OLD.name THEN
        RETURN NULL;
    END IF;
    -- The club itself is being deleted (cascade): nothing to relabel
    IF NOT EXISTS (SELECT 1 FROM clubs WHERE id = OLD.club_id) THEN
        RETURN NULL;
    END IF;
    UPDATE club_members m
       SET roles = COALESCE((
               SELECT jsonb_agg(x) FROM (
                   SELECT CASE WHEN lower(trim(e)) = v_old THEN v_new ELSE e END AS x
                     FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(m.roles) = 'array' THEN m.roles ELSE '[]'::jsonb END) e
               ) s WHERE x IS NOT NULL
           ), '[]'::jsonb),
           role = COALESCE((
               SELECT string_agg(x, ', ') FROM (
                   SELECT CASE WHEN lower(trim(e)) = v_old THEN v_new ELSE trim(e) END AS x
                     FROM unnest(string_to_array(COALESCE(m.role, ''), ',')) e
               ) s WHERE x <> ''
           ), 'member')
     WHERE m.club_id = OLD.club_id
       AND v_old = ANY (member_labels(m.role, m.roles));
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_relabel_role_holders ON club_access_roles;
CREATE TRIGGER trg_relabel_role_holders AFTER UPDATE OF name OR DELETE ON club_access_roles
    FOR EACH ROW EXECUTE FUNCTION relabel_role_holders();

-- Access-granting labels a member row carries (sorted, lower case)
CREATE OR REPLACE FUNCTION access_labels(p_club_id UUID, p_role TEXT, p_roles JSONB)
RETURNS TEXT[] AS $$
    SELECT COALESCE(array_agg(l ORDER BY l), '{}')
      FROM unnest(member_labels(p_role, p_roles)) l
     WHERE l IN ('owner', 'admin', 'club admin')
        OR EXISTS (SELECT 1 FROM club_access_roles r WHERE r.club_id = p_club_id AND lower(r.name) = l);
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Only super users give or take access roles. A staff member who may edit the squad also can't
-- re-point (user_id / email) or delete a row that holds a role, which would hand its access to
-- someone else or take it away.
CREATE OR REPLACE FUNCTION guard_member_access_roles()
RETURNS TRIGGER AS $$
DECLARE
    v_row club_members := COALESCE(NEW, OLD);
BEGIN
    -- Visitors' applications (their own policy limits the labels), SECURITY DEFINER functions such
    -- as claim_my_memberships / fulfil_payment, the service role, and super users
    IF current_user <> 'authenticated' OR is_club_admin(v_row.club_id) THEN
        RETURN v_row;
    END IF;
    IF TG_OP = 'INSERT' THEN
        IF cardinality(access_labels(NEW.club_id, NEW.role, NEW.roles)) > 0 THEN
            RAISE EXCEPTION 'Only the club Owner or a Club Admin can give access roles' USING ERRCODE = '42501';
        END IF;
        RETURN NEW;
    END IF;
    IF cardinality(access_labels(OLD.club_id, OLD.role, OLD.roles)) = 0 THEN
        IF TG_OP = 'UPDATE' AND cardinality(access_labels(NEW.club_id, NEW.role, NEW.roles)) > 0 THEN
            RAISE EXCEPTION 'Only the club Owner or a Club Admin can give access roles' USING ERRCODE = '42501';
        END IF;
        RETURN v_row;
    END IF;
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Only the club Owner or a Club Admin can remove someone who holds an access role' USING ERRCODE = '42501';
    END IF;
    IF access_labels(NEW.club_id, NEW.role, NEW.roles) <> access_labels(OLD.club_id, OLD.role, OLD.roles)
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR lower(COALESCE(NEW.email, '')) <> lower(COALESCE(OLD.email, ''))
       OR NEW.club_id <> OLD.club_id THEN
        RAISE EXCEPTION 'Only the club Owner or a Club Admin can change the access roles or account of someone who holds one' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_guard_member_access_roles ON club_members;
CREATE TRIGGER trg_guard_member_access_roles BEFORE INSERT OR UPDATE OR DELETE ON club_members
    FOR EACH ROW EXECUTE FUNCTION guard_member_access_roles();

-- Club settings that stay with super users even when a role may edit the branding
CREATE OR REPLACE FUNCTION keep_club_admin_fields()
RETURNS TRIGGER AS $$
BEGIN
    IF current_user = 'authenticated' AND NOT is_club_admin(OLD.id) THEN
        NEW.slug := OLD.slug;
        NEW.previous_slugs := OLD.previous_slugs;
        NEW.custom_domain := OLD.custom_domain;
        NEW.is_active := OLD.is_active;
        NEW.email_settings := OLD.email_settings;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_keep_club_admin_fields ON clubs;
CREATE TRIGGER trg_keep_club_admin_fields BEFORE UPDATE ON clubs
    FOR EACH ROW EXECUTE FUNCTION keep_club_admin_fields();

-- ------------------------------------------------------------------------------
-- 5. Table policies: "Club admin ... manage" becomes per-area read / edit / delete
--    read = view on any read area, insert + update = edit on any write area,
--    delete = full on any delete area. Public read policies stay as they were.
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN SELECT * FROM (VALUES
        ('club_analytics',            'Club admin analytics read',                   'club_id', '{analytics}',                                   NULL,                                 NULL),
        ('club_members',              'Club admin members manage',                   'club_id', '{squad,members,committee}',                     '{squad,members,committee}',          '{squad,members}'),
        ('club_payment_settings',     'Club admin payment settings write',           'club_id', '{finance}',                                     '{finance}',                          '{finance}'),
        ('club_seasons',              'Club admin seasons manage',                   'club_id', '{seasons}',                                     '{seasons}',                          '{seasons}'),
        ('clubs',                     'Club admin clubs read',                       'id',      NULL,                                            NULL,                                 NULL),
        ('clubscore_rules',           'Club admin clubscore_rules manage',           'club_id', '{gamification}',                                '{gamification}',                     '{gamification}'),
        ('contact_inquiries',         'Club admin inquiries read',                   'club_id', '{inquiries}',                                   '{inquiries}',                        '{inquiries}'),
        ('draft_lineups',             'Club admin draft lineups manage',             'club_id', '{lineup,match-center}',                         '{lineup}',                           '{lineup}'),
        ('event_attendees',           'Club admin attendees manage',                 'club_id', '{events,scanner}',                              '{events,scanner}',                   '{events}'),
        ('events',                    'Club admin events manage',                    'club_id', '{events}',                                      '{events}',                           '{events}'),
        ('expenses',                  'Club admin expenses manage',                  'club_id', '{finance}',                                     '{finance}',                          '{finance}'),
        ('gamification_activity_log', 'Club admin gamification_activity_log manage', 'club_id', '{gamification}',                                '{gamification}',                     '{gamification}'),
        ('gate_scans',                'Club admin gate_scans manage',                'club_id', '{scanner}',                                     '{scanner}',                          '{scanner}'),
        ('internal_teams',            'Club admin internal_teams manage',            'club_id', '{teams,tournaments,lineup}',                    '{teams}',                            '{teams}'),
        ('match_events',              'Club admin match events manage',              'club_id', '{match-center,matches,tournaments}',            '{match-center,matches,tournaments}', '{match-center,matches,tournaments}'),
        ('matches',                   'Club admin matches manage',                   'club_id', '{matches,match-center,tournaments,lineup,availability}', '{matches,match-center,tournaments}', '{matches,tournaments}'),
        ('media_gallery',             'Club admin media manage',                     'club_id', '{gallery}',                                     '{gallery}',                          '{gallery}'),
        ('member_clubscore_profiles', 'Club admin member_clubscore_profiles manage', 'club_id', '{gamification}',                                '{gamification}',                     '{gamification}'),
        ('member_messages',           'Club admin member_messages manage',           'club_id', '{inquiries}',                                   '{inquiries}',                        '{inquiries}'),
        ('membership_plans',          'Club admin membership plans manage',          'club_id', '{finance}',                                     '{finance}',                          '{finance}'),
        ('news_articles',             'Club admin news manage',                      'club_id', '{content}',                                     '{content}',                          '{content}'),
        ('payments',                  'Club admin payments manage',                  'club_id', '{finance}',                                     '{finance}',                          '{finance}'),
        ('player_availabilities',     'Club admin availabilities manage',            'club_id', '{availability,lineup,match-center}',            '{availability}',                     '{availability}'),
        ('player_stats',              'Club admin player_stats manage',              'club_id', '{squad,match-center,matches}',                  '{squad,match-center,matches}',       '{squad,match-center,matches}'),
        ('shop_products',             'Club admin shop products manage',             'club_id', '{shop}',                                        '{shop}',                             '{shop}'),
        ('sponsor_analytics',         'Club admin sponsor_analytics read',           'club_id', '{sponsors,analytics}',                          NULL,                                 NULL),
        ('sponsors',                  'Club admin sponsors manage',                  'club_id', '{sponsors}',                                    '{sponsors}',                         '{sponsors}'),
        ('sponsorship_packages',      'Club admin sponsorship packages manage',      'club_id', '{sponsors,finance}',                            '{sponsors}',                         '{sponsors}'),
        ('tournament_participants',   'Club admin tournament_participants manage',
            '(SELECT tt.club_id FROM tournaments tt WHERE tt.id = tournament_participants.tournament_id)',
                                                                                                '{tournaments}',                                 '{tournaments}',                      '{tournaments}'),
        ('tournaments',               'Club admin tournaments manage',               'club_id', '{tournaments}',                                 '{tournaments}',                      '{tournaments}')
    ) AS v(tbl, old_policy, club_expr, read_areas, write_areas, delete_areas)
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t.old_policy, t.tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Staff read" ON %I', t.tbl);
        EXECUTE format('CREATE POLICY "Staff read" ON %I FOR SELECT USING (has_club_perm(%s, %L, ''view''))',
                       t.tbl, t.club_expr, t.read_areas);
        CONTINUE WHEN t.write_areas IS NULL;
        EXECUTE format('DROP POLICY IF EXISTS "Staff insert" ON %I', t.tbl);
        EXECUTE format('CREATE POLICY "Staff insert" ON %I FOR INSERT WITH CHECK (has_club_perm(%s, %L, ''edit''))',
                       t.tbl, t.club_expr, t.write_areas);
        EXECUTE format('DROP POLICY IF EXISTS "Staff update" ON %I', t.tbl);
        EXECUTE format('CREATE POLICY "Staff update" ON %I FOR UPDATE USING (has_club_perm(%s, %L, ''edit'')) WITH CHECK (has_club_perm(%s, %L, ''edit''))',
                       t.tbl, t.club_expr, t.write_areas, t.club_expr, t.write_areas);
        EXECUTE format('DROP POLICY IF EXISTS "Staff delete" ON %I', t.tbl);
        EXECUTE format('CREATE POLICY "Staff delete" ON %I FOR DELETE USING (has_club_perm(%s, %L, ''full''))',
                       t.tbl, t.club_expr, t.delete_areas);
    END LOOP;
END $$;

-- club_payment_settings had separate insert and update policies
DROP POLICY IF EXISTS "Club admin payment settings update" ON club_payment_settings;

-- clubs: the page settings that live on the club row. Delete stays Owner only, insert unchanged.
DROP POLICY IF EXISTS "Club admin clubs update" ON clubs;
DROP POLICY IF EXISTS "Staff update" ON clubs;
CREATE POLICY "Staff update" ON clubs FOR UPDATE
    USING (has_club_perm(id, '{branding,hero-slider,seasons}', 'edit'))
    WITH CHECK (has_club_perm(id, '{branding,hero-slider,seasons}', 'edit') OR owner_id = auth.uid());

-- payments: the shop sees its own orders only, not membership fees or ticket sales
DROP POLICY IF EXISTS "Staff read" ON payments;
CREATE POLICY "Staff read" ON payments FOR SELECT
    USING (has_club_perm(club_id, '{finance}', 'view')
           OR (kind = 'shop_order' AND has_club_perm(club_id, '{shop}', 'view')));

-- Handing out a shop order is the only payment change the shop makes (payments are finance's)
CREATE OR REPLACE FUNCTION set_order_handed_out(p_payment_id UUID, p_done BOOLEAN)
RETURNS VOID AS $$
DECLARE
    v_club_id UUID;
BEGIN
    SELECT club_id INTO v_club_id FROM payments WHERE id = p_payment_id AND kind = 'shop_order';
    IF v_club_id IS NULL OR NOT has_club_perm(v_club_id, '{shop}', 'edit') THEN
        RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
    END IF;
    UPDATE payments SET fulfilled_at = CASE WHEN p_done THEN NOW() END WHERE id = p_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION set_order_handed_out(UUID, BOOLEAN) TO authenticated;

-- ------------------------------------------------------------------------------
-- 6. Functions that checked is_club_admin() now check the area they serve
--    (bodies unchanged apart from that one check)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION admin_award_clubscore(
    p_member_id UUID,
    p_event_type TEXT,
    p_points INTEGER,
    p_description TEXT,
    p_reference_id UUID DEFAULT NULL,
    p_season TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_club_id UUID;
    v_season TEXT;
    v_profile member_clubscore_profiles%ROWTYPE;
    v_log gamification_activity_log%ROWTYPE;
BEGIN
    SELECT club_id INTO v_club_id FROM club_members WHERE id = p_member_id;
    IF v_club_id IS NULL OR NOT has_club_perm(v_club_id, '{gamification,match-center,scanner,events}', 'edit') THEN
        RAISE EXCEPTION 'Only club admins can award ClubScore points' USING ERRCODE = '42501';
    END IF;

    v_season := COALESCE(NULLIF(trim(p_season), ''), club_current_season(v_club_id));

    PERFORM fn_award_clubscore(v_club_id, p_member_id, p_event_type, p_points, p_description, p_reference_id, v_season);

    SELECT * INTO v_profile FROM member_clubscore_profiles WHERE member_id = p_member_id AND season = v_season;
    -- NOW() is the transaction start, the same value the log row's created_at default got
    SELECT * INTO v_log FROM gamification_activity_log
     WHERE member_id = p_member_id AND created_at = NOW()
     ORDER BY id LIMIT 1;

    RETURN jsonb_build_object('profile', to_jsonb(v_profile), 'log', to_jsonb(v_log));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION door_checkin_allowed(p_target_id UUID, p_club_id UUID, p_door_code TEXT)
RETURNS BOOLEAN AS $$
    SELECT has_club_perm(p_club_id, '{scanner,events,matches}', 'edit') OR EXISTS (
        SELECT 1 FROM door_checkin_codes d
         WHERE d.target_id = p_target_id
           AND d.code = NULLIF(trim(COALESCE(p_door_code, '')), '')
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION get_door_checkin_code(p_target_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_club_id UUID;
    v_code TEXT;
BEGIN
    SELECT club_id INTO v_club_id FROM matches WHERE id = p_target_id;
    IF v_club_id IS NULL THEN
        SELECT club_id INTO v_club_id FROM events WHERE id = p_target_id;
    END IF;
    IF v_club_id IS NULL OR NOT has_club_perm(v_club_id, '{scanner,events,matches}', 'edit') THEN
        RETURN NULL;
    END IF;

    INSERT INTO door_checkin_codes (target_id, club_id)
    VALUES (p_target_id, v_club_id)
    ON CONFLICT (target_id) DO NOTHING;

    SELECT code INTO v_code FROM door_checkin_codes WHERE target_id = p_target_id;
    RETURN v_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION fulfil_payment(p_payment_id UUID)
RETURNS payments AS $$
DECLARE
    v_pay payments;
    v_months INTEGER;
    v_plan_name TEXT;
    v_tier TEXT;
    v_qty INTEGER;
BEGIN
    SELECT * INTO v_pay FROM payments WHERE id = p_payment_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment not found';
    END IF;
    -- The webhook runs as service_role; anyone else must administer the payment's club
    IF COALESCE(auth.role(), '') <> 'service_role' AND NOT has_club_perm(v_pay.club_id, '{finance}', 'edit') THEN
        RAISE EXCEPTION 'Not allowed';
    END IF;
    IF v_pay.status = 'paid' THEN
        RETURN v_pay;
    END IF;
    IF v_pay.status IN ('refunded', 'rejected') AND COALESCE(auth.role(), '') = 'service_role' THEN
        RETURN v_pay; -- a late webhook never revives a payment an admin already closed
    END IF;

    UPDATE payments
       SET status = 'paid',
           paid_at = COALESCE(paid_at, NOW()),
           reviewed_by = CASE WHEN method = 'stripe' THEN reviewed_by ELSE auth.uid() END,
           reviewed_at = CASE WHEN method = 'stripe' THEN reviewed_at ELSE NOW() END,
           rejection_reason = NULL
     WHERE id = p_payment_id
    RETURNING * INTO v_pay;

    IF v_pay.kind IN ('membership_signup', 'membership_renewal') AND v_pay.member_id IS NOT NULL THEN
        SELECT duration_months, name INTO v_months, v_plan_name FROM membership_plans WHERE id = v_pay.plan_id;
        v_months := COALESCE(v_months, 12);
        UPDATE club_members
           SET membership_starts_at = CASE
                   WHEN v_pay.kind = 'membership_signup' THEN CURRENT_DATE
                   -- Lapsed (or never set): a new term starts today; otherwise the term continues
                   WHEN membership_expires_at IS NULL OR membership_expires_at < CURRENT_DATE
                        OR membership_starts_at IS NULL THEN CURRENT_DATE
                   ELSE membership_starts_at
               END,
               membership_expires_at = CASE
                   -- A new member's time starts today (the application pre-fills a placeholder expiry)
                   WHEN v_pay.kind = 'membership_signup' THEN CURRENT_DATE
                   -- Renewing early keeps the remaining days
                   ELSE GREATEST(CURRENT_DATE, COALESCE(membership_expires_at, CURRENT_DATE))
               END + make_interval(months => v_months),
               membership_tier = COALESCE(v_plan_name, membership_tier),
               updated_at = NOW()
         WHERE id = v_pay.member_id AND club_id = v_pay.club_id;
    ELSIF v_pay.kind = 'sponsorship' AND v_pay.sponsor_id IS NOT NULL THEN
        SELECT tier INTO v_tier FROM sponsorship_packages WHERE id = v_pay.package_id;
        UPDATE sponsors
           SET package_status = 'paid',
               package_value = v_pay.amount_cents / 100.0,
               tier = COALESCE(v_tier, tier),
               season = COALESCE(season, v_pay.season)
         WHERE id = v_pay.sponsor_id AND club_id = v_pay.club_id;
    ELSIF v_pay.kind = 'event_ticket' AND v_pay.event_id IS NOT NULL THEN
        -- One ticket per unit bought. The checkout route caps the quantity at 10; 50 is a backstop.
        SELECT COALESCE(SUM((i->>'quantity')::INTEGER), 1) INTO v_qty
          FROM jsonb_array_elements(COALESCE(v_pay.items, '[]'::jsonb)) i;
        INSERT INTO event_attendees (event_id, club_id, attendee_name, attendee_email, payment_id)
        SELECT v_pay.event_id, v_pay.club_id, COALESCE(v_pay.payer_name, 'Ticket holder'), v_pay.payer_email, v_pay.id
          FROM generate_series(1, LEAST(GREATEST(v_qty, 1), 50));
    END IF;

    RETURN v_pay;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION can_upload_club_asset(p_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_parts TEXT[] := storage.foldername(p_name);
BEGIN
    IF v_parts[1] = 'new-clubs' THEN
        RETURN auth.uid() IS NOT NULL AND v_parts[2] = auth.uid()::TEXT;
    END IF;
    IF v_parts[1] = 'clubs' AND v_parts[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RETURN has_club_perm(v_parts[2]::UUID, NULL, 'edit');
    END IF;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;

NOTIFY pgrst, 'reload schema';
