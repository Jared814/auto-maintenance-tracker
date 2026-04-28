function makeR2Client(S3Client: typeof import('@aws-sdk/client-s3').S3Client) {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
    },
  });
}

export async function generateUploadUrl(params: {
  accountId: string;
  vehicleId: string;
  logId: string;
  filename: string;
  contentType: string;
}): Promise<{ uploadUrl: string; publicUrl: string; r2Key: string }> {
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
  const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
  const r2 = makeR2Client(S3Client);
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
  const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
  const r2 = makeR2Client(S3Client);
  await r2.send(
    new DeleteObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
      Key: r2Key,
    })
  );
}
