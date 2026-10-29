-- ==============================================================================
-- Migration: the sponsor link's secret is server-only (sponsors review, 30 Oct 2026)
--
--   sponsors.access_key opens a sponsor's own page, their invoices and their payment links. Staff
--   who could only view Sponsors (a media role, say) could read it from the browser and act as the
--   sponsor. Now the browser can read every sponsors column except access_key. Club admins who can
--   edit Sponsors get the link (or a new one, which stops the old link working) from
--   /api/sponsors/page-link, which reads it with the service role.
--
--   public_club_data (20261108) reads each source as to_jsonb of the whole row, which the browser
--   roles can no longer do for sponsors. A source can now name its `columns` (lib/supabase/sync.ts
--   sends the sponsors list), and only those are read. Otherwise the function is unchanged.
--
-- Same pattern as club_payment_settings (20261116_data_safety_2.sql). A later migration that adds a
-- sponsors column must also GRANT SELECT (that_column) ON sponsors TO anon, authenticated, and list
-- it in the sponsors entry of lib/supabase/sync.ts.
-- Run after 20261137_sponsor_pain_points.sql. Safe to run more than once.
-- ==============================================================================

DO $$
DECLARE
    v_columns TEXT;
BEGIN
    SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position) INTO v_columns
      FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'sponsors' AND column_name <> 'access_key';
    REVOKE SELECT ON sponsors FROM anon, authenticated;
    EXECUTE format('GRANT SELECT (%s) ON sponsors TO anon, authenticated', v_columns);
END $$;

-- Same as 20261108, plus a source's optional `columns`
CREATE OR REPLACE FUNCTION public_club_data(p_slug TEXT, p_club_ids UUID[], p_sources JSONB)
RETURNS JSONB AS $$
DECLARE
    v_out JSONB := '{}'::jsonb;
    v_errors JSONB := '[]'::jsonb;
    v_ids UUID[];
    v_tournament_ids UUID[];
    v_phase TEXT;
    v_src JSONB;
    v_name TEXT;
    v_scope TEXT;
    v_or_column TEXT;
    v_or_values TEXT[];
    v_where TEXT;
    v_rows JSONB;
    v_columns TEXT;
BEGIN
    IF p_sources IS NULL OR jsonb_typeof(p_sources) <> 'array' OR jsonb_array_length(p_sources) > 64 THEN
        RAISE EXCEPTION 'p_sources must be an array of at most 64 sources';
    END IF;

    FOREACH v_phase IN ARRAY ARRAY['all', 'club', 'tournament'] LOOP
        IF v_phase = 'club' THEN
            -- The club named in the URL, found among the clubs just read (as SupabaseSync.load does)
            SELECT COALESCE(array_agg(DISTINCT x.id), '{}') INTO v_ids
              FROM (
                SELECT unnest(COALESCE(p_club_ids, '{}')) AS id
                UNION
                SELECT (c->>'id')::uuid
                  FROM jsonb_array_elements(COALESCE(v_out->'clubs', '[]'::jsonb)) c
                 WHERE COALESCE(p_slug, '') <> ''
                   AND (lower(c->>'slug') = lower(p_slug)
                        OR (jsonb_typeof(c->'previous_slugs') = 'array'
                            AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(c->'previous_slugs') p
                                         WHERE lower(p) = lower(p_slug))))
              ) x;
        ELSIF v_phase = 'tournament' THEN
            SELECT COALESCE(array_agg((t->>'id')::uuid), '{}') INTO v_tournament_ids
              FROM jsonb_array_elements(COALESCE(v_out->'tournaments', '[]'::jsonb)) t;
        END IF;

        FOR v_src IN SELECT * FROM jsonb_array_elements(p_sources) LOOP
            v_scope := COALESCE(v_src->>'scope', 'club');
            CONTINUE WHEN v_scope <> v_phase;
            v_name := v_src->>'name';
            v_or_column := v_src->'or_in'->>'column';
            v_or_values := ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_src->'or_in'->'values', '[]'::jsonb)));
            -- The columns to read, when the caller can't read them all (sponsors: not access_key)
            v_columns := (SELECT string_agg(format('%I', c), ', ')
                            FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(v_src->'columns') = 'array'
                                                                THEN v_src->'columns' ELSE '[]'::jsonb END) c);
            BEGIN
                -- Only tables and views of this schema, read with the caller's rights
                IF v_name IS NULL OR to_regclass(format('public.%I', v_name)) IS NULL THEN
                    RAISE EXCEPTION 'unknown source';
                END IF;

                v_where := CASE v_scope
                    WHEN 'all' THEN 'TRUE'
                    WHEN 'tournament' THEN 't.tournament_id = ANY($1)'
                    ELSE 't.club_id = ANY($1)'
                END;
                IF v_or_column IS NOT NULL THEN
                    v_where := format('(%s OR t.%I::text = ANY($2))', v_where, v_or_column);
                END IF;

                IF v_scope <> 'all' AND v_or_column IS NULL
                   AND cardinality(CASE WHEN v_scope = 'tournament' THEN v_tournament_ids ELSE v_ids END) = 0 THEN
                    v_rows := '[]'::jsonb; -- nothing in scope: no query, as SupabaseSync.load
                ELSE
                    EXECUTE format(
                        'SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), ''[]''::jsonb) FROM (SELECT %s FROM public.%I) t WHERE %s',
                        COALESCE(v_columns, '*'), v_name, v_where
                    )
                    INTO v_rows
                    USING CASE WHEN v_scope = 'tournament' THEN v_tournament_ids ELSE v_ids END, v_or_values;
                END IF;
                v_out := v_out || jsonb_build_object(v_name, v_rows);
            EXCEPTION WHEN OTHERS THEN
                v_errors := v_errors || to_jsonb(format('%s: %s', v_name, SQLERRM));
            END;
        END LOOP;
    END LOOP;

    RETURN jsonb_build_object('sources', v_out, 'errors', v_errors, 'club_ids', to_jsonb(COALESCE(v_ids, '{}')));
END;
$$ LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public;

REVOKE ALL ON FUNCTION public_club_data(TEXT, UUID[], JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public_club_data(TEXT, UUID[], JSONB) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
