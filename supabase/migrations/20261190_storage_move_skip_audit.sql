-- ==============================================================================
-- Migration: "Move images to R2" leaves the audit log alone
--
-- The switch writes an admin_audit_log row whose details hold the old link starts, so the
-- card kept showing "2 in 2 places" after a successful switch. The audit log is history and
-- should never be rewritten, so storage_move_columns() now skips it.
-- Safe to run more than once.
-- ==============================================================================

CREATE OR REPLACE FUNCTION storage_move_columns()
RETURNS TABLE (tbl TEXT, col TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.table_name::TEXT, c.column_name::TEXT
  FROM information_schema.columns c
  JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
  WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
    AND c.table_name <> 'admin_audit_log'
    AND (c.data_type IN ('text', 'character varying', 'jsonb') OR (c.data_type = 'ARRAY' AND c.udt_name = '_text'))
    AND c.is_generated = 'NEVER'
  ORDER BY 1, 2;
$$;

REVOKE ALL ON FUNCTION storage_move_columns() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION storage_move_columns() TO service_role;
