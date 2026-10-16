-- ==============================================================================
-- Migration: grounds directory, phase 2
-- Date: 2026-11-10
--
--   * matches.ground_id / matches.pitch_label: a fixture can name a ground from the directory and
--     the pitch it is on. Optional; matches.venue (free text) stays as it is and is still what
--     every screen shows. Set from the match form's ground picker (lib/supabase/columns.ts), which
--     only appears once this migration has run.
--   * ground_suggestions: "Suggest an edit" from a public ground guide. Written only by the server
--     (/api/grounds/suggest, service role); the steward club's staff read and close them from
--     Admin -> Branding -> Public Ground Guide.
--
-- Needs 20261109_grounds.sql first. Safe to run more than once.
-- ==============================================================================

ALTER TABLE matches ADD COLUMN IF NOT EXISTS ground_id UUID REFERENCES grounds(id) ON DELETE SET NULL;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS pitch_label VARCHAR(40);
CREATE INDEX IF NOT EXISTS idx_matches_ground ON matches (ground_id) WHERE ground_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS ground_suggestions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ground_id UUID NOT NULL REFERENCES grounds(id) ON DELETE CASCADE,
    topic VARCHAR(32) NOT NULL DEFAULT 'other'
        CHECK (topic IN ('parking', 'pitches', 'toilets', 'canteen', 'accessibility', 'address', 'council', 'other')),
    message VARCHAR(1000) NOT NULL CHECK (length(trim(message)) >= 5),
    contact VARCHAR(200),
    status VARCHAR(16) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'dismissed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ground_suggestions_open ON ground_suggestions (ground_id, created_at DESC) WHERE status = 'open';

ALTER TABLE ground_suggestions ENABLE ROW LEVEL SECURITY;

-- Staff of the club that looks after the ground can read and close its suggestions
DROP POLICY IF EXISTS "Steward suggestions read" ON ground_suggestions;
CREATE POLICY "Steward suggestions read" ON ground_suggestions FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM grounds g
        WHERE g.id = ground_suggestions.ground_id
          AND g.steward_club_id IS NOT NULL
          AND has_club_perm(g.steward_club_id, ARRAY['branding'], 'view')
    ));

DROP POLICY IF EXISTS "Steward suggestions update" ON ground_suggestions;
CREATE POLICY "Steward suggestions update" ON ground_suggestions FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM grounds g
        WHERE g.id = ground_suggestions.ground_id
          AND g.steward_club_id IS NOT NULL
          AND has_club_perm(g.steward_club_id, ARRAY['branding'], 'edit')
    ));

-- No INSERT policy: suggestions come in only through the server route (rate limited, honeypot)
GRANT SELECT, UPDATE ON ground_suggestions TO authenticated;
