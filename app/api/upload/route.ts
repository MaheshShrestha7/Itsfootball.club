import { NextRequest, NextResponse } from 'next/server';
import { uploadBufferToR2, isR2Configured } from '@/lib/storage/r2';

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

export async function POST(req: NextRequest) {
  try {
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
    const timestamp = Date.now();
    const randomHex = Math.random().toString(36).substring(2, 10);
    const uniqueKey = `${folder}/${timestamp}-${randomHex}.${safeExt}`;

    const buffer = Buffer.from(await file.arrayBuffer());

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

    // 2. Fallback for offline/demo environment: convert to data URI
    const base64 = buffer.toString('base64');
    const dataUri = `data:${fileType};base64,${base64}`;

    return NextResponse.json({
      success: true,
      url: dataUri,
      key: uniqueKey,
      storage: 'fallback-demo',
      message: 'Cloudflare R2 credentials not detected in .env.local; stored as local asset.',
    });
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json({ error: 'Failed to process file upload' }, { status: 500 });
  }
}
