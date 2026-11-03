-- ==============================================================================
-- Migration: Mission Control phase 3 (real system health)
--
-- platform_events: one row per thing the Health tab and its alerts need to know about.
--   kind 'cron'    a scheduled job ran (name = reminders | indexnow | health); detail = its report
--   kind 'email'   an email failed to send (name = 'send'); detail = recipients, subject, error
--   kind 'stripe'  a Stripe webhook arrived (name = event type); ok = handled
--   kind 'alert'   Mission Control emailed the platform admins about a red signal (name = signal)
-- Written only by the server (service role); platform admins read it. The hourly health job
-- deletes rows older than 60 days.
--
-- Run after 20261146. Safe to run again.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS platform_events (
    id BIGSERIAL PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('cron', 'email', 'stripe', 'alert')),
    name TEXT NOT NULL,
    ok BOOLEAN NOT NULL,
    detail JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_platform_events_kind ON platform_events (kind, name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_events_time ON platform_events (created_at);
ALTER TABLE platform_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins read events" ON platform_events;
CREATE POLICY "Platform admins read events" ON platform_events FOR SELECT USING (is_platform_admin());
