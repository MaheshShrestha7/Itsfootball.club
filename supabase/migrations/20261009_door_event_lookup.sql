-- ==============================================================================
-- Door check-in for private events (training, AGMs...). Visitors can't read private
-- events, so the door page said "Event Not Found" even with the right door code. This
-- returns just what that page shows, and only for a valid door code (or a club admin).
-- ==============================================================================

CREATE OR REPLACE FUNCTION door_checkin_event(p_event_id UUID, p_door_code TEXT)
RETURNS TABLE (
    id UUID,
    club_id UUID,
    title TEXT,
    category TEXT,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    location TEXT,
    door_qr_checkin_enabled BOOLEAN
) AS $$
    SELECT e.id, e.club_id, e.title::TEXT, e.category::TEXT, e.start_time, e.end_time, e.location::TEXT,
           COALESCE(e.door_qr_checkin_enabled, FALSE)
      FROM events e
     WHERE e.id = p_event_id
       AND door_checkin_allowed(e.id, e.club_id, p_door_code);
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION door_checkin_event(UUID, TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
