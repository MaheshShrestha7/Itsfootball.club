// ==============================================================================
// Supabase <-> app state synchronisation
//
// The UI keeps working against in-memory arrays (see lib/club-context.tsx). This module is
// what makes Supabase the source of truth for them:
//   * load()  reads every synced table and returns app-shaped objects
//   * flush() diffs the current arrays against what was last known to be in the database
//             and upserts / deletes only what changed
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

interface EntityConfig {
  key: EntityKey;
  table: string;
  /** Extra read-only sources merged into the table's rows (e.g. a public-safe view) */
  extraReadSources?: string[];
  fromRow?: (row: Row) => Row;
  /** Adjusts an app object just before it is written */
  prepare?: (obj: Row) => Row;
}

// Parents first: this is also the upsert order (deletes run in reverse).
const ENTITIES: EntityConfig[] = [
  { key: 'clubs', table: 'clubs', fromRow: clubFromRow, prepare: clubPrepare },
  { key: 'members', table: 'club_members', extraReadSources: ['club_members_public'], fromRow: memberFromRow },
  { key: 'seasons', table: 'club_seasons' },
  { key: 'internalTeams', table: 'internal_teams' },
  { key: 'tournaments', table: 'tournaments' },
  { key: 'tournamentParticipants', table: 'tournament_participants' },
  { key: 'playerStats', table: 'player_stats' },
  { key: 'matches', table: 'matches' },
  { key: 'matchEvents', table: 'match_events' },
  { key: 'events', table: 'events' },
  { key: 'sponsors', table: 'sponsors', extraReadSources: ['sponsors_public'] },
  { key: 'news', table: 'news_articles' },
  { key: 'gallery', table: 'media_gallery' },
  { key: 'clubScoreRules', table: 'clubscore_rules' },
  { key: 'clubScoreProfiles', table: 'member_clubscore_profiles' },
  { key: 'activityLogs', table: 'gamification_activity_log' },
  { key: 'availabilities', table: 'player_availabilities' },
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

function memberFromRow(r: Row): Row {
  const name = r.full_name ?? [r.first_name, r.last_name].filter(Boolean).join(' ');
  return {
    ...r,
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
  /** Changed rows that couldn't be saved because nobody is signed in */
  pendingReadonly: number;
  errors: string[];
}

export interface LoadResult {
  data: Partial<SyncState>;
  errors: string[];
}

export class SupabaseSync {
  /** table -> id -> hash of the row as last seen in / written to the database */
  private synced = new Map<string, Map<string, string>>();
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

  private async fetchAll(source: string): Promise<{ rows: Row[]; error?: string }> {
    const rows: Row[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await this.client
        .from(source)
        .select('*')
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) return { rows, error: `${source}: ${error.message}` };
      rows.push(...(data || []));
      if (!data || data.length < PAGE_SIZE) break;
    }
    return { rows };
  }

  /** Reads every table. A table that fails to load is left untouched (and never synced). */
  async load(): Promise<LoadResult> {
    // Wait for any stored session to be restored so the requests below carry its token
    await this.client.auth.getSession();
    const data: Partial<SyncState> = {};
    const errors: string[] = [];

    const results = await Promise.all(
      ENTITIES.map(async cfg => {
        const base = await this.fetchAll(cfg.table);
        const extras = await Promise.all((cfg.extraReadSources || []).map(s => this.fetchAll(s)));
        return { cfg, base, extras };
      })
    );

    for (const { cfg, base, extras } of results) {
      if (base.error) {
        errors.push(base.error);
        continue;
      }
      // Full rows (visible to admins) win over the public-safe view of the same record
      const byId = new Map<string, Row>();
      for (const extra of extras) for (const r of extra.rows) byId.set(r.id, r);
      for (const r of base.rows) byId.set(r.id, r);

      const mapped = [...byId.values()].map(r => {
        const clean = stripNulls(r);
        return cfg.fromRow ? cfg.fromRow(clean) : clean;
      });
      data[cfg.key] = mapped;
      this.loaded.add(cfg.key);
    }
    return { data, errors };
  }

  /**
   * Folds a row pushed by Supabase Realtime into the local copy and remembers it as "already in
   * the database", so it isn't uploaded straight back. Returns the merged local object.
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
      const map = this.synced.get(cfg.table) ?? new Map<string, string>();
      map.set(row.id, hashRow(row));
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
      const map = new Map<string, string>();
      for (const obj of stateRows(cfg, state)) {
        const row = toRow(cfg, obj);
        if (row) map.set(row.id, hashRow(row));
      }
      this.synced.set(cfg.table, map);
    }
  }

  /** Writes everything that differs from what the database is known to hold */
  async flush(state: Partial<SyncState>): Promise<FlushResult> {
    const result: FlushResult = { wrote: 0, deleted: 0, pendingReadonly: 0, errors: [] };
    const signedIn = await this.hasSession();
    const deletions: Array<{ cfg: EntityConfig; ids: string[] }> = [];

    for (const cfg of ENTITIES) {
      if (!this.loaded.has(cfg.key)) continue;

      const synced = this.synced.get(cfg.table) ?? new Map<string, string>();
      const failed = this.failed.get(cfg.table) ?? new Map<string, string>();
      this.synced.set(cfg.table, synced);
      this.failed.set(cfg.table, failed);

      const current = new Map<string, Row>();
      for (const obj of stateRows(cfg, state)) {
        const row = toRow(cfg, obj);
        if (row) current.set(row.id, row);
      }

      const changed: Row[] = [];
      for (const [id, row] of current) {
        const hash = hashRow(row);
        if (synced.get(id) !== hash && failed.get(id) !== hash) changed.push(row);
      }
      const removed = [...synced.keys()].filter(id => !current.has(id));

      if (!signedIn) {
        // Visitors may only submit membership applications (RLS allows inserting pending rows)
        let rest = changed;
        if (cfg.key === 'members') {
          const applications = changed.filter(r => r.membership_status === 'pending');
          await this.insertApplications(cfg, applications, synced, result);
          rest = changed.filter(r => r.membership_status !== 'pending');
        }
        result.pendingReadonly += rest.length + removed.length;
        continue;
      }

      if (changed.length > 0) await this.upsertRows(cfg, changed, synced, failed, result);
      if (removed.length > 0) deletions.push({ cfg, ids: removed });
    }

    // Children before parents
    for (const { cfg, ids } of deletions.reverse()) {
      const synced = this.synced.get(cfg.table)!;
      const { error } = await this.client.from(cfg.table).delete().in('id', ids);
      if (error) {
        result.errors.push(`${cfg.table}: could not delete (${error.message})`);
      } else {
        ids.forEach(id => synced.delete(id));
        result.deleted += ids.length;
      }
    }
    return result;
  }

  private async upsertRows(
    cfg: EntityConfig,
    rows: Row[],
    synced: Map<string, string>,
    failed: Map<string, string>,
    result: FlushResult
  ) {
    const { error } = await this.client.from(cfg.table).upsert(rows, { onConflict: 'id' });
    if (!error) {
      rows.forEach(r => synced.set(r.id, hashRow(r)));
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
        synced.set(row.id, hashRow(row));
        result.wrote += 1;
      }
    }
  }

  private async insertApplications(
    cfg: EntityConfig,
    rows: Row[],
    synced: Map<string, string>,
    result: FlushResult
  ) {
    for (const row of rows) {
      const { error } = await this.client.from(cfg.table).insert(row);
      // 23505 = already there
      if (!error || error.code === '23505') {
        synced.set(row.id, hashRow(row));
        if (!error) result.wrote += 1;
      } else {
        result.errors.push(`${cfg.table}: ${error.message}`);
      }
    }
  }
}
