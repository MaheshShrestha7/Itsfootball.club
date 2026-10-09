-- ==============================================================================
-- Migration: grace period for fiscal-year renewals
-- Date: 2026-10-28
--
-- Fiscal-year clubs renewed everyone on the fiscal year start, so someone joining in late June
-- (July year) renewed a few days later. With a grace period of N days, joining (or renewing a
-- lapsed membership) within N days before the fiscal year starts runs to the start of the
-- following one: July year, 30 days -> joined 15 Jun 2026 renews 1 Jul 2027, not 1 Jul 2026.
-- Year-to-year clubs are unaffected. The same rule is membershipTermEnd() in lib/finance.ts.
--
-- Safe to run more than once.
-- ==============================================================================

ALTER TABLE clubs ADD COLUMN IF NOT EXISTS fiscal_grace_days SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE clubs DROP CONSTRAINT IF EXISTS clubs_fiscal_grace_days_check;
ALTER TABLE clubs ADD CONSTRAINT clubs_fiscal_grace_days_check CHECK (fiscal_grace_days BETWEEN 0 AND 183);

CREATE OR REPLACE FUNCTION membership_term_end(p_club_id UUID, p_from DATE, p_months INTEGER DEFAULT 12)
RETURNS DATE AS $$
    SELECT CASE
        WHEN c.membership_renewal = 'fiscal' THEN
            CASE WHEN f.next_start - p_from <= c.fiscal_grace_days
                 THEN (f.next_start + INTERVAL '1 year')::DATE
                 ELSE f.next_start
            END
        ELSE (p_from + make_interval(months => COALESCE(p_months, 12)))::DATE
    END
    FROM clubs c
    -- The first fiscal year start after p_from
    CROSS JOIN LATERAL (
        SELECT make_date(
            EXTRACT(YEAR FROM p_from)::INTEGER + CASE WHEN EXTRACT(MONTH FROM p_from) >= c.fiscal_year_start_month THEN 1 ELSE 0 END,
            c.fiscal_year_start_month, 1) AS next_start
    ) f
    WHERE c.id = p_club_id;
$$ LANGUAGE sql STABLE SET search_path = public;

-- The setter gains the grace period (a new signature, so the old one goes)
DROP FUNCTION IF EXISTS set_membership_renewal(UUID, TEXT, INTEGER);
CREATE OR REPLACE FUNCTION set_membership_renewal(
    p_club_id UUID, p_mode TEXT, p_fiscal_start_month INTEGER, p_grace_days INTEGER DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    IF NOT has_club_perm(p_club_id, '{finance}', 'edit') THEN
        RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
    END IF;
    UPDATE clubs
       SET membership_renewal = p_mode,
           fiscal_year_start_month = COALESCE(p_fiscal_start_month, fiscal_year_start_month),
           fiscal_grace_days = COALESCE(p_grace_days, fiscal_grace_days)
     WHERE id = p_club_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
GRANT EXECUTE ON FUNCTION set_membership_renewal(UUID, TEXT, INTEGER, INTEGER) TO authenticated;

-- Only that function (or a super user) changes the renewal columns
CREATE OR REPLACE FUNCTION keep_club_admin_fields()
RETURNS TRIGGER AS $$
BEGIN
    IF current_user = 'authenticated' AND NOT is_club_admin(OLD.id) THEN
        NEW.slug := OLD.slug;
        NEW.previous_slugs := OLD.previous_slugs;
        NEW.custom_domain := OLD.custom_domain;
        NEW.is_active := OLD.is_active;
        NEW.email_settings := OLD.email_settings;
        -- Set through set_membership_renewal() (Finance edit)
        NEW.membership_renewal := OLD.membership_renewal;
        NEW.fiscal_year_start_month := OLD.fiscal_year_start_month;
        NEW.fiscal_grace_days := OLD.fiscal_grace_days;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

NOTIFY pgrst, 'reload schema';
