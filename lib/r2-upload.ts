let _r2: import('@aws-sdk/client-s3').S3Client | null = null;

async function getR2Client() {
  if (!_r2) {
    const { S3Client } = await import('@aws-sdk/client-s3');
    _r2 = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return _r2;
}

export function isR2Configured(): boolean {
  return !!(
    process.env.CLOUDFLARE_R2_ACCOUNT_ID &&
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY &&
    process.env.CLOUDFLARE_R2_BUCKET_NAME
  );
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function sanitizeVehicleName(name: string): string {
  return name.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
}

/** Build a human-readable R2 key for a photo/receipt. */
export function buildR2Key(params: {
  vehicleName: string;
  serviceDate: string; // YYYY-MM-DD
  typeSlug: string;    // e.g. "oil-filter-change"
  index: number;
  filename: string;
}): string {
  const { vehicleName, serviceDate, typeSlug, index, filename } = params;
  const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
  const base = filename
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9-_]/g, '_')
    .slice(0, 40);
  const vehicle = sanitizeVehicleName(vehicleName) || 'vehicle';
  return `automaint-images/${vehicle}/${serviceDate}_${toSlug(typeSlug)}/${index}_${base}.${ext}`;
}

/** Build an R2 key for a fuel receipt. */
export function buildFuelR2Key(params: {
  vehicleName: string;
  date: string; // YYYY-MM-DD
  filename: string;
}): string {
  const { vehicleName, date, filename } = params;
  const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
  const base = filename.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 40);
  const vehicle = sanitizeVehicleName(vehicleName) || 'vehicle';
  return `automaint-images/${vehicle}/fuel_receipts/${date}_${base}.${ext}`;
}

export async function generateUploadUrl(params: {
  accountId: string;
  vehicleId: string;
  vehicleName?: string;
  logId: string;
  filename: string;
  contentType: string;
  serviceDate?: string;
  typeSlug?: string;
  index?: number;
}): Promise<{ uploadUrl: string; publicUrl: string; r2Key: string }> {
  const { PutObjectCommand } = await import('@aws-sdk/client-s3');
  const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
  const r2 = await getR2Client();

  const r2Key = params.serviceDate && params.typeSlug && params.vehicleName
    ? buildR2Key({
        vehicleName: params.vehicleName,
        serviceDate: params.serviceDate,
        typeSlug: params.typeSlug,
        index: params.index ?? Date.now(),
        filename: params.filename,
      })
    : `automaint-images/${params.vehicleId}/${params.logId}_${Date.now()}_${params.filename}`;

  const uploadUrl = await getSignedUrl(
    r2,
    new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
      Key: r2Key,
      ContentType: params.contentType,
    }),
    { expiresIn: 60 }
  );

  const publicUrl = `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${r2Key}`;
  return { uploadUrl, publicUrl, r2Key };
}

/** Upload a file directly from the server (no presigned URL needed). */
export async function uploadPhotoToR2(params: {
  fileBuffer: Buffer;
  contentType: string;
  r2Key: string;
}): Promise<string> {
  const { PutObjectCommand } = await import('@aws-sdk/client-s3');
  const r2 = await getR2Client();
  await r2.send(
    new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
      Key: params.r2Key,
      Body: params.fileBuffer,
      ContentType: params.contentType,
    })
  );
  return `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${params.r2Key}`;
}

export async function deleteFromR2(r2Key: string): Promise<void> {
  const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
  const r2 = await getR2Client();
  await r2.send(
    new DeleteObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
      Key: r2Key,
    })
  );
}
