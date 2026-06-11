// Sanity environment config. Values come from env vars; until a real project is
// created (sanity.io/manage), projectId is empty and the Studio/queries are inert
// — the rest of the app still builds and runs.
export const apiVersion =
  process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2024-10-01";

export const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";

export const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "";
