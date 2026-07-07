#!/usr/bin/env bash
# Seed the remote database. Reads SUPABASE_DB_URL from the environment, or falls
# back to reading it out of .env (npm scripts don't auto-load .env). Needs the
# psql client installed.
set -euo pipefail

if [ -z "${SUPABASE_DB_URL:-}" ] && [ -f .env ]; then
  SUPABASE_DB_URL="$(grep -E '^SUPABASE_DB_URL=' .env | head -1 | cut -d= -f2- || true)"
  # strip optional surrounding quotes
  SUPABASE_DB_URL="${SUPABASE_DB_URL%\"}"
  SUPABASE_DB_URL="${SUPABASE_DB_URL#\"}"
fi

if [ -z "${SUPABASE_DB_URL:-}" ] || printf '%s' "$SUPABASE_DB_URL" | grep -q "PASSWORD"; then
  echo "SUPABASE_DB_URL is not set." >&2
  echo "Get it from: Supabase Dashboard → Project Settings → Database → Connection string → URI" >&2
  echo "Then add it to .env (or export it) and re-run: npm run db:seed" >&2
  exit 1
fi

exec psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/seed-demo.sql
