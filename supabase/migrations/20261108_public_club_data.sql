-- ==============================================================================
-- Migration: one-call club data for server-rendered pages
-- Date: 2026-11-08
--
--   * public_club_data(slug, club_ids, sources): reads every table and view in `sources` in one
--     database call and returns their rows as JSON, so a server-rendered page makes one request
--     instead of about 27 (lib/supabase/server-data.ts). The list of sources comes from the app
--     (ENTITIES in lib/supabase/sync.ts), so a table added there needs no change here.
--   * Same scoping as SupabaseSync.load: 'all' sources are read whole; 'club' sources only for the
--     club at `slug` (its current or an old slug) plus `club_ids`, with an optional extra filter
--     (e.g. live matches of any club); 'tournament' sources for those clubs' tournaments.
--   * SECURITY INVOKER: it runs with the caller's own rights, so row level security and grants
--     apply exactly as when the tables are read one by one. It can't show anything the caller
--     couldn't already read. A source that fails (e.g. no access) is reported in `errors` and the
--     rest still load, as before.
--
-- Safe to run more than once.
-- ==============================================================================

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
                        'SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), ''[]''::jsonb) FROM public.%I t WHERE %s',
                        v_name, v_where
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
