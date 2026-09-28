-- ==============================================================================
-- Migration: email (Resend) - reminder log, per-club switches, unsubscribes
-- Date: 2026-10-14
--
-- email_log        one row per club email sent (reminders and admin notices). Each is claimed
--                  here before sending (key names it, e.g. "availability:<availability id>"), so
--                  it goes out at most once even if a job runs twice.
-- email_opt_outs   addresses that unsubscribed from a club's emails (sign-in links still go).
-- clubs.email_settings
--                  which automatic reminders the club has switched on, e.g.
--                  {"availability_reminders": true}. A missing key means off.
--
-- Only the service role (server routes) reads or writes these: RLS on, no policies.
-- email_settings is not in the client sync's column list (lib/supabase/columns.ts), so the
-- admin app never overwrites it; it's changed through /api/admin/emails.
--
-- Safe to run more than once.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS email_log (
    key TEXT PRIMARY KEY,
    club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
    recipient VARCHAR(255) NOT NULL,
    kind VARCHAR(32),          -- availability | event | renewal | notice_match | notice_event | notice_news | notice_renewal
    ref_id TEXT,               -- the match / event / article / membership term it was about
    subject TEXT,
    sent_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE email_log ADD COLUMN IF NOT EXISTS kind VARCHAR(32);
ALTER TABLE email_log ADD COLUMN IF NOT EXISTS ref_id TEXT;
ALTER TABLE email_log ADD COLUMN IF NOT EXISTS subject TEXT;

CREATE INDEX IF NOT EXISTS idx_email_log_club ON email_log (club_id, sent_at DESC);
ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS email_opt_outs (
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,   -- stored lower-cased
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (club_id, email)
);
ALTER TABLE email_opt_outs ENABLE ROW LEVEL SECURITY;

ALTER TABLE clubs ADD COLUMN IF NOT EXISTS email_settings JSONB NOT NULL DEFAULT '{}'::jsonb;
