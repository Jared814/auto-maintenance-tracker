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

export async function generateUploadUrl(params: {
  accountId: string;
  vehicleId: string;
  logId: string;
  filename: string;
  contentType: string;
}): Promise<{ uploadUrl: string; publicUrl: string; r2Key: string }> {
  const { PutObjectCommand } = await import('@aws-sdk/client-s3');
  const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
  const r2 = await getR2Client();
  const ts = Date.now();
  const r2Key = `receipts/${params.accountId}/${params.vehicleId}/${params.logId}_${ts}_${params.filename}`;

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
