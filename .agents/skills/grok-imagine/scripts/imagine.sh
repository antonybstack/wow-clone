#!/usr/bin/env bash
# Headless Grok Imagine for agents that lack image_gen/image_edit tools.
# Usage:
#   imagine.sh [--ratio 16:9] [--out FILE] -- PROMPT
#   imagine.sh --edit REF.png [--out FILE] -- PROMPT
set -euo pipefail

RATIO="16:9"
OUT=""
EDIT=""
PROMPT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ratio) RATIO=${2:?}; shift 2 ;;
    --out) OUT=${2:?}; shift 2 ;;
    --edit) EDIT=${2:?}; shift 2 ;;
    --) shift; PROMPT="$*"; break ;;
    -h|--help)
      sed -n '2,6p' "$0"
      exit 0
      ;;
    *)
      if [[ -z "$PROMPT" && "$1" != --* ]]; then
        PROMPT="$*"
        break
      fi
      echo "unknown arg: $1" >&2
      exit 2
      ;;
  esac
done

if [[ -z "$PROMPT" ]]; then
  echo "missing prompt" >&2
  exit 2
fi
if ! command -v grok >/dev/null 2>&1; then
  echo "grok CLI not on PATH" >&2
  exit 3
fi

CWD=${GROK_IMAGINE_CWD:-$(pwd)}
if [[ -n "$EDIT" ]]; then
  if [[ ! -f "$EDIT" ]]; then
    echo "missing --edit file: $EDIT" >&2
    exit 2
  fi
  EDIT=$(cd "$(dirname "$EDIT")" && pwd)/$(basename "$EDIT")
  INNER="Call the image_edit tool once. image: ['${EDIT}']. prompt: ${PROMPT}. Reply with only the saved filesystem path."
else
  INNER="Call the image_gen tool once. prompt: ${PROMPT}. aspect_ratio: ${RATIO}. Reply with only the saved filesystem path."
fi

JSON=$(grok -p --yolo --verbatim --output-format json --max-turns 8 \
  --cwd "$CWD" \
  --tools image_gen,image_edit \
  -- "$INNER")

SID=$(printf '%s' "$JSON" | python3 -c "import json,sys; print(json.load(sys.stdin).get('sessionId') or '')" 2>/dev/null || true)
ENC=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$CWD")
SESS="$HOME/.grok/sessions/${ENC}"
IMG=""
if [[ -n "$SID" && -d "$SESS/$SID/images" ]]; then
  IMG=$(ls -t "$SESS/$SID/images"/* 2>/dev/null | head -1 || true)
fi
if [[ -z "$IMG" && -d "$SESS" ]]; then
  IMG=$(ls -t "$SESS"/*/images/* 2>/dev/null | head -1 || true)
fi
if [[ -z "$IMG" || ! -f "$IMG" ]]; then
  printf '%s\n' "$JSON" >&2
  echo "imagine.sh: no image file found in session $SESS" >&2
  exit 4
fi

if [[ -n "$OUT" ]]; then
  mkdir -p "$(dirname "$OUT")"
  cp "$IMG" "$OUT"
  echo "$OUT"
else
  echo "$IMG"
fi
