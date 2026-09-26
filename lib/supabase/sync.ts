// ==============================================================================
// Supabase <-> app state synchronisation
//
// The UI keeps working against in-memory arrays (see lib/club-context.tsx). This module is
// what makes Supabase the source of truth for them:
//   * load()  reads the synced tables for the clubs in scope and returns app-shaped objects
//   * flush() diffs the current arrays against what was last known to be in the database and
//             writes only the changed columns; rows are deleted only when explicitly asked to
// ==============================================================================
import type { SupabaseClient } from '@supabase/supabase-js';
import { TABLE_COLUMNS } from './columns';
import { isUuid, stableId } from '../ids';

type Row = Record<string, any>;

export type EntityKey =
  | 'clubs'
  | 'members'
  | 'seasons'
  | 'internalTeams'
  | 'tournaments'
  | 'tournamentParticipants'
  | 'playerStats'
  | 'matches'
  | 'matchEvents'
  | 'events'
  | 'sponsors'
  | 'news'
  | 'gallery'
  | 'clubScoreRules'
  | 'clubScoreProfiles'
  | 'activityLogs'
  | 'availabilities'
  | 'draftLineups'
  | 'memberMessages'
  | 'gateScans'
  | 'inquiries';

// clubScoreRules is a { [clubId]: config } record; every other key is an array
export type SyncState = Record<EntityKey, any>;

/** Which rows load() reads: every row, rows of the clubs in scope, or rows of the tournaments in scope */
type Scope = 'all' | 'club' | 'tournament';

interface EntityConfig {
  key: EntityKey;
  table: string;
  /** Defaults to 'club' */
  scope?: Scope;
  /** PostgREST filter for rows loaded even outside the scope (e.g. live matches for the club directory) */
  alsoLoad?: string;
  /** Extra read-only sources merged into the table's rows (e.g. a public-safe view) */
  extraReadSources?: string[];
  fromRow?: (row: Row) => Row;
  /** Adjusts an app object just before it is written */
  prepare?: (obj: Row) => Row;
  /** Columns the app clears by leaving them undefined: written as NULL so the database clears too */
  clearable?: string[];
}

// Parents first: this is also the upsert order (deletes run in reverse).
const ENTITIES: EntityConfig[] = [
  { key: 'clubs', table: 'clubs', scope: 'all', fromRow: clubFromRow, prepare: clubPrepare },
  { key: 'members', table: 'club_members', extraReadSources: ['club_members_public'], fromRow: memberFromRow },
  { key: 'seasons', table: 'club_seasons' },
  { key: 'internalTeams', table: 'internal_teams' },
  { key: 'tournaments', table: 'tournaments', clearable: ['end_date', 'group_count', 'teams_advancing_per_group'] },
  { key: 'tournamentParticipants', table: 'tournament_participants', scope: 'tournament', clearable: ['seed', 'group'] },
  { key: 'playerStats', table: 'player_stats' },
  {
    key: 'matches',
    table: 'matches',
    alsoLoad: 'status.in.(live,halftime)',
    clearable: ['winner_side', 'home_penalty_score', 'away_penalty_score', 'next_match_id', 'next_match_slot', 'tournament_group', 'home_team_source', 'away_team_source'],
  },
  { key: 'matchEvents', table: 'match_events' },
  { key: 'events', table: 'events' },
  // The platform home page shows every club's sponsors
  { key: 'sponsors', table: 'sponsors', scope: 'all', extraReadSources: ['sponsors_public'] },
  { key: 'news', table: 'news_articles' },
  { key: 'gallery', table: 'media_gallery' },
  { key: 'clubScoreRules', table: 'clubscore_rules' },
  { key: 'clubScoreProfiles', table: 'member_clubscore_profiles' },
  { key: 'activityLogs', table: 'gamification_activity_log' },
  { key: 'availabilities', table: 'player_availabilities', extraReadSources: ['player_availabilities_public'] },
  { key: 'draftLineups', table: 'draft_lineups' },
  { key: 'memberMessages', table: 'member_messages' },
  { key: 'gateScans', table: 'gate_scans' },
  { key: 'inquiries', table: 'contact_inquiries' },
];

export const SYNC_ENTITY_KEYS = ENTITIES.map(e => e.key);

