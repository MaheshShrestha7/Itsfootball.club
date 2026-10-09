import { NextRequest, NextResponse } from 'next/server';
import { uploadBufferToR2, isR2Configured, deleteR2Object } from '@/lib/storage/r2';
import { getServiceClient } from '@/lib/supabase/service';
import { clubPhotoKey, type DeletablePhotoFolder } from '@/lib/shop';
import { requireClubPerm, requireUser } from '@/lib/supabase/server-auth';
import { durableRateLimit } from '@/lib/rate-limit';
import { matchesFileSignature } from '@/lib/file-signature';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST multipart { file, folder, clubId? }
//   clubId set:   admins of that club; stored under clubs/<clubId>/
//   clubId unset: any signed-in user creating a club (it doesn't exist yet); stored under
//                 new-clubs/<userId>/ with a tight daily cap so it can't serve as free hosting
export async function POST(req: NextRequest) {
  try {
    // Reject oversized bodies before reading them
    const declaredLength = Number(req.headers.get('content-length') || 0);
    if (declaredLength > MAX_FILE_SIZE + 512 * 1024) {
      return NextResponse.json(
        { error: 'File size exceeds maximum allowed limit of 5 MB' },
        { status: 413 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const rawFolder = (formData.get('folder') as string) || 'uploads';
    // Sanitize folder path to prevent path traversal
    const folder = rawFolder.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'uploads';
    const clubId = String(formData.get('clubId') || '');
    if (clubId && !UUID_RE.test(clubId)) {
      return NextResponse.json({ error: 'Invalid club.' }, { status: 400 });
    }

    // Any role that may edit something at the club (photos, logos, flyers, products...)
    const auth = clubId ? await requireClubPerm(req, clubId, null, 'edit') : await requireUser(req);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const allowed = clubId
      ? await durableRateLimit(`upload:${auth.userId}`, 30, 10 * 60 * 1000)
      : await durableRateLimit(`upload-new-club:${auth.userId}`, 10, 24 * 60 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json({ error: 'Too many uploads. Please wait a while and try again.' }, { status: 429 });
    }

    if (!file) {
      return NextResponse.json({ error: 'No file provided in form data' }, { status: 400 });
    }

    // Security Check 1: File Size Cap (5 MB)
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds maximum allowed limit of 5 MB' },
        { status: 413 }
      );
    }

    // Security Check 2: MIME Type Whitelist
    const fileType = (file.type || '').toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(fileType)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed formats: JPEG, PNG, WebP, GIF' },
        { status: 415 }
      );
    }

    // Security Check 3: Sanitize extension and cryptographically randomize key
    const safeExt = EXTENSION_MAP[fileType] || 'jpg';
    const owner = clubId ? `clubs/${clubId}` : `new-clubs/${auth.userId}`;
    const uniqueKey = `${owner}/${folder}/${crypto.randomUUID()}.${safeExt}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    // Security Check 4: the file content must match its declared type
    if (!matchesFileSignature(buffer, fileType)) {
      return NextResponse.json({ error: 'File content does not match its image type.' }, { status: 415 });
    }

    // 1. If R2 is configured with valid credentials, upload to Cloudflare R2
    if (isR2Configured) {
      const publicUrl = await uploadBufferToR2(uniqueKey, buffer, fileType);
      if (publicUrl) {
        return NextResponse.json({
          success: true,
          url: publicUrl,
          key: uniqueKey,
          storage: 'cloudflare-r2',
        });
      }
    }

    // 2. Supabase Storage (public `club-assets` bucket), written with the caller's own session
    const { error: storageError } = await auth.supabase.storage
      .from('club-assets')
      .upload(uniqueKey, buffer, { contentType: fileType, upsert: false });

    if (storageError) {
      console.error('Supabase Storage upload error:', storageError.message);
      return NextResponse.json(
        { error: 'File storage is not available right now. Please contact the site administrator.' },
        { status: 503 }
      );
    }

    const { data: publicUrl } = auth.supabase.storage.from('club-assets').getPublicUrl(uniqueKey);
    return NextResponse.json({
      success: true,
      url: publicUrl.publicUrl,
      key: uniqueKey,
      storage: 'supabase-storage',
    });
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json({ error: 'Failed to process file upload' }, { status: 500 });
  }
}

// DELETE { clubId, url, folder? }: removes a shop ('shop', the default) or gallery ('gallery') photo the
// club no longer uses (admins of that club only).
// ponytail: shop and gallery photos only; other club images are replaced in place and their old files stay
export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null) as { clubId?: unknown; url?: unknown; folder?: unknown } | null;
  const clubId = String(body?.clubId || '');
  const url = String(body?.url || '');
  const folder: DeletablePhotoFolder = body?.folder === 'gallery' ? 'gallery' : 'shop';
  if (!UUID_RE.test(clubId)) return NextResponse.json({ error: 'Invalid club.' }, { status: 400 });
  // The key must sit under the club the caller administers, so no other club's files are reachable
  const key = clubPhotoKey(clubId, url, folder);
  if (!key) return NextResponse.json({ error: 'Only shop and gallery photos can be deleted.' }, { status: 400 });

  const auth = await requireClubPerm(req, clubId, [folder], 'edit');
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: 'File storage is not available right now.' }, { status: 503 });

  // Never delete a photo a product or gallery entry still shows. Compared by storage key: supabase-js doesn't quote
  // filters, so a crafted URL (with a comma) could slip past a `contains`/`eq` check on the URL itself.
  const { data: rows, error } = folder === 'gallery'
    ? await db.from('media_gallery').select('media_url').eq('club_id', clubId)
    : await db.from('shop_products').select('photos').eq('club_id', clubId);
  if (error) return NextResponse.json({ error: 'Could not check the photo.' }, { status: 500 });
  const inUse = (rows || []).flatMap(r => ('photos' in r ? r.photos as string[] : [r.media_url as string]));
  if (inUse.some(src => clubPhotoKey(clubId, src, folder) === key)) {
    return NextResponse.json({ error: 'This photo is still in use.' }, { status: 409 });
  }

  try {
    // Same split as the upload: Supabase Storage URLs name their bucket, everything else is R2
    if (url.includes('/storage/v1/object/public/club-assets/')) {
      const { error: removeError } = await db.storage.from('club-assets').remove([key]);
      if (removeError) throw removeError;
    } else if (!(await deleteR2Object(key))) {
      return NextResponse.json({ error: 'File storage is not available right now.' }, { status: 503 });
    }
  } catch (err) {
    console.error('Photo delete failed:', key, (err as Error).message);
    return NextResponse.json({ error: 'Could not delete the photo file.' }, { status: 502 });
  }
  return NextResponse.json({ success: true });
}
