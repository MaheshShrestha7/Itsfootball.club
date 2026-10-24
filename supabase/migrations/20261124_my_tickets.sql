-- ==============================================================================
-- Migration: "My tickets" for signed-in buyers (SUP-N1)
-- Date: 2026-11-24
--
-- Ticket orders are bought without an account, against an email address. A signed-in person sees
-- the orders placed with their confirmed sign-in email at this club: paid ones (with their ticket
-- link) and bank transfers still waiting for the club to check the receipt.
--
-- Safe to run more than once.
-- ==============================================================================

CREATE OR REPLACE FUNCTION my_ticket_orders(p_club_id UUID)
RETURNS TABLE (id UUID, event_id UUID, event_title TEXT, start_time TIMESTAMPTZ, quantity INTEGER, status TEXT) AS $$
    SELECT p.id, p.event_id, e.title, e.start_time,
           COALESCE((SELECT SUM((i->>'quantity')::INTEGER) FROM jsonb_array_elements(COALESCE(p.items, '[]'::jsonb)) i), 1)::INTEGER,
           p.status::TEXT
      FROM payments p
      JOIN events e ON e.id = p.event_id
     WHERE p.club_id = p_club_id
       AND p.kind = 'event_ticket'
       AND p.status IN ('paid', 'awaiting_review')
       AND COALESCE(my_confirmed_email(), '') <> ''
       AND lower(p.payer_email) = my_confirmed_email()
     ORDER BY e.start_time DESC
     LIMIT 50;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION my_ticket_orders(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION my_ticket_orders(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
