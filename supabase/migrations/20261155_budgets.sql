-- ==============================================================================
-- Migration: club budgets, one amount per season and category
-- Date: 2026-11-07
--
-- Only the plan is stored. Actuals always come from the ledger, so they can't drift from Finance. Category
-- keys match lib/finance.ts (INCOME_CATEGORIES and EXPENSE_CATEGORIES). A category with no row has no budget.
-- Written with the person's own session: Finance view to read, Finance edit to change.
-- The app works before this migration: the Budget page says the database needs updating.
-- Safe to run more than once.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    season VARCHAR(32) NOT NULL CHECK (length(trim(season)) > 0),
    kind VARCHAR(8) NOT NULL CHECK (kind IN ('income', 'expense')),
    category VARCHAR(48) NOT NULL,
    amount_cents BIGINT NOT NULL CHECK (amount_cents >= 0 AND amount_cents <= 100000000000),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (club_id, season, kind, category)
);

ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Finance read budgets" ON budgets;
CREATE POLICY "Finance read budgets" ON budgets FOR SELECT TO authenticated
    USING (has_club_perm(club_id, '{finance}', 'view'));
DROP POLICY IF EXISTS "Finance add budgets" ON budgets;
CREATE POLICY "Finance add budgets" ON budgets FOR INSERT TO authenticated
    WITH CHECK (has_club_perm(club_id, '{finance}', 'edit'));
DROP POLICY IF EXISTS "Finance change budgets" ON budgets;
CREATE POLICY "Finance change budgets" ON budgets FOR UPDATE TO authenticated
    USING (has_club_perm(club_id, '{finance}', 'edit')) WITH CHECK (has_club_perm(club_id, '{finance}', 'edit'));
DROP POLICY IF EXISTS "Finance remove budgets" ON budgets;
CREATE POLICY "Finance remove budgets" ON budgets FOR DELETE TO authenticated
    USING (has_club_perm(club_id, '{finance}', 'edit'));

REVOKE ALL ON budgets FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON budgets TO authenticated;

NOTIFY pgrst, 'reload schema';
