import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME || 'itsfootball-assets';
const publicDomain = process.env.R2_PUBLIC_DOMAIN;

export const isR2Configured = Boolean(
  accountId &&
  accessKeyId &&
  secretAccessKey &&
  !accountId.includes('your-cloudflare')
);

let r2Client: S3Client | null = null;

export function getR2Client(): S3Client | null {
  if (!isR2Configured) return null;
  
  if (!r2Client && accountId && accessKeyId && secretAccessKey) {
    r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }
  return r2Client;
}

/**
 * Generate a pre-signed PUT URL for secure, direct-from-client uploads to Cloudflare R2
 */
export async function getPresignedUploadUrl(key: string, contentType: string, expiresIn = 3600): Promise<{ uploadUrl: string; publicUrl: string } | null> {
  const client = getR2Client();
  if (!client) return null;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn });
  const publicUrl = publicDomain 
    ? `${publicDomain.replace(/\/$/, '')}/${key}` 
    : `https://${bucketName}.${accountId}.r2.cloudflarestorage.com/${key}`;

  return { uploadUrl, publicUrl };
}

/**
 * Direct server-side upload of a buffer to Cloudflare R2
 */
export async function uploadBufferToR2(key: string, buffer: Buffer, contentType: string): Promise<string | null> {
  const client = getR2Client();
  if (!client) return null;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await client.send(command);

  return publicDomain 
    ? `${publicDomain.replace(/\/$/, '')}/${key}` 
    : `https://${bucketName}.${accountId}.r2.cloudflarestorage.com/${key}`;
}

/**
 * Generate standard object storage path for club achievement badges
 */
export function getBadgeStorageKey(clubId: string, badgeId: string, extension = 'svg'): string {
  return `clubs/${clubId}/badges/${badgeId}.${extension}`;
}

