-- ==============================================================================
-- Migration: a logo size for each tournament sponsor
-- Date: 2026-11-28
--
-- On the public tournament page logos are sized by category: Platinum biggest, then Gold, Silver,
-- Bronze, and every other category small. logo_size lets the host give one sponsor another size
-- ('platinum', 'gold', 'silver', 'bronze' or 'small'); NULL means "same as its category".
-- Until this runs the Logo size choice stays hidden and every logo follows its category.
--
-- Safe to run more than once.
-- ==============================================================================

ALTER TABLE tournament_sponsors ADD COLUMN IF NOT EXISTS logo_size VARCHAR(10)
    CHECK (logo_size IS NULL OR logo_size IN ('platinum', 'gold', 'silver', 'bronze', 'small'));