const PAGE_SIZE = 1000;
// Columns that hold dates / uuids / coordinates: an empty string from a form must become NULL
const EMPTY_TO_NULL = /(_at|_date|_id|date_of_birth|_lat|_lng|^custom_domain)$/;
// A row that points at a parent we can't resolve is skipped rather than sent with a NULL
const REQUIRED_FKS = ['club_id', 'member_id', 'tournament_id', 'match_id'];

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------
function stripNulls(row: Row): Row {
  const out: Row = {};
  for (const k of Object.keys(row)) {
    if (row[k] !== null) out[k] = row[k];
  }
  return out;
}

function clubFromRow(r: Row): Row {
  // Older `clubs` rows keep theme / contact details inside a `config` JSON blob.
  const theme = r.config?.theme ?? {};
  const contact = r.config?.contact ?? {};
  return {
    ...r,
    motto: r.motto ?? r.config?.identity?.motto ?? '',
    primary_color: r.primary_color ?? theme.primaryColor ?? '#10B981',
    secondary_color: r.secondary_color ?? theme.secondaryColor ?? '#0F172A',
    accent_color: r.accent_color ?? theme.accentColor ?? '#F59E0B',
    founded_year: r.founded_year ?? (r.created_at ? new Date(r.created_at).getFullYear() : new Date().getFullYear()),
    banner_url: r.banner_url ?? '',
    logo_url: r.logo_url ?? '',
    stadium_name: r.stadium_name ?? '',
    stadium_address: r.stadium_address ?? contact.address ?? '',
    stadium_capacity: r.stadium_capacity ?? 0,
    stadium_pitch_type: r.stadium_pitch_type ?? '',
    stadium_parking_info: r.stadium_parking_info ?? '',
    contact_email: r.contact_email ?? contact.email ?? '',
    contact_phone: r.contact_phone ?? contact.phone ?? '',
    slider_images: r.slider_images ?? [],
    hero_pinned_items: r.hero_pinned_items ?? [],
    previous_slugs: r.previous_slugs ?? [],
  };
}

/** Keeps the legacy `config` JSON (used by the older site) in step with the real columns */
function clubPrepare(o: Row): Row {
  const base = o.config && typeof o.config === 'object' ? o.config : {};
  return {
    ...o,
    config: {
      ...base,
      theme: { ...base.theme, primaryColor: o.primary_color, secondaryColor: o.secondary_color, accentColor: o.accent_color },
      contact: { ...base.contact, email: o.contact_email, phone: o.contact_phone, address: o.stadium_address },
      identity: { ...base.identity, clubName: o.name, shortName: o.short_name, motto: o.motto, logoUrl: o.logo_url },
    },
  };
}

// Stock photo older builds saved for every player added without one (every player looked identical)
const PLACEHOLDER_PHOTO = /^https:\/\/images\.unsplash\.com\/photo-1534528741775-53994a69daeb/;

/** A real photo URL, or undefined for none/the old stock placeholder (avatars then show initials) */
export function cleanPhotoUrl(url: unknown): string | undefined {
  return typeof url === 'string' && url && !PLACEHOLDER_PHOTO.test(url) ? url : undefined;
}

/** A photo shared by several members of the same club is a placeholder, not anyone's picture.
 *  photo_url is set to an explicit undefined (not deleted) so it also overrides a cached copy
 *  when fresh rows are merged over the locally stored ones. */
export function dropSharedPhotos<T extends { club_id?: string; photo_url?: string }>(members: T[]): T[] {
  const key = (m: T) => `${m.club_id}|${m.photo_url}`;
  const counts = new Map<string, number>();
  for (const m of members) if (m.photo_url) counts.set(key(m), (counts.get(key(m)) || 0) + 1);
  return members.map(m => ({
    ...m,
    photo_url: m.photo_url && (counts.get(key(m)) || 0) < 2 ? cleanPhotoUrl(m.photo_url) : undefined,
  }));
}

function memberFromRow(r: Row): Row {
  const name = r.full_name ?? [r.first_name, r.last_name].filter(Boolean).join(' ');
  return {
    ...r,
    photo_url: cleanPhotoUrl(r.photo_url),
    full_name: name || 'Member',
    // Hidden from the public view; only club admins receive these
    email: r.email ?? '',
    qr_code_token: r.qr_code_token ?? '',
    role: r.role ?? 'member',
    membership_status: r.membership_status ?? 'approved',
  };
}

