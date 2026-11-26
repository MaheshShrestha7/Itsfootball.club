-- ==============================================================================
-- Migration: move existing uploads from Supabase Storage to Cloudflare R2
-- (Mission Control -> System health -> "Move images to R2", /api/platform/storage-move)
--
--   * storage_move_files(bucket, after, lim): a page of the files in a Supabase Storage bucket,
--     by name, with their size and type, so the server can copy them to R2.
--   * storage_move_columns(): every text, text[] and jsonb column of the app's tables, where a
--     saved link could sit (logos, photos, news text with images, JSON settings).
--   * storage_move_links(old, new, dry): counts (dry) or replaces the link start `old` with `new`
--     in every one of those columns, in one transaction (all switch or none), and returns the
--     rows found per column.
--
-- Only the server (service role) can run these. Safe to run more than once.
-- ==============================================================================

CREATE OR REPLACE FUNCTION storage_move_files(p_bucket TEXT, p_after TEXT, p_limit INT)
RETURNS TABLE (name TEXT, size BIGINT, mimetype TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = storage, public AS $$
  SELECT o.name, COALESCE((o.metadata->>'size')::BIGINT, 0), COALESCE(o.metadata->>'mimetype', 'application/octet-stream')
  FROM storage.objects o
  WHERE o.bucket_id = p_bucket AND o.name COLLATE "C" > COALESCE(p_after, '') COLLATE "C"
    AND o.name NOT LIKE '%/.emptyFolderPlaceholder'
  ORDER BY o.name COLLATE "C"
  LIMIT LEAST(GREATEST(p_limit, 1), 1000);
$$;

CREATE OR REPLACE FUNCTION storage_move_columns()
RETURNS TABLE (tbl TEXT, col TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.table_name::TEXT, c.column_name::TEXT
  FROM information_schema.columns c
  JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
  WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
    AND (c.data_type IN ('text', 'character varying', 'jsonb') OR (c.data_type = 'ARRAY' AND c.udt_name = '_text'))
    AND c.is_generated = 'NEVER'
  ORDER BY 1, 2;
$$;

CREATE OR REPLACE FUNCTION storage_move_links(p_old TEXT, p_new TEXT, p_dry BOOLEAN)
RETURNS TABLE (tbl TEXT, col TEXT, rows_found BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r RECORD;
  v_count BIGINT;
BEGIN
  IF COALESCE(p_old, '') = '' OR length(p_old) < 20 THEN RAISE EXCEPTION 'Link prefix too short'; END IF;
  -- One statement per column, all in this call's transaction: every link switches, or none does.
  -- Names come from information_schema and are quoted with %I, never pasted in.
  FOR r IN
    SELECT s.tbl, s.col, CASE WHEN c.data_type = 'ARRAY' THEN 'text[]' WHEN c.data_type = 'jsonb' THEN 'jsonb' ELSE 'text' END AS typ
    FROM storage_move_columns() s
    JOIN information_schema.columns c ON c.table_schema = 'public' AND c.table_name = s.tbl AND c.column_name = s.col
  LOOP
    IF p_dry THEN
      EXECUTE format('SELECT count(*) FROM %I WHERE strpos(%I::text, $1) > 0', r.tbl, r.col) INTO v_count USING p_old;
    ELSE
      EXECUTE format('UPDATE %I SET %I = replace(%I::text, $1, $2)::%s WHERE strpos(%I::text, $1) > 0',
                     r.tbl, r.col, r.col, r.typ, r.col) USING p_old, p_new;
      GET DIAGNOSTICS v_count = ROW_COUNT;
    END IF;
    IF v_count > 0 THEN tbl := r.tbl; col := r.col; rows_found := v_count; RETURN NEXT; END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION storage_move_files(TEXT, TEXT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION storage_move_columns() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION storage_move_links(TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION storage_move_files(TEXT, TEXT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION storage_move_columns() TO service_role;
GRANT EXECUTE ON FUNCTION storage_move_links(TEXT, TEXT, BOOLEAN) TO service_role;
