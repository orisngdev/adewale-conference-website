// Supabase config. Until a project is created (supabase.com) and these env vars
// are set, the clients are inert and the portal is gated off — the rest of the
// app builds and runs unchanged.
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

// Publishable key (`sb_publishable_…`) — the current, client-safe key that
// replaces the legacy `anon` key. Fall back to the legacy var so either works.
export const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabasePublishableKey,
);
