-- ==============================================================================
-- Migration: hand out shop orders without editing the shop
-- Date: 2026-10-24
--
-- Handing out orders needed Shop "edit", which also let a Volunteer change products and prices.
-- A separate area, "shop-orders", now covers seeing shop orders and marking them handed out.
-- Shop "edit" still includes it (Treasurer and Secretary keep handing orders out).
--
-- Safe to run more than once.
-- ==============================================================================

CREATE OR REPLACE FUNCTION set_order_handed_out(p_payment_id UUID, p_done BOOLEAN)
RETURNS VOID AS $$
DECLARE
    v_club_id UUID;
BEGIN
    SELECT club_id INTO v_club_id FROM payments WHERE id = p_payment_id AND kind = 'shop_order';
    IF v_club_id IS NULL OR NOT has_club_perm(v_club_id, '{shop,shop-orders}', 'edit') THEN
        RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
    END IF;
    UPDATE payments SET fulfilled_at = CASE WHEN p_done THEN NOW() END WHERE id = p_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP POLICY IF EXISTS "Staff read" ON payments;
CREATE POLICY "Staff read" ON payments FOR SELECT
    USING (has_club_perm(club_id, '{finance}', 'view')
           OR (kind = 'shop_order' AND has_club_perm(club_id, '{shop,shop-orders}', 'view')));

-- New clubs: Volunteer views the shop and hands out orders
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
         '{"match-center":"edit","scanner":"full","matches":"view","events":"view","shop":"view","shop-orders":"edit"}')
    ON CONFLICT DO NOTHING;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION seed_club_access_roles(UUID) FROM PUBLIC, anon, authenticated;

-- Existing clubs: Volunteer roles still on the old default move over (customised ones are left alone)
UPDATE club_access_roles
   SET permissions = permissions || '{"shop":"view","shop-orders":"edit"}'
 WHERE name = 'Volunteer'
   AND NOT is_super
   AND permissions->>'shop' = 'edit'
   AND NOT permissions ? 'shop-orders';

NOTIFY pgrst, 'reload schema';
