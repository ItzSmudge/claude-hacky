#!/usr/bin/env bash
# usage: pnpm wt feat/swipe-gestures
set -euo pipefail
BR="${1:?usage: pnpm wt <type>/<scope>-<desc>}"
if ! [[ "$BR" =~ ^(feat|fix|chore|docs|refactor|style|test|hotfix)/[a-z0-9][a-z0-9-]*$ ]]; then
  echo "❌ Branch must look like feat|fix|chore|docs|refactor|style|test/<scope>-<desc>" >&2
  exit 1
fi
ROOT="$(git rev-parse --show-toplevel)"
DIR="$ROOT/.claude/worktrees/${BR//\//-}"
git fetch origin dev
git worktree add "$DIR" -b "$BR" origin/dev
cp -n "$ROOT/.env.local" "$DIR/.env.local" 2>/dev/null || true
(cd "$DIR" && pnpm install --frozen-lockfile)
echo "cd $DIR && claude"
