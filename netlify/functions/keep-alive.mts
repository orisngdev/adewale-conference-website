// Netlify Scheduled Function — runs on a cron to keep the free-tier Supabase
// project awake (internal pg_cron doesn't count as activity). Active only when
// this branch is the live Netlify deploy. It touches Supabase over REST using
// the server key, so it needs no external URL.
export default async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return new Response("supabase-not-configured");
  const res = await fetch(`${url}/rest/v1/editions?select=year&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  return new Response(JSON.stringify({ ok: res.ok, status: res.status }), {
    headers: { "content-type": "application/json" },
  });
};

// Every 3 days at 06:00 UTC. Well within Supabase's ~7-day idle-pause window.
export const config = { schedule: "0 6 */3 * *" };