function toRow(cfg: EntityConfig, source: Row): Row | null {
  const columns = TABLE_COLUMNS[cfg.table];
  if (!columns) return null;

  const obj = cfg.prepare ? cfg.prepare(source) : source;
  const row: Row = {};
  for (const col of columns) {
    let value = obj[col];
    if (value === undefined && cfg.clearable?.includes(col)) value = null;
    if (value === undefined) continue;
    if (value === '' && EMPTY_TO_NULL.test(col)) value = null;
    row[col] = value;
  }

  if (!isUuid(row.id)) return null;

  for (const key of Object.keys(row)) {
    if (!key.endsWith('_id') || row[key] == null || isUuid(row[key])) continue;
    if (REQUIRED_FKS.includes(key)) return null;
    row[key] = null;
  }
  return row;
}

function hashRow(row: Row): string {
  return JSON.stringify(Object.keys(row).sort().map(k => [k, row[k]]));
}

/** Columns of `row` whose value differs from `base` (the copy last seen in the database) */
export function changedColumns(row: Row, base: Row): Row | null {
  const patch: Row = {};
  for (const k of Object.keys(row)) {
    if (k !== 'id' && JSON.stringify(row[k]) !== JSON.stringify(base[k])) patch[k] = row[k];
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

/** Narrows a query to the scope; null when nothing is in scope (the table then loads as empty) */
function scopeFilter(cfg: EntityConfig, clubIds: string[], tournamentIds: string[]): ((q: any) => any) | null {
  const scope = cfg.scope ?? 'club';
  if (scope === 'all') return q => q;
  const column = scope === 'tournament' ? 'tournament_id' : 'club_id';
  const ids = scope === 'tournament' ? tournamentIds : clubIds;
  const alsoLoad = cfg.alsoLoad;
  if (alsoLoad) return q => q.or(ids.length ? `${column}.in.(${ids.join(',')}),${alsoLoad}` : alsoLoad);
  return ids.length ? q => q.in(column, ids) : null;
}

/** clubScoreRules is a { [clubId]: config } record in app state but one row per club in the table */
function rulesToArray(rules: unknown): Row[] {
  if (Array.isArray(rules)) return rules;
  return Object.values((rules as Record<string, Row>) || {}).map(cfg => ({
    ...cfg,
    id: cfg.id || stableId(`clubscore-rules-${cfg.club_id}`),
  }));
}

function stateRows(cfg: EntityConfig, state: Partial<SyncState>): Row[] {
  const raw = state[cfg.key] as any;
  return cfg.key === 'clubScoreRules' ? rulesToArray(raw) : (raw as Row[]) || [];
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------
export interface FlushResult {
  wrote: number;
  deleted: number;
  /** Ids whose delete went through (the caller stops queueing them) */
  deletedIds: string[];
  /** Changed rows that couldn't be saved because nobody is signed in */
  pendingReadonly: number;
  errors: string[];
}

export interface LoadScope {
  /** Club named in the page URL (slug or old slug), resolved against the clubs table */
  slug?: string;
  /** Clubs the signed-in user owns or belongs to */
  clubIds: string[];
}

export interface LoadResult {
  data: Partial<SyncState>;
  errors: string[];
  /** Club ids the scoped tables were loaded for */
  clubIds: string[];
}

export class SupabaseSync {
  /** table -> id -> the row as last seen in / written to the database */
  private synced = new Map<string, Map<string, Row>>();
  /** table -> id -> hash of a row the server rejected (not retried until it changes) */
  private failed = new Map<string, Map<string, string>>();
  private loaded = new Set<EntityKey>();

  constructor(private client: SupabaseClient) {}

  isLoaded(): boolean {
    return this.loaded.size > 0;
  }

  clearFailures() {
    this.failed.clear();
  }

  async hasSession(): Promise<boolean> {
    const { data } = await this.client.auth.getSession();
    return Boolean(data.session);
  }

  private async fetchAll(source: string, narrow: (q: any) => any): Promise<{ rows: Row[]; error?: string }> {
    const rows: Row[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await narrow(this.client.from(source).select('*'))
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) return { rows, error: `${source}: ${error.message}` };
      rows.push(...(data || []));
      if (!data || data.length < PAGE_SIZE) break;
    }
    return { rows };
  }

  /** Loads one entity (plus its read-only sources) into `data`. A table that fails to load is left untouched. */
  private async loadEntity(cfg: EntityConfig, narrow: ((q: any) => any) | null, data: Partial<SyncState>, errors: string[]) {
    if (!narrow) {
      data[cfg.key] = [];
      this.loaded.add(cfg.key);
      return;
    }
    const [base, ...extras] = await Promise.all(
      [cfg.table, ...(cfg.extraReadSources || [])].map(source => this.fetchAll(source, narrow))
    );
    if (base.error) {
      errors.push(base.error);
      return;
    }
    // Full rows (visible to admins) win over the public-safe view of the same record
    const byId = new Map<string, Row>();
    for (const extra of extras) for (const r of extra.rows) byId.set(r.id, r);
    for (const r of base.rows) byId.set(r.id, r);

    data[cfg.key] = [...byId.values()].map(r => {
      const clean = stripNulls(r);
      return cfg.fromRow ? cfg.fromRow(clean) : clean;
    });
    this.loaded.add(cfg.key);
  }

  /**
   * Reads every club, then the other tables only for the clubs in scope (the page's club and the
   * signed-in user's own clubs), so a visitor never downloads the whole platform.
   */
  async load(scope: LoadScope): Promise<LoadResult> {
    // Wait for any stored session to be restored so the requests below carry its token
    await this.client.auth.getSession();
    const data: Partial<SyncState> = {};
    const errors: string[] = [];
    const inScope = (s: Scope) => ENTITIES.filter(cfg => (cfg.scope ?? 'club') === s);

    await Promise.all(inScope('all').map(cfg => this.loadEntity(cfg, q => q, data, errors)));

    const slug = scope.slug?.toLowerCase();
    const clubIds = new Set(scope.clubIds.filter(id => isUuid(id)));
    for (const c of (data.clubs as Row[] | undefined) || []) {
      if (slug && (c.slug?.toLowerCase() === slug || c.previous_slugs?.some((p: string) => p?.toLowerCase() === slug))) {
        clubIds.add(c.id);
      }
    }
    const ids = [...clubIds];

    await Promise.all(inScope('club').map(cfg => this.loadEntity(cfg, scopeFilter(cfg, ids, []), data, errors)));

    const tournamentIds = ((data.tournaments as Row[] | undefined) || []).map(t => t.id);
    await Promise.all(inScope('tournament').map(cfg => this.loadEntity(cfg, scopeFilter(cfg, ids, tournamentIds), data, errors)));

    return { data, errors, clubIds: ids };
  }

  /**
   * Folds a row pushed by Supabase (Realtime, or an RPC result) into the local copy and remembers it
   * as "already in the database", so it isn't uploaded straight back. Returns the merged local object.
   */
  applyRemote(key: EntityKey, existing: Row | undefined, remote: Row): Row {
    const cfg = ENTITIES.find(e => e.key === key)!;
    const columns = TABLE_COLUMNS[cfg.table] || [];
    const incoming: Row = {};
    // A column that became NULL remotely must clear the local value too
    for (const col of columns) incoming[col] = remote[col] === null ? undefined : remote[col];
    const merged = cfg.fromRow ? cfg.fromRow({ ...(existing || {}), ...incoming }) : { ...(existing || {}), ...incoming };
    const row = toRow(cfg, merged);
    if (row) {
      const map = this.synced.get(cfg.table) ?? new Map<string, Row>();
      map.set(row.id, row);
      this.synced.set(cfg.table, map);
    }
    return merged;
  }

  removeRemote(key: EntityKey, id: string) {
    const cfg = ENTITIES.find(e => e.key === key)!;
    this.synced.get(cfg.table)?.delete(id);
  }

  /** Marks rows as "already in the database" so they are not re-uploaded */
  seed(state: Partial<SyncState>) {
    for (const cfg of ENTITIES) {
      if (!this.loaded.has(cfg.key)) continue;
      const map = new Map<string, Row>();
      for (const obj of stateRows(cfg, state)) {
        const row = toRow(cfg, obj);
        if (row) map.set(row.id, row);
      }
      this.synced.set(cfg.table, map);
    }
  }

  /**
   * Inserts new rows, sends only the changed columns of existing ones (so values another admin or a
   * server function changed in the meantime aren't overwritten with this copy's stale ones), and
   * deletes exactly the ids in `deletes`.
   */
  async flush(state: Partial<SyncState>, deletes: Partial<Record<EntityKey, Set<string>>> = {}): Promise<FlushResult> {
    const result: FlushResult = { wrote: 0, deleted: 0, deletedIds: [], pendingReadonly: 0, errors: [] };
    const signedIn = await this.hasSession();

    for (const cfg of ENTITIES) {
      if (!this.loaded.has(cfg.key)) continue;

      const synced = this.synced.get(cfg.table) ?? new Map<string, Row>();
      const failed = this.failed.get(cfg.table) ?? new Map<string, string>();
      this.synced.set(cfg.table, synced);
      this.failed.set(cfg.table, failed);

      const inserts: Row[] = [];
      const updates: Array<{ row: Row; patch: Row }> = [];
      for (const obj of stateRows(cfg, state)) {
        const row = toRow(cfg, obj);
        if (!row || failed.get(row.id) === hashRow(row)) continue;
        const base = synced.get(row.id);
        if (!base) {
          inserts.push(row);
        } else {
          const patch = changedColumns(row, base);
          if (patch) updates.push({ row, patch });
        }
      }

      if (!signedIn) {
        // Visitors may only submit membership applications (RLS allows inserting pending rows)
        let rest = inserts;
        if (cfg.key === 'members') {
          await this.insertApplications(cfg, inserts.filter(r => r.membership_status === 'pending'), synced, result);
          rest = inserts.filter(r => r.membership_status !== 'pending');
        }
        result.pendingReadonly += rest.length + updates.length;
        continue;
      }

      if (inserts.length > 0) await this.insertRows(cfg, inserts, synced, failed, result);
      // ponytail: one request per changed row; batch through an RPC if bulk edits get slow
      for (const { row, patch } of updates) await this.updateRow(cfg, row, patch, synced, failed, result);
    }

    // Children before parents
    for (const cfg of [...ENTITIES].reverse()) {
      const ids = [...(deletes[cfg.key] || [])];
      if (ids.length === 0) continue;
      if (!signedIn) {
        result.pendingReadonly += ids.length;
        continue;
      }
      const { error } = await this.client.from(cfg.table).delete().in('id', ids);
      if (error) {
        result.errors.push(`${cfg.table}: could not delete (${error.message})`);
      } else {
        ids.forEach(id => this.synced.get(cfg.table)?.delete(id));
        result.deleted += ids.length;
        result.deletedIds.push(...ids);
      }
    }
    return result;
  }

  private async insertRows(
    cfg: EntityConfig,
    rows: Row[],
    synced: Map<string, Row>,
    failed: Map<string, string>,
    result: FlushResult
  ) {
    const { error } = await this.client.from(cfg.table).upsert(rows, { onConflict: 'id' });
    if (!error) {
      rows.forEach(r => synced.set(r.id, r));
      result.wrote += rows.length;
      return;
    }

    // One bad row shouldn't block the rest: retry individually to find it
    for (const row of rows) {
      const { error: rowError } = await this.client.from(cfg.table).upsert(row, { onConflict: 'id' });
      if (rowError) {
        failed.set(row.id, hashRow(row));
        result.errors.push(`${cfg.table}: ${rowError.message}`);
      } else {
        synced.set(row.id, row);
        result.wrote += 1;
      }
    }
  }

  private async updateRow(
    cfg: EntityConfig,
    row: Row,
    patch: Row,
    synced: Map<string, Row>,
    failed: Map<string, string>,
    result: FlushResult
  ) {
    const { data, error } = await this.client.from(cfg.table).update(patch).eq('id', row.id).select('id');
    // No row back and no error: row-level security filtered it out
    const message = error?.message || (!data?.length ? 'you do not have permission to change this record' : null);
    if (message) {
      failed.set(row.id, hashRow(row));
      result.errors.push(`${cfg.table}: ${message}`);
      return;
    }
    synced.set(row.id, { ...synced.get(row.id), ...patch });
    result.wrote += 1;
  }

  private async insertApplications(
    cfg: EntityConfig,
    rows: Row[],
    synced: Map<string, Row>,
    result: FlushResult
  ) {
    for (const row of rows) {
      const { error } = await this.client.from(cfg.table).insert(row);
      // 23505 = already there
      if (!error || error.code === '23505') {
        synced.set(row.id, row);
        if (!error) result.wrote += 1;
      } else {
        result.errors.push(`${cfg.table}: ${error.message}`);
      }
    }
  }
}
