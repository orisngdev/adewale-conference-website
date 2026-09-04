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
// Every value is read from RESOURCE_S3_* and nothing else. The bare AWS_* names
// are not a fallback, they are a hazard: this app deploys to Vercel, whose
// functions run on Lambda, and Lambda *always* injects AWS_ACCESS_KEY_ID,
// AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN and AWS_REGION into the function
// environment. Those describe Vercel's own execution role and Vercel's own
// region — neither has any access to this bucket. Falling back to them turns a
// missing setting into an opaque AccessDenied (or a cross-region request)
// instead of the "not configured" banner, and on a developer's laptop the same
// fallback silently picks up whatever admin credential is in the shell. That is
// how this site ended up holding full control of the AWS account.
//
// The key must be the scoped IAM user `adewale-website-s3` —
// Get/Put/DeleteObject on `adewale-student-conf/*` and nothing else. A static
// key at all is a hosting constraint; the backup workflows, which run in GitHub
// Actions, use OIDC and hold no key.
const region = process.env.RESOURCE_S3_REGION || "";
const bucket = process.env.RESOURCE_S3_BUCKET || "";
const accessKeyId = process.env.RESOURCE_S3_ACCESS_KEY_ID || "";
const secretAccessKey = process.env.RESOURCE_S3_SECRET_ACCESS_KEY || "";

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

  async read(key) {
    const out = await getClient().send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    const bytes = await out.Body?.transformToByteArray();
    if (!bytes) throw new Error("Empty object body");
    return Buffer.from(bytes);
  },

  async remove(key) {
    await getClient().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  },

  async signedDownloadUrl(key, opts) {
    // Default to attachment when a filename is given (legacy download behavior);
    // an explicit disposition wins.
    const disposition = opts?.disposition ?? (opts?.filename ? "attachment" : undefined);
    const contentDisposition = disposition
      ? opts?.filename
        ? `${disposition}; filename="${opts.filename.replace(/"/g, "")}"`
        : disposition
      : undefined;
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ...(contentDisposition ? { ResponseContentDisposition: contentDisposition } : {}),
    });
    return getSignedUrl(getClient(), command, { expiresIn: opts?.expiresIn ?? 300 });
  },
};
