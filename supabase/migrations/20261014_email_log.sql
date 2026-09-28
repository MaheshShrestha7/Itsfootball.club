-- ==============================================================================
-- Migration: email log for reminder emails
-- Date: 2026-10-14
--
-- /api/cron/reminders claims a row here before each reminder it sends (the key names the
-- reminder, e.g. "availability:<availability id>"), so a reminder goes out at most once even
-- if the job runs twice. Only the service role touches it: RLS on, no policies.
--
-- Safe to run more than once.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS email_log (
    key TEXT PRIMARY KEY,
    club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
    recipient VARCHAR(255) NOT NULL,
    resend_id TEXT,
    sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_log_club ON email_log (club_id, sent_at DESC);

ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;
