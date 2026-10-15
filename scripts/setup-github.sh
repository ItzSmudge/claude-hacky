#!/usr/bin/env bash
# One-time GitHub repo setup (repo admin only). Idempotent-ish: safe to re-run.
# usage: bash scripts/setup-github.sh [collaborator1 collaborator2 collaborator3]
set -euo pipefail
command -v gh >/dev/null || { echo "❌ gh CLI required"; exit 1; }
REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
echo "→ Configuring $REPO"

# 1. dev branch from main, default branch = dev
MAIN_SHA="$(gh api "repos/$REPO/git/ref/heads/main" -q .object.sha)"
if ! gh api "repos/$REPO/git/ref/heads/dev" >/dev/null 2>&1; then
  gh api "repos/$REPO/git/refs" -f ref=refs/heads/dev -f sha="$MAIN_SHA" >/dev/null
  echo "✓ created dev from main"
fi

# 2. merge settings: squash (features) + merge commit (releases), no rebase, delete head branches
gh api -X PATCH "repos/$REPO" \
  -f default_branch=dev \
  -F allow_squash_merge=true -F allow_merge_commit=true -F allow_rebase_merge=false \
  -F delete_branch_on_merge=true -f squash_merge_commit_title=PR_TITLE >/dev/null
echo "✓ default branch dev; squash + merge commit; auto-delete branches"

# 3. collaborators
for user in "$@"; do
  gh api -X PUT "repos/$REPO/collaborators/$user" -f permission=push >/dev/null && echo "✓ invited $user"
done

# 4. rulesets (only enforced on private repos if the owner has GitHub Pro/Team)
ruleset() { # name, branch, required_approvals
  local name="$1" branch="$2" approvals="$3"
  local existing
  existing="$(gh api "repos/$REPO/rulesets" -q ".[] | select(.name==\"$name\") | .id" 2>/dev/null || true)"
  local body
  body=$(cat <<JSON
{
  "name": "$name",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/heads/$branch"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "pull_request", "parameters": {
        "required_approving_review_count": $approvals,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false } },
    { "type": "required_status_checks", "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [ { "context": "ci" } ] } }
  ]
}
JSON
)
  local out
  if [ -n "$existing" ]; then
    out=$(echo "$body" | gh api -X PUT "repos/$REPO/rulesets/$existing" --input - 2>&1) || true
  else
    out=$(echo "$body" | gh api -X POST "repos/$REPO/rulesets" --input - 2>&1) || true
  fi
  if echo "$out" | grep -q '"id"'; then
    echo "✓ ruleset $name"
  else
    echo "⚠️  Could not create ruleset '$name' (private repo without GitHub Pro?):"
    echo "    $(echo "$out" | head -c 300)"
    echo "    Enforcement falls back to husky hooks + CI + .claude/settings.json deny rules."
    echo "    Thomas: claim GitHub Pro via the Student Developer Pack to enable rulesets."
  fi
}
ruleset "protect-main" main 1
ruleset "protect-dev" dev 0

echo "✅ Done. Next: push CI so the 'ci' status check exists."
