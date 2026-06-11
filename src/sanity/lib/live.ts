import { defineLive } from "next-sanity/live";
import { client } from "./client";

// Live content fetching (Sanity's recommended App Router pattern). No token is
// needed for published content; add server/browser tokens here later if we want
// draft previews / visual editing. Pages call `sanityFetch({ query, params })`
// and render `<SanityLive />` once in the root layout for real-time updates.
export const { sanityFetch, SanityLive } = defineLive({
  client,
  // Published content only — no drafts/visual editing yet. `false` silences the
  // "no token" warnings; add Viewer-scoped tokens here to enable draft previews.
  serverToken: false,
  browserToken: false,
});
