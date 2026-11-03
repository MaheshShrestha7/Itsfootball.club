import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/supabase/server-auth';
import { getServiceClient } from '@/lib/supabase/service';
import { isUuid } from '@/lib/ids';
import { deleteR2Object, isR2Configured, listR2Files, listR2Folders } from '@/lib/storage/r2';

// Mission Control -> System health -> "Files left by deleted clubs" (components/admin/platform/StorageCleanup.tsx).
//   GET                 club folders in storage (clubs/<id>/) whose club no longer exists, with
//                       file counts and sizes, named from the health job's purge log when known
//   POST { clubId }     deletes every file in that folder. Super admins only, and only when the
//                       club is really gone. Logged in admin_audit_log.
// Payment receipts (private bucket, receipts/<id>/) are left alone: they back the payments kept
// for accounting.

const MAX_FOLDERS = 50;

async function superAdmin(req: NextRequest) {
  const auth = await requirePlatformAdmin(req, true);
  if (!auth.ok) return auth;
  const { data } = await auth.supabase.rpc('is_platform_super_admin');
  return data === true ? auth : { ok: false as const, status: 403 as const, error: 'Only Super admins can delete stored files.' };
}

/** Club ids (of `ids`) that still exist */
async function existing(db: NonNullable<ReturnType<typeof getServiceClient>>, ids: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await db.from('clubs').select('id').in('id', ids.slice(i, i + 100));
    if (error) throw new Error(error.message);
    (data || []).forEach(r => found.add(r.id));
  }
  return found;
}

export async function GET(req: NextRequest) {
  const auth = await requirePlatformAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: 'Not configured on the server.' }, { status: 503 });
  if (!isR2Configured) return NextResponse.json({ folders: [], canDelete: false, note: 'File storage (R2) is not set up.' });

  const ids = (await listR2Folders('clubs/')).map(p => p.split('/')[1]).filter(isUuid);
  const alive = await existing(db, ids);
  const orphans = ids.filter(id => !alive.has(id)).slice(0, MAX_FOLDERS);

  // Names of clubs the health job deleted (its run log, kept 60 days)
  const { data: runs } = await db.from('platform_events').select('detail').eq('kind', 'cron').eq('name', 'health')
    .neq('detail->>deletedClubs', '[]').limit(1000);
  const names = new Map<string, string>();
  for (const r of runs || []) {
    for (const c of ((r.detail as { deletedClubs?: { id?: string; name?: string }[] })?.deletedClubs || [])) {
      if (c?.id && c.name) names.set(c.id, c.name);
    }
  }

  const folders = await Promise.all(orphans.map(async id => {
    const files = await listR2Files(`clubs/${id}/`);
    return { clubId: id, name: names.get(id) || null, files: files.length, bytes: files.reduce((n, f) => n + f.size, 0) };
  }));
  const { data: canDelete } = await auth.supabase.rpc('is_platform_super_admin');
  return NextResponse.json({ folders, canDelete: canDelete === true });
}

export async function POST(req: NextRequest) {
  const auth = await superAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const db = getServiceClient();
  if (!db || !isR2Configured) return NextResponse.json({ error: 'File storage is not set up on the server.' }, { status: 503 });

  const input = await req.json().catch(() => null);
  const clubId = isUuid(input?.clubId) ? (input.clubId as string) : '';
  if (!clubId) return NextResponse.json({ error: 'Missing club.' }, { status: 400 });
  if ((await existing(db, [clubId])).has(clubId)) {
    return NextResponse.json({ error: 'That club still exists. Close it first; its files can go once it is deleted.' }, { status: 409 });
  }

  const files = await listR2Files(`clubs/${clubId}/`);
  let deleted = 0;
  // ponytail: one request per file, 20 at a time; switch to DeleteObjects if folders get into the thousands
  for (let i = 0; i < files.length; i += 20) {
    const results = await Promise.allSettled(files.slice(i, i + 20).map(f => deleteR2Object(f.key)));
    deleted += results.filter(r => r.status === 'fulfilled').length;
  }
  const bytes = files.reduce((n, f) => n + f.size, 0);

  await db.from('admin_audit_log').insert({
    club_id: null, actor_id: auth.userId, actor_email: auth.confirmedEmail || null,
    action: 'club_files_deleted', target_table: 'storage', target_id: clubId,
    summary: `Deleted ${deleted} stored files of deleted club ${clubId}`, details: { files: files.length, deleted, bytes },
  });

  if (deleted < files.length) {
    return NextResponse.json({ error: `Deleted ${deleted} of ${files.length} files. Try again for the rest.`, deleted }, { status: 502 });
  }
  return NextResponse.json({ ok: true, deleted, bytes });
}
