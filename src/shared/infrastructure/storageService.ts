import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { logger } from './logger.js';

let client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!client) {
    const endpoint = process.env['S3_ENDPOINT'];
    client = new S3Client({
      region: process.env['S3_REGION'] ?? 'us-east-1',
      credentials: {
        accessKeyId: process.env['S3_ACCESS_KEY_ID']!,
        secretAccessKey: process.env['S3_SECRET_ACCESS_KEY']!,
      },
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    });
  }
  return client;
}

export async function uploadToS3(key: string, body: Buffer, contentType: string): Promise<string> {
  const bucket = process.env['S3_BUCKET'];
  if (!bucket) throw new Error('S3_BUCKET is not configured');

  await getS3Client().send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
  );

  const publicUrl = process.env['S3_PUBLIC_URL'];
  const url = publicUrl
    ? `${publicUrl}/${bucket}/${key}`
    : `https://${bucket}.s3.amazonaws.com/${key}`;

  logger.info({ key, bucket }, 'File uploaded to S3');
  return url;
}
