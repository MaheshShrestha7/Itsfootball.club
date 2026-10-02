-- ==============================================================================
-- Migration: club shop - merchandise sold online, collected from the club
-- Date: 2026-10-17
--
-- shop_products   the club's merch: up to 3 uploaded photos, optional sizes, a price
-- payments        an order is one payments row: kind 'shop_order', category 'merchandise',
--                 `items` holds what was bought (priced by the server), `fulfilled_at` is
--                 set when the club hands it over. Paying, receipts and refunds work as before.
--
-- Safe to run more than once.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS shop_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    photos TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(photos) <= 3),
    -- Empty = one size only
    sizes TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(sizes) <= 20),
    price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shop_products_club ON shop_products (club_id, sort_order);

ALTER TABLE shop_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public shop products read" ON shop_products;
CREATE POLICY "Public shop products read" ON shop_products FOR SELECT
    USING (is_active OR is_club_admin(club_id));
DROP POLICY IF EXISTS "Club admin shop products manage" ON shop_products;
CREATE POLICY "Club admin shop products manage" ON shop_products FOR ALL
    USING (is_club_admin(club_id)) WITH CHECK (is_club_admin(club_id));

-- Orders live in the payments ledger
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_kind_check;
ALTER TABLE payments ADD CONSTRAINT payments_kind_check
    CHECK (kind IN ('membership_signup', 'membership_renewal', 'sponsorship', 'shop_order', 'income_other'));
ALTER TABLE payments ADD COLUMN IF NOT EXISTS items JSONB;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS fulfilled_at TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
