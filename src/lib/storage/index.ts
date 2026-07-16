import { s3Provider } from "./s3";
import type { StorageProvider } from "./types";

// The active storage backend for portal resource files. To move off S3 later
// (Supabase Storage, R2, GCS…), add a provider module and a case here — every
// caller uses this single `resourceStorage` handle, so nothing else changes.
const PROVIDER = (process.env.RESOURCE_STORAGE_PROVIDER || "s3").toLowerCase();

function selectProvider(): StorageProvider {
  switch (PROVIDER) {
    case "s3":
    default:
      return s3Provider;
  }
}

export const resourceStorage: StorageProvider = selectProvider();
export type { StorageProvider } from "./types";
