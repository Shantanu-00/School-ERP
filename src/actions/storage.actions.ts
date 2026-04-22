"use server";

import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export async function getUploadUrl(contentType: string) {
  const fileKey = `receipts/${uuidv4()}`;
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: fileKey,
    ContentType: contentType,
  });
  const signedUrl = await getSignedUrl(r2, command, { expiresIn: 60 });
  return { signedUrl, fileKey };
}

export async function getViewUrls(fileKeys: string[]) {
  if (!fileKeys || fileKeys.length === 0) return [];
  
  return Promise.all(
    fileKeys.map(async (key) => {
      const command = new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
      });
      const url = await getSignedUrl(r2, command, { expiresIn: 300 });
      return { key, url };
    })
  );
}
