#!/usr/bin/env bash
# Upload reviewed VE media to Cloudflare R2 (bucket fardel-ve) and print the public URL.
# Same host as fardel: https://ve.sparkify.dev
#
# Usage:
#   scripts/ve-upload.sh <local.png> [object-key]
#   npm run ve -- ve-capture/foo.png character-mixamo.png
#   scripts/ve-upload.sh ve-capture/clip.mp4 wow-clone/ashen-reach/pass/clip.mp4
#
# If the key has no slash, it is stored as wow-clone/<key>.
set -euo pipefail

LOCAL=${1:?local media path}
RAW_KEY=${2:-}
BUCKET=${FARDEL_VE_BUCKET:-fardel-ve}
PUBLIC_BASE=${FARDEL_VE_PUBLIC_BASE:-https://ve.sparkify.dev}
export CLOUDFLARE_ACCOUNT_ID=${CLOUDFLARE_ACCOUNT_ID:-6ea5db25020bce6cbefd6c1cc999bef3}

if [[ ! -f "$LOCAL" ]]; then
  echo "missing file: $LOCAL" >&2
  exit 1
fi
if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "CLOUDFLARE_API_TOKEN not set; remote upload requires the configured R2 credentials." >&2
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
  png) ctype=image/png ;;
  jpg|jpeg) ctype=image/jpeg ;;
  webp) ctype=image/webp ;;
  gif) ctype=image/gif ;;
  mp4) ctype=video/mp4 ;;
  webm) ctype=video/webm ;;
  *) echo "unsupported VE media extension: $ext" >&2; exit 4 ;;
esac

if ! command -v npx >/dev/null 2>&1; then
  echo "npx/wrangler required" >&2
  exit 3
fi

npx --yes wrangler@4 r2 object put "${BUCKET}/${KEY}" --file="$LOCAL" --content-type="$ctype" --remote

echo "${PUBLIC_BASE}/${KEY}"
