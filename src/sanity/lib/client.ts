import { createClient } from "next-sanity";
import { apiVersion, dataset, projectId } from "../env";

// `placeholder` keeps client creation from throwing before a real project is
// configured; requests simply won't resolve until NEXT_PUBLIC_SANITY_PROJECT_ID is set.
export const client = createClient({
  projectId: projectId || "placeholder",
  dataset,
  apiVersion,
  // CDN in production (fast); origin in dev so content edits/imports show
  // immediately while testing. SanityLive still pushes live updates either way.
  useCdn: process.env.NODE_ENV === "production",
});
