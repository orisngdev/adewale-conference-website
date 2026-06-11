import { createClient } from "next-sanity";
import { apiVersion, dataset, projectId } from "../env";

// `placeholder` keeps client creation from throwing before a real project is
// configured; requests simply won't resolve until NEXT_PUBLIC_SANITY_PROJECT_ID is set.
export const client = createClient({
  projectId: projectId || "placeholder",
  dataset,
  apiVersion,
  // Live content (SanityLive) needs fresh reads — the CDN serves stale results
  // for ~60s after a publish/import, so disable it here.
  useCdn: false,
});
