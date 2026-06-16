#!/usr/bin/env bash
# Autonomous deploy: reads keys from ../SECRETS.local.md, provisions Neon (if
# given an API key), migrates, seeds, and deploys to Vercel. Idempotent.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WEB="$ROOT/web"
SECRETS="$ROOT/SECRETS.local.md"
cd "$WEB"

[ -f "$SECRETS" ] || { echo "❌ $SECRETS not found"; exit 1; }

# Extract a KEY=value from the secrets markdown (first non-empty match).
getkey() { grep -E "^$1=." "$SECRETS" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | xargs || true; }

NEON_API_KEY="$(getkey NEON_API_KEY)"
DATABASE_URL="$(getkey DATABASE_URL)"
OPENROUTER_API_KEY="$(getkey OPENROUTER_API_KEY)"
ROUTING_PROFILE="$(getkey ROUTING_PROFILE)"; ROUTING_PROFILE="${ROUTING_PROFILE:-balanced}"

[ -n "$OPENROUTER_API_KEY" ] || { echo "❌ OPENROUTER_API_KEY missing in SECRETS.local.md"; exit 1; }

# --- 1. Neon database -------------------------------------------------------
if [ -z "$DATABASE_URL" ]; then
  [ -n "$NEON_API_KEY" ] || { echo "❌ Need DATABASE_URL or NEON_API_KEY"; exit 1; }
  echo "▶ Creating Neon project via neonctl…"
  export NEON_API_KEY
  npx --yes neonctl projects create --name dclaw-write --output json > /tmp/neon.json
  DATABASE_URL="$(npx --yes neonctl connection-string --output json 2>/dev/null | tr -d '"' || true)"
  [ -n "$DATABASE_URL" ] || { echo "❌ Could not derive DATABASE_URL from Neon"; exit 1; }
fi
echo "✓ Database URL acquired"

# --- 2. Local env + migrate + seed -----------------------------------------
cat > "$WEB/.env.local" <<EOF
DATABASE_URL=$DATABASE_URL
OPENROUTER_API_KEY=$OPENROUTER_API_KEY
ROUTING_PROFILE=$ROUTING_PROFILE
EOF
echo "✓ Wrote web/.env.local"

echo "▶ Migrating…";  DATABASE_URL="$DATABASE_URL" npm run db:migrate
echo "▶ Seeding progress…"; DATABASE_URL="$DATABASE_URL" npm run db:seed
echo "▶ Seeding demo…";     DATABASE_URL="$DATABASE_URL" npm run db:seed-demo

# --- 3. Vercel project + env + deploy --------------------------------------
echo "▶ Linking Vercel project…"
vercel link --yes --project dclaw-write >/dev/null 2>&1 || vercel link --yes >/dev/null
for scope in production preview development; do
  printf '%s' "$DATABASE_URL"        | vercel env add DATABASE_URL "$scope" --force      >/dev/null 2>&1 || true
  printf '%s' "$OPENROUTER_API_KEY"  | vercel env add OPENROUTER_API_KEY "$scope" --force >/dev/null 2>&1 || true
  printf '%s' "$ROUTING_PROFILE"     | vercel env add ROUTING_PROFILE "$scope" --force    >/dev/null 2>&1 || true
done
echo "✓ Vercel env set"

echo "▶ Deploying to production…"
vercel --prod --yes

echo "✅ Done. Open the URL above. Demo brand + doc are pre-seeded."
