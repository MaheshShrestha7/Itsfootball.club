-- ==============================================================================
-- Migration: paid event tickets
-- Date: 2026-10-18
--
-- events.ticket_price_cents   > 0 sells tickets for a public event (match-day tickets are events
--                             with category 'match'); 0 keeps the event free
-- payments                    an order is one payments row: kind 'event_ticket', category
--                             'events_tickets', event_id set, `items` holds the quantity
-- event_attendees             one row per ticket, created by fulfil_payment once the card payment
--                             lands; qr_ticket_code is what the gate scans
-- tickets_left()              what the public event page and checkout read (NULL = no limit)
-- public_event_checkin()      accepts ticket codes, refuses a ticket twice, and at a ticketed event
--                             admits ticket holders only
--
-- Safe to run more than once.
-- ==============================================================================

ALTER TABLE events ADD COLUMN IF NOT EXISTS ticket_price_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_ticket_price_check;
ALTER TABLE events ADD CONSTRAINT events_ticket_price_check CHECK (ticket_price_cents >= 0);

ALTER TABLE payments ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE SET NULL;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_kind_check;
ALTER TABLE payments ADD CONSTRAINT payments_kind_check
    CHECK (kind IN ('membership_signup', 'membership_renewal', 'sponsorship', 'shop_order', 'event_ticket', 'income_other'));

ALTER TABLE event_attendees ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_attendees_payment ON event_attendees (payment_id);

-- Door lists: admins read (and can cancel) their club's tickets. Buyers read theirs through the
-- server (/api/tickets/[orderId]), never directly.
DROP POLICY IF EXISTS "Club admin attendees manage" ON event_attendees;
CREATE POLICY "Club admin attendees manage" ON event_attendees FOR ALL
    USING (is_club_admin(club_id)) WITH CHECK (is_club_admin(club_id));

-- ------------------------------------------------------------------------------
-- Tickets left for a public event; NULL when the event has no capacity limit
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION tickets_left(p_event_id UUID)
RETURNS INTEGER AS $$
    SELECT CASE WHEN COALESCE(e.max_capacity, 0) <= 0 THEN NULL ELSE GREATEST(0, e.max_capacity - (
        SELECT count(*) FROM event_attendees a WHERE a.event_id = e.id AND a.checkin_status <> 'cancelled'
    ))::INTEGER END
      FROM events e
     WHERE e.id = p_event_id AND e.is_public;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION tickets_left(UUID) TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- fulfil_payment: as in 20261011, plus tickets for event_ticket payments
-- ------------------------------------------------------------------------------
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
    IF COALESCE(auth.role(), '') <> 'service_role' AND NOT is_club_admin(v_pay.club_id) THEN
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

