-- ==============================================================================
-- Migration: a page for each sponsor (SP-F1, SP-F3, SP-F4 from the 28 Oct 2026 sponsors review)
--
--   sponsors.pending_logo_url / pending_website_url / pending_sent_at
--       A logo or website the sponsor sent from their own page (/{club}/sponsor/yours?k=...).
--       Nothing changes on the site until an admin taps "Use it" on the Sponsors page.
--   club_payment_settings.abn / gst_registered
--       Printed on sponsorship invoices. GST-registered clubs issue a "Tax invoice" showing the
--       GST included (1/11th of the price); other clubs issue an "Invoice" with no GST.
--   payments.invoice_number + assign_invoice_number()
--       Invoice numbers run 1, 2, 3... per club, given out the first time an invoice is opened.
--       Only the server (service role) gives them out.
--
-- The sponsor page itself is read by the server with the sponsor's access_key (20261132), never
-- by the browser, so no new read policies are needed. Run after 20261132_sponsor_renewals.sql.
-- Safe to run more than once.
-- ==============================================================================

ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS pending_logo_url TEXT;
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS pending_website_url TEXT;
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS pending_sent_at TIMESTAMPTZ;
-- The sponsor's page finds them by their link's secret
CREATE UNIQUE INDEX IF NOT EXISTS idx_sponsors_access_key ON sponsors (access_key);

ALTER TABLE club_payment_settings ADD COLUMN IF NOT EXISTS abn VARCHAR(14);
ALTER TABLE club_payment_settings ADD COLUMN IF NOT EXISTS gst_registered BOOLEAN NOT NULL DEFAULT FALSE;

-- club_payment_settings is read and written through column grants (20261010_finance.sql,
-- 20261116_data_safety_2.sql). An ABN is public information, printed on every invoice.
GRANT SELECT (abn, gst_registered) ON club_payment_settings TO anon, authenticated;
GRANT INSERT (abn, gst_registered), UPDATE (abn, gst_registered) ON club_payment_settings TO authenticated;

ALTER TABLE payments ADD COLUMN IF NOT EXISTS invoice_number INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_club_invoice_number
    ON payments (club_id, invoice_number) WHERE invoice_number IS NOT NULL;

-- The payment's invoice number, giving it the club's next one if it has none yet
CREATE OR REPLACE FUNCTION assign_invoice_number(p_payment_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_club UUID;
    v_number INTEGER;
BEGIN
    SELECT club_id, invoice_number INTO v_club, v_number FROM payments WHERE id = p_payment_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment not found';
    END IF;
    IF v_number IS NOT NULL THEN
        RETURN v_number;
    END IF;
    -- One number at a time per club, so two invoices opened together never get the same one
    PERFORM pg_advisory_xact_lock(hashtext('invoice:' || v_club::text));
    SELECT invoice_number INTO v_number FROM payments WHERE id = p_payment_id FOR UPDATE;
    IF v_number IS NOT NULL THEN
        RETURN v_number;
    END IF;
    SELECT COALESCE(MAX(invoice_number), 0) + 1 INTO v_number FROM payments WHERE club_id = v_club;
    UPDATE payments SET invoice_number = v_number WHERE id = p_payment_id;
    RETURN v_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION assign_invoice_number(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION assign_invoice_number(UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
