import { listR2Files, putPrivateObject, r2ObjectSize, uploadBufferToR2 } from './r2';

// Moving uploads saved before R2 was switched on (Mission Control -> System health -> "Move images to R2").
// Files keep their names, so a link only needs its start swapped:
//   https://<project>.supabase.co/storage/v1/object/public/club-assets/<name>  ->  R2_PUBLIC_DOMAIN/<name>
// Receipts are only copied: their rows hold the name, and receipts.ts already looks in R2 first.

export const MOVE_BUCKETS = ['club-assets', 'receipts'] as const;
export type MoveBucket = (typeof MOVE_BUCKETS)[number];
export const isPrivateBucket = (b: MoveBucket) => b === 'receipts';

export interface SourceFile { name: string; size: number; mimetype: string }

/** Supabase Storage as the copy reads it (the route wires it to the database; the check to a fake) */
export interface MoveSource {
  list(bucket: MoveBucket, after: string, limit: number): Promise<SourceFile[]>;
  download(bucket: MoveBucket, name: string): Promise<Uint8Array>;
}

export function supabasePublicBase(supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/club-assets/`;
}

export interface CopyResult { copied: number; skipped: number; failed: { name: string; error: string }[]; next: string | null }

/** Copies up to `limit` files after `after` (by name) to R2. Files already there with the same size are skipped,
 *  so a stopped run can simply start again. `next` is null once the bucket's last file was handled. */
export async function copyBatch(source: MoveSource, bucket: MoveBucket, after: string, limit = 25): Promise<CopyResult> {
  const priv = isPrivateBucket(bucket);
  const files = await source.list(bucket, after, limit);
  const out: CopyResult = { copied: 0, skipped: 0, failed: [], next: files.length === limit ? files[files.length - 1].name : null };
  for (const f of files) {
    try {
      if ((await r2ObjectSize(f.name, priv)) === f.size) { out.skipped++; continue; }
      const bytes = await source.download(bucket, f.name);
      if (bytes.length !== f.size) throw new Error(`downloaded ${bytes.length} of ${f.size} bytes`);
      const stored = priv ? await putPrivateObject(f.name, bytes, f.mimetype) : await uploadBufferToR2(f.name, bytes, f.mimetype);
      if (!stored) throw new Error('R2 is not fully set up');
      const size = await r2ObjectSize(f.name, priv);
      if (size !== f.size) throw new Error(`R2 holds ${size ?? 'nothing'} instead of ${f.size} bytes`);
      out.copied++;
    } catch (e) {
      out.failed.push({ name: f.name, error: (e as Error).message.slice(0, 200) });
    }
  }
  return out;
}

export interface BucketStatus { files: number; bytes: number; inR2: number; missing: string[] }

/** Compares every file in the bucket with R2 by name and size. `missing` lists up to 20 that aren't copied yet. */
export async function bucketStatus(source: MoveSource, bucket: MoveBucket): Promise<BucketStatus> {
  const r2 = new Map((await listR2Files('', isPrivateBucket(bucket))).map(f => [f.key, f.size]));
  const status: BucketStatus = { files: 0, bytes: 0, inR2: 0, missing: [] };
  let after = '';
  for (;;) {
    const page = await source.list(bucket, after, 1000);
    for (const f of page) {
      status.files++;
      status.bytes += f.size;
      if (r2.get(f.name) === f.size) status.inR2++;
      else if (status.missing.length < 20) status.missing.push(f.name);
    }
    if (page.length < 1000) return status;
    after = page[page.length - 1].name;
  }
}
