import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageProvider } from "./types";

// AWS S3 backend. Server-only (uses the secret access key) — never import into a
// client component. Config via env; when any piece is missing the provider is
// `configured: false` and the app degrades gracefully (uploads are refused, the
// rest of the portal is unaffected).
//
// Uses RESOURCE_S3_* names because Netlify reserves the bare AWS_* names (it
// won't let you set AWS_REGION / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY). The
// old AWS_* names are still read as a fallback for local dev.
const region = process.env.RESOURCE_S3_REGION || process.env.AWS_REGION || "";
const bucket = process.env.RESOURCE_S3_BUCKET || process.env.AWS_S3_BUCKET || "";
const accessKeyId =
  process.env.RESOURCE_S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || "";
const secretAccessKey =
  process.env.RESOURCE_S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || "";

let client: S3Client | null = null;
function getClient(): S3Client {
  if (!client) {
    client = new S3Client({ region, credentials: { accessKeyId, secretAccessKey } });
  }
  return client;
}

export const s3Provider: StorageProvider = {
  name: "s3",
  configured: Boolean(region && bucket && accessKeyId && secretAccessKey),

  async put(key, body, contentType) {
    await getClient().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ...(contentType ? { ContentType: contentType } : {}),
      }),
    );
  },

  async remove(key) {
    await getClient().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  },

  async signedDownloadUrl(key, opts) {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ...(opts?.filename
        ? {
            ResponseContentDisposition: `attachment; filename="${opts.filename.replace(/"/g, "")}"`,
          }
        : {}),
    });
    return getSignedUrl(getClient(), command, { expiresIn: opts?.expiresIn ?? 300 });
  },
};
