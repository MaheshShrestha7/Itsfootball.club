-- ==============================================================================
-- Migration: web push - browsers/phones following a club's notifications
-- Date: 2026-10-16
--
-- push_subscriptions  one row per (browser push endpoint, club). A browser has one endpoint per
--                     site, so following two clubs on itsfootball.club is two rows with the same
--                     endpoint. Anonymous: fans follow without an account.
--
-- Only the service role (/api/push and the notice sender) reads or writes it: RLS on, no policies.
-- Safe to run more than once.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
    endpoint TEXT NOT NULL,
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (endpoint, club_id)
);
CREATE INDEX IF NOT EXISTS push_subscriptions_club_idx ON push_subscriptions (club_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON push_subscriptions FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
