#!/usr/bin/env bash
# Upload a VE image to Cloudflare R2 (bucket fardel-ve) and print the public URL.
# Same host as fardel: https://ve.sparkify.dev
#
# Usage:
#   scripts/ve-upload.sh <local.png> [object-key]
#   npm run ve -- ve-capture/foo.png character-mixamo.png
#
# If the key has no slash, it is stored as wow-clone/<key>.
set -euo pipefail

LOCAL=${1:?local image path}
RAW_KEY=${2:-}
BUCKET=${FARDEL_VE_BUCKET:-fardel-ve}
PUBLIC_BASE=${FARDEL_VE_PUBLIC_BASE:-https://ve.sparkify.dev}
export CLOUDFLARE_ACCOUNT_ID=${CLOUDFLARE_ACCOUNT_ID:-6ea5db25020bce6cbefd6c1cc999bef3}

if [[ ! -f "$LOCAL" ]]; then
  echo "missing file: $LOCAL" >&2
  exit 1
fi
if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "CLOUDFLARE_API_TOKEN not set — ping Lead. Do not ask for a GitHub login." >&2
  exit 2
fi

if [[ -z "$RAW_KEY" ]]; then
  RAW_KEY=$(basename "$LOCAL")
fi
if [[ "$RAW_KEY" != */* ]]; then
  KEY="wow-clone/${RAW_KEY}"
else
  KEY="$RAW_KEY"
fi

ext=${LOCAL##*.}
ext=$(printf '%s' "$ext" | tr '[:upper:]' '[:lower:]')
case "$ext" in
  jpg|jpeg) ctype=image/jpeg ;;
  webp) ctype=image/webp ;;
  gif) ctype=image/gif ;;
  *) ctype=image/png ;;
esac

if ! command -v npx >/dev/null 2>&1; then
  echo "npx/wrangler required" >&2
  exit 3
fi

npx --yes wrangler@4 r2 object put "${BUCKET}/${KEY}" --file="$LOCAL" --content-type="$ctype" --remote 2>/dev/null \
  || npx --yes wrangler@4 r2 object put "${BUCKET}/${KEY}" --file="$LOCAL" --content-type="$ctype"

echo "${PUBLIC_BASE}/${KEY}"
