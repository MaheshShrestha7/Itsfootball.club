import { isR2PrivateConfigured, putPrivateObject, getPrivateObjectUrl } from './r2';
import { getServiceClient } from '@/lib/supabase/service';
import { matchesFileSignature } from '@/lib/file-signature';

export const MAX_RECEIPT_SIZE = 5 * 1024 * 1024; // 5 MB
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

// Receipts are private: R2's private bucket if configured, else the private Supabase `receipts`
// bucket (service role only). Callers store the returned key, never a URL.
export async function storeReceipt(
  clubId: string,
  file: File
): Promise<{ ok: true; key: string } | { ok: false; status: number; error: string }> {
  if (file.size > MAX_RECEIPT_SIZE) return { ok: false, status: 413, error: 'Receipt must be 5 MB or smaller.' };
  const type = (file.type || '').toLowerCase();
  const ext = EXTENSIONS[type];
  if (!ext) return { ok: false, status: 415, error: 'Receipt must be a JPEG, PNG, WebP photo or a PDF.' };

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!matchesFileSignature(bytes, type)) {
    return { ok: false, status: 415, error: 'File content does not match its type.' };
  }

  const key = `receipts/${clubId}/${crypto.randomUUID()}.${ext}`;
  if (isR2PrivateConfigured) {
    await putPrivateObject(key, bytes, type);
    return { ok: true, key };
  }
  const db = getServiceClient();
  if (!db) return { ok: false, status: 503, error: 'Receipt storage is not available right now.' };
  const { error } = await db.storage.from('receipts').upload(key, bytes, { contentType: type, upsert: false });
  if (error) return { ok: false, status: 503, error: 'Receipt storage is not available right now.' };
  return { ok: true, key };
}

export async function receiptUrl(key: string): Promise<string | null> {
  if (isR2PrivateConfigured) return getPrivateObjectUrl(key);
  const db = getServiceClient();
  if (!db) return null;
  const { data } = await db.storage.from('receipts').createSignedUrl(key, 300);
  return data?.signedUrl ?? null;
}
