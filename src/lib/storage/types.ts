// Provider-agnostic file storage for portal resources. The app talks to this
// interface only; the concrete backend (S3 today, could be Supabase Storage,
// GCS, R2, …) is selected in ./index. Swapping providers is a one-file change.
export interface StorageProvider {
  /** Provider id, e.g. "s3" — for logging/diagnostics. */
  readonly name: string;
  /** True when the backend has all the config/credentials it needs. */
  readonly configured: boolean;
  /** Store bytes at `key` (overwrites). */
  put(key: string, body: Buffer, contentType?: string): Promise<void>;
  /** Delete the object at `key` (no-op if absent). */
  remove(key: string): Promise<void>;
  /**
   * A short-lived URL that lets the holder download the object directly. The
   * file stays private — only this signed link (default 5 min) grants access.
   */
  signedDownloadUrl(
    key: string,
    opts?: { filename?: string; expiresIn?: number },
  ): Promise<string>;
}
