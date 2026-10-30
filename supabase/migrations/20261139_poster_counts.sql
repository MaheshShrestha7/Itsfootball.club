-- ==============================================================================
-- Migration: printed posters and flyers in sponsor results (OSE-9, 30 Oct 2026).
-- sponsor_analytics gains two event types, both written only by app/api/sponsors/qr with
-- the service role, one row per sponsor on that poster:
--   print  the club pressed Print on a check-in poster, the thank-you poster or a flyer
--   scan   someone scanned the QR on one of them (once per phone per poster every 30 minutes)
-- The sponsor's report shows them as counts. They are not views, so the "seen" figures ignore
-- them. Safe to run more than once.
-- ==============================================================================

DO $$
DECLARE
    c RECORD;
BEGIN
    -- The original CHECK was unnamed, so drop whichever check constraint limits event_type
    FOR c IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'sponsor_analytics'::regclass AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%event_type%'
    LOOP
        EXECUTE format('ALTER TABLE sponsor_analytics DROP CONSTRAINT %I', c.conname);
    END LOOP;
END $$;

ALTER TABLE sponsor_analytics ADD CONSTRAINT sponsor_analytics_event_type_check
    CHECK (event_type IN ('impression', 'viewable_impression', 'click', 'print', 'scan'));

CREATE INDEX IF NOT EXISTS idx_sponsor_analytics_sponsor_type ON sponsor_analytics (sponsor_id, event_type, created_at);

NOTIFY pgrst, 'reload schema';
