import { NextRequest, NextResponse } from 'next/server';
import { uploadBufferToR2, isR2Configured } from '@/lib/storage/r2';
import { requireClubAdmin } from '@/lib/supabase/server-auth';

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

// True when the leading bytes really are the image type the client claimed
function matchesImageSignature(bytes: Buffer, mime: string): boolean {
  switch (mime) {
    case 'image/jpeg':
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case 'image/png':
      return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'image/gif':
      return bytes.subarray(0, 4).toString('ascii') === 'GIF8';
    case 'image/webp':
      return bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
    default:
      return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    // Only signed-in club administrators may upload
    const auth = await requireClubAdmin(req);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

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
    const uniqueKey = `${folder}/${crypto.randomUUID()}.${safeExt}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    // Security Check 4: the file content must match its declared type
    if (!matchesImageSignature(buffer, fileType)) {
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
