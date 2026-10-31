-- ==============================================================================
-- Migration: member prices in the shop and on tickets (plans/003-member-perks.md, phase 4)
-- Date: 2026-10-31
--
-- shop_products.member_price_cents      blank = members pay price_cents
-- events.ticket_member_price_cents      blank = members pay ticket_price_cents
--
-- What a payer is charged is decided on the server (lib/payments-server.ts): the member price
-- applies when the signed-in payer is an approved, unsuspended, in-date member of the club, or
-- the guardian of one (the same rule as is_active_club_member, 20261141).
--
-- A member price is above zero: a $0 order has nothing to pay and no claim flow (yet).
--
-- Safe to run more than once.
-- ==============================================================================

ALTER TABLE shop_products ADD COLUMN IF NOT EXISTS member_price_cents INTEGER;
ALTER TABLE shop_products DROP CONSTRAINT IF EXISTS shop_products_member_price_check;
ALTER TABLE shop_products ADD CONSTRAINT shop_products_member_price_check
    CHECK (member_price_cents IS NULL OR (member_price_cents > 0 AND member_price_cents <= price_cents));

ALTER TABLE events ADD COLUMN IF NOT EXISTS ticket_member_price_cents INTEGER;
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_ticket_member_price_check;
ALTER TABLE events ADD CONSTRAINT events_ticket_member_price_check
    CHECK (ticket_member_price_cents IS NULL OR (ticket_member_price_cents > 0 AND ticket_member_price_cents <= ticket_price_cents));

NOTIFY pgrst, 'reload schema';
