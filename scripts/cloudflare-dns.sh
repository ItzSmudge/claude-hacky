#!/usr/bin/env bash
# Points example.com + www at Vercel via the Cloudflare API. Idempotent. Reads .env.local.
# Needs: CLOUDFLARE_ZONE_ID, CLOUDFLARE_API_TOKEN (Zone.DNS:Edit), CLOUDFLARE_DOMAIN,
#        CLOUDFLARE_WWW_HOSTNAME, CLOUDFLARE_PROXIED, VERCEL_DNS_TARGET
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; [ -f .env.local ] && . ./.env.local; set +a
: "${CLOUDFLARE_ZONE_ID:?}" "${CLOUDFLARE_API_TOKEN:?}" "${CLOUDFLARE_DOMAIN:?}"
: "${CLOUDFLARE_WWW_HOSTNAME:?}" "${VERCEL_DNS_TARGET:?}"
PROXIED="${CLOUDFLARE_PROXIED:-false}"
API="https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/dns_records"
AUTH=(-H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json")

upsert_cname() { # name
  local name="$1" id body
  id=$(curl -fsS "${AUTH[@]}" "$API?type=CNAME&name=$name" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s).result;process.stdout.write(r[0]?.id??"")})')
  body=$(printf '{"type":"CNAME","name":"%s","content":"%s","proxied":%s,"ttl":1}' "$name" "$VERCEL_DNS_TARGET" "$PROXIED")
  if [ -n "$id" ]; then
    curl -fsS -X PUT "${AUTH[@]}" "$API/$id" --data "$body" >/dev/null && echo "✓ updated $name → $VERCEL_DNS_TARGET"
  else
    curl -fsS -X POST "${AUTH[@]}" "$API" --data "$body" >/dev/null && echo "✓ created $name → $VERCEL_DNS_TARGET"
  fi
}

upsert_cname "$CLOUDFLARE_DOMAIN"        # apex CNAME is flattened by Cloudflare
upsert_cname "$CLOUDFLARE_WWW_HOSTNAME"
[ "$PROXIED" = "true" ] && echo "⚠️  Proxied: set Cloudflare SSL mode to Full (strict)."
echo "✅ DNS done. Verify in Vercel → Domains."
