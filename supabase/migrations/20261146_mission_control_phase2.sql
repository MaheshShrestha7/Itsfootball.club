-- ==============================================================================
-- Migration: Mission Control phase 2 (support inbox, account fixes)
--
--   1. support_requests / support_replies: messages club admins send from "Contact
--      itsfootball.club" (and owners stuck deleting their account), answered from Mission
--      Control. Written by the server (service role); platform admins read them, Operators and
--      Super admins change their status.
--   2. platform_sign_out_user(): ends every session of an account (lost phone, shared device,
--      blocked account). Sessions live in auth.sessions, which the admin API can't clear by user.
--
-- Run after 20261145. Safe to run again.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS support_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID REFERENCES clubs(id) ON DELETE SET NULL,
    user_id UUID,
    from_email TEXT NOT NULL,
    from_name TEXT,
    topic TEXT NOT NULL,
    message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 4000),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'waiting', 'done')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_support_requests_status ON support_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_requests_club ON support_requests (club_id, created_at DESC);
ALTER TABLE support_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS support_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES support_requests(id) ON DELETE CASCADE,
    body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
    author_email TEXT,
    emailed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_support_replies_request ON support_replies (request_id, created_at);
ALTER TABLE support_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins read support" ON support_requests;
DROP POLICY IF EXISTS "Platform operators update support" ON support_requests;
DROP POLICY IF EXISTS "Platform admins read support replies" ON support_replies;
CREATE POLICY "Platform admins read support" ON support_requests FOR SELECT USING (is_platform_admin());
CREATE POLICY "Platform operators update support" ON support_requests FOR UPDATE
    USING (is_platform_operator()) WITH CHECK (is_platform_operator());
CREATE POLICY "Platform admins read support replies" ON support_replies FOR SELECT USING (is_platform_admin());
-- No insert policies: only the server (service role) adds requests and replies

-- ------------------------------------------------------------------------------
-- End every session of an account. Returns how many were ended. Access tokens already handed
-- out keep working until they expire (an hour at most); they can't be refreshed.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION platform_sign_out_user(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    IF NOT is_platform_operator() THEN
        RAISE EXCEPTION 'Analysts can view accounts but not change them.' USING ERRCODE = '42501';
    END IF;
    DELETE FROM auth.sessions WHERE user_id = p_user_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION platform_sign_out_user(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION platform_sign_out_user(UUID) TO authenticated;
