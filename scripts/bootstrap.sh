#!/usr/bin/env bash
# One-time setup after cloning. Needs Docker running.
set -euo pipefail
cd "$(dirname "$0")/.."

# nvm/fnm are shell functions; respect .nvmrc if either is available
if command -v fnm >/dev/null 2>&1; then fnm use --install-if-missing || true
elif [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]; then . "${NVM_DIR:-$HOME/.nvm}/nvm.sh" && nvm install || true
fi
node -e 'const m=+process.versions.node.split(".")[0]; if(m!==24){console.error(`❌ Node 24 required, found ${process.version}. Run: nvm install (or fnm use)`);process.exit(1)}'

corepack enable
pnpm install --frozen-lockfile
command -v docker >/dev/null || { echo "❌ Docker is required for local Supabase"; exit 1; }
docker info >/dev/null 2>&1 || { echo "❌ Docker is installed but not running"; exit 1; }
pnpm db:start                      # starts local Supabase, applies supabase/migrations + seed.sql
cp -n .env.example .env.local || true
node scripts/write-local-env.mjs   # fills NEXT_PUBLIC_SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY
echo "✅ Ready. Add your ANTHROPIC_API_KEY to .env.local, then: pnpm dev"