REVOKE ALL ON FUNCTION fulfil_payment(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fulfil_payment(UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- A refunded (or rejected) order cancels its unused tickets, whichever way it was refunded:
-- the Stripe webhook or an admin in Finance
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_fn_cancel_order_tickets()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE event_attendees SET checkin_status = 'cancelled'
     WHERE payment_id = NEW.id AND checkin_status = 'registered';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_payment_cancel_tickets ON payments;
CREATE TRIGGER trg_payment_cancel_tickets
    AFTER UPDATE OF status ON payments
    FOR EACH ROW
    WHEN (NEW.status IN ('refunded', 'rejected') AND OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION trg_fn_cancel_order_tickets();

-- ------------------------------------------------------------------------------
-- public_event_checkin: as in 20261006, plus tickets
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public_event_checkin(
    p_event_id UUID,
    p_token TEXT DEFAULT NULL,
    p_name TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_door_code TEXT DEFAULT NULL
)
RETURNS TABLE (success BOOLEAN, message TEXT, attendee_name TEXT) AS $$
DECLARE
    v_event events%ROWTYPE;
    v_member club_members%ROWTYPE;
    v_ticket event_attendees%ROWTYPE;
    v_name TEXT := NULLIF(trim(COALESCE(p_name, '')), '');
    v_token TEXT := NULLIF(trim(COALESCE(p_token, '')), '');
    v_email TEXT := NULLIF(lower(trim(COALESCE(p_email, ''))), '');
    v_scan_key TEXT;
    v_points INTEGER;
BEGIN
    SELECT * INTO v_event FROM events WHERE events.id = p_event_id;
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Event not found.', NULL::TEXT;
        RETURN;
    END IF;

    IF NOT COALESCE(v_event.door_qr_checkin_enabled, FALSE) THEN
        RETURN QUERY SELECT FALSE, 'Door QR self check-in is not active for this event.', NULL::TEXT;
        RETURN;
    END IF;

    IF NOT door_checkin_allowed(p_event_id, v_event.club_id, p_door_code) THEN
        RETURN QUERY SELECT FALSE, 'This check-in link is not valid. Please scan the QR code at the entrance.', NULL::TEXT;
        RETURN;
    END IF;

    -- A ticket for this event: valid once
    IF v_token IS NOT NULL THEN
        SELECT * INTO v_ticket FROM event_attendees a WHERE a.event_id = p_event_id AND a.qr_ticket_code = v_token;
        IF FOUND THEN
            IF v_ticket.checkin_status = 'cancelled' THEN
                RETURN QUERY SELECT FALSE, 'This ticket was cancelled (refunded).', v_ticket.attendee_name::TEXT;
                RETURN;
            END IF;
            -- The status condition makes two simultaneous scans of one ticket admit only one
            UPDATE event_attendees SET checkin_status = 'checked_in', checked_in_at = NOW()
             WHERE id = v_ticket.id AND checkin_status = 'registered';
            IF NOT FOUND THEN
                RETURN QUERY SELECT FALSE, 'This ticket has already been scanned.', v_ticket.attendee_name::TEXT;
                RETURN;
            END IF;
            INSERT INTO gate_scans (club_id, scan_type, token, member_id, member_name, event_id, event_title, valid)
            VALUES (v_event.club_id, 'event_checkin', v_token, NULL, v_ticket.attendee_name, p_event_id, v_event.title, TRUE);
            UPDATE events SET rsvp_count = COALESCE(rsvp_count, 0) + 1 WHERE events.id = p_event_id;
            RETURN QUERY SELECT TRUE, 'Ticket valid. Welcome to ' || v_event.title || '!', v_ticket.attendee_name::TEXT;
            RETURN;
        END IF;
    END IF;

    -- A ticketed event admits ticket holders only
    IF COALESCE(v_event.ticket_price_cents, 0) > 0 THEN
        RETURN QUERY SELECT FALSE, 'This event needs a ticket. Please show the QR code on your ticket.', NULL::TEXT;
        RETURN;
    END IF;

    IF v_token IS NOT NULL THEN
        SELECT * INTO v_member
          FROM club_members m
         WHERE m.club_id = v_event.club_id
           AND m.qr_code_token = v_token
           AND COALESCE(m.membership_status, 'approved') = 'approved'
           AND m.status <> 'suspended'
         LIMIT 1;
        IF FOUND THEN
            v_name := v_member.full_name;
        ELSIF v_name IS NULL THEN
            RETURN QUERY SELECT FALSE, 'Invalid member pass token provided.', NULL::TEXT;
            RETURN;
        END IF;
    END IF;

    IF v_name IS NULL THEN
        v_name := 'Guest Attendee';
    END IF;

    v_scan_key := CASE
        WHEN v_member.id IS NOT NULL THEN v_member.qr_code_token
        ELSE LEFT('guest:' || COALESCE(v_email, lower(v_name)), 128)
    END;

    IF EXISTS (
        SELECT 1 FROM gate_scans g
         WHERE g.event_id = p_event_id AND g.scan_type = 'event_checkin' AND g.valid AND g.token = v_scan_key
    ) THEN
        RETURN QUERY SELECT TRUE, 'You are already checked in for this event.', v_name;
        RETURN;
    END IF;

    INSERT INTO gate_scans (club_id, scan_type, token, member_id, member_name, event_id, event_title, valid)
    VALUES (v_event.club_id, 'event_checkin', v_scan_key, v_member.id, v_name, p_event_id, v_event.title, TRUE);

    UPDATE events SET rsvp_count = COALESCE(rsvp_count, 0) + 1 WHERE events.id = p_event_id;

    IF v_member.id IS NOT NULL THEN
        v_points := CASE WHEN v_event.category = 'social' THEN 5 ELSE 10 END;
        BEGIN
            PERFORM fn_award_clubscore(
                v_event.club_id,
                v_member.id,
                CASE WHEN v_event.category = 'social' THEN 'social_checkin' ELSE 'training_checkin' END,
                COALESCE(
                    (SELECT CASE WHEN v_event.category = 'social' THEN r.points_social_checkin ELSE r.points_training_checkin END
                       FROM clubscore_rules r WHERE r.club_id = v_event.club_id),
                    v_points
                ),
                'Door QR Check-In: ' || v_event.title,
                p_event_id,
                COALESCE(v_event.season, '2025/2026')
            );
        EXCEPTION WHEN OTHERS THEN
            NULL; -- points are a bonus; never block the check-in
        END;
    END IF;

    RETURN QUERY SELECT TRUE, 'You''re checked in at ' || v_event.location || '. See you there!', v_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public_event_checkin(UUID, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
