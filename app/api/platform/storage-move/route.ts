import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/supabase/server-auth';
import { getServiceClient } from '@/lib/supabase/service';
import { isR2Configured, isR2PrivateConfigured, r2ApiBase, r2PublicBase } from '@/lib/storage/r2';
import { MOVE_BUCKETS, bucketStatus, copyBatch, supabasePublicBase, type MoveBucket, type MoveSource } from '@/lib/storage/move';

// Mission Control -> System health -> "Move images to R2" (components/admin/platform/StorageMove.tsx), migration 20261189.
//   GET                                   files per bucket and how many are in R2, and how many saved links still
//                                         point at Supabase (or at R2's API address, which browsers can't open)
//   POST { action: 'copy', bucket, after } copies the next 25 files to R2 (super admins)
//   POST { action: 'switch' }              once every club-assets file is in R2: swaps the links in one
//                                          transaction, then loads a sample of them (super admins)
// The Supabase files are never deleted here, so links in old emails and posts keep working.

type Db = NonNullable<ReturnType<typeof getServiceClient>>;
type LinkRow = { tbl: string; col: string; rows_found: number };

function source(db: Db): MoveSource {
  return {
    async list(bucket, after, limit) {
      const { data, error } = await db.rpc('storage_move_files', { p_bucket: bucket, p_after: after, p_limit: limit });
      if (error) throw new Error(error.message);
      return (data || []).map((f: { name: string; size: number | string; mimetype: string }) => ({ name: f.name, size: Number(f.size), mimetype: f.mimetype }));
    },
    async download(bucket, name) {
      const { data, error } = await db.storage.from(bucket).download(name);
      if (error || !data) throw new Error(error?.message || 'download failed');
      return new Uint8Array(await data.arrayBuffer());
    },
  };
}

/** The link starts that need swapping, each with what replaces it */
function linkPairs(newBase: string): { label: string; old: string }[] {
  return [
    { label: 'supabase', old: supabasePublicBase(process.env.NEXT_PUBLIC_SUPABASE_URL || '') },
    { label: 'r2-api', old: r2ApiBase() },
  ].filter(p => p.old !== newBase);
}

async function countLinks(db: Db, old: string, next: string, dry: boolean): Promise<LinkRow[]> {
  const { data, error } = await db.rpc('storage_move_links', { p_old: old, p_new: next, p_dry: dry });
  if (error) throw new Error(error.message);
  return (data || []).map((r: LinkRow) => ({ ...r, rows_found: Number(r.rows_found) }));
}

const isMissingMigration = (msg: string) => /storage_move_(files|links)|Could not find the function|schema cache/i.test(msg);

async function setup(req: NextRequest, write: boolean) {
  const auth = await requirePlatformAdmin(req, write);
  if (!auth.ok) return { fail: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  if (write) {
    const { data } = await auth.supabase.rpc('is_platform_super_admin');
    if (data !== true) return { fail: NextResponse.json({ error: 'Only Super admins can move files.' }, { status: 403 }) };
  }
  const db = getServiceClient();
  const base = r2PublicBase();
  if (!db) return { fail: NextResponse.json({ error: 'Not configured on the server.' }, { status: 503 }) };
  if (!isR2Configured || !base) {
    const msg = 'R2 is not fully set up (keys and R2_PUBLIC_DOMAIN).';
    return { fail: NextResponse.json(write ? { error: msg } : { note: msg }, { status: write ? 503 : 200 }) };
  }
  return { auth, db, base };
}

export async function GET(req: NextRequest) {
  const s = await setup(req, false);
  if (s.fail) return s.fail;
  const { db, base, auth } = s;
  try {
    const src = source(db);
    const buckets = await Promise.all(MOVE_BUCKETS.filter(b => b === 'club-assets' || isR2PrivateConfigured)
      .map(async b => ({ bucket: b, ...(await bucketStatus(src, b)) })));
    const links = await Promise.all(linkPairs(base).map(async p => ({ ...p, columns: await countLinks(db, p.old, base, true) })));
    const { data: canMove } = await auth.supabase.rpc('is_platform_super_admin');
    return NextResponse.json({ base, buckets, links, receiptsSkipped: !isR2PrivateConfigured, canMove: canMove === true });
  } catch (e) {
    const msg = (e as Error).message;
    if (isMissingMigration(msg)) return NextResponse.json({ note: 'Run migration 20261189_storage_move.sql in Supabase first.' });
    console.error('storage-move check failed:', msg);
    return NextResponse.json({ error: `Check failed: ${msg}` }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const s = await setup(req, true);
  if (s.fail) return s.fail;
  const { db, base, auth } = s;
  const input = await req.json().catch(() => null) as { action?: unknown; bucket?: unknown; after?: unknown } | null;

  try {
    if (input?.action === 'copy') {
      const bucket = MOVE_BUCKETS.find(b => b === input.bucket) as MoveBucket | undefined;
      if (!bucket) return NextResponse.json({ error: 'Unknown bucket.' }, { status: 400 });
      if (bucket === 'receipts' && !isR2PrivateConfigured) return NextResponse.json({ error: 'R2_PRIVATE_BUCKET is not set.' }, { status: 400 });
      const after = typeof input.after === 'string' ? input.after.slice(0, 1024) : '';
      return NextResponse.json(await copyBatch(source(db), bucket, after));
    }

    if (input?.action === 'switch') {
      const status = await bucketStatus(source(db), 'club-assets');
      if (status.inR2 < status.files) {
        return NextResponse.json({ error: `${status.files - status.inR2} of ${status.files} files aren't in R2 yet. Copy them first.`, missing: status.missing }, { status: 409 });
      }
      const switched = [];
      for (const p of linkPairs(base)) switched.push({ ...p, columns: await countLinks(db, p.old, base, false) });
      const rows = switched.reduce((n, p) => n + p.columns.reduce((m, c) => m + c.rows_found, 0), 0);

      // Load a few of the moved files through the public address, as a visitor would
      const sample = (await source(db).list('club-assets', '', 10)).map(f => f.name);
      const loads = await Promise.all(sample.map(async name => {
        const res = await fetch(base + name.split('/').map(encodeURIComponent).join('/'), { method: 'HEAD' }).catch(() => null);
        return res?.ok ? null : `${name} (${res?.status ?? 'no answer'})`;
      }));
      const broken = loads.filter((x): x is string => !!x);

      await db.from('admin_audit_log').insert({
        club_id: null, actor_id: auth.userId, actor_email: auth.confirmedEmail || null,
        action: 'storage_links_switched', target_table: 'storage', target_id: null,
        summary: `Switched ${rows} saved links to ${base}`, details: { switched, sample: sample.length, broken },
      });
      return NextResponse.json({ ok: true, rows, switched, sample: sample.length, broken });
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (e) {
    const msg = (e as Error).message;
    if (isMissingMigration(msg)) return NextResponse.json({ error: 'Run migration 20261189_storage_move.sql in Supabase first.' }, { status: 409 });
    console.error('storage-move failed:', msg);
    return NextResponse.json({ error: msg.slice(0, 300) }, { status: 502 });
  }
}
