#!/usr/bin/env bash
# Build the playable Ashen Reach client and deploy it to Cloudflare Pages.
# Replaces the Fardel Babylon client on play.sparkify.dev (Pages project `fardel`).
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"

export CLOUDFLARE_ACCOUNT_ID=${CLOUDFLARE_ACCOUNT_ID:-6ea5db25020bce6cbefd6c1cc999bef3}
PROJECT=${PAGES_PROJECT:-fardel}
BRANCH=${PAGES_BRANCH:-main}

if [[ "${ASHEN_BUILD_ONLY:-0}" != "1" && -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "CLOUDFLARE_API_TOKEN is required" >&2
  exit 2
fi

# ASHEN_PAGES_SEAL=<seal.json> uploads the already gated dist WITHOUT rebuilding.
# The seal (written by scripts/character-assets/pages-seal.mjs after gates pass)
# must match every dist file, and the committed product inputs must be identical
# to those that produced it. See docs/DEPLOY.md.
SEAL=${ASHEN_PAGES_SEAL:-}
if [[ -n "$SEAL" && "${ASHEN_BUILD_ONLY:-0}" == "1" ]]; then
  echo "ASHEN_PAGES_SEAL uploads an existing build; do not combine it with ASHEN_BUILD_ONLY" >&2
  exit 2
fi

if [[ -n "$SEAL" ]]; then
  node scripts/character-assets/pages-seal.mjs verify --dist dist --seal "$SEAL"
else
  STAGE=$(mktemp -d)
  cleanup() { rm -rf "$STAGE"; }
  trap cleanup EXIT

  mkdir -p "$STAGE/tex" "$STAGE/ashen-reach" "$STAGE/characters"
  for pack in forrest_ground_01 rock_wall_08 wood_planks_grey bark_brown_02; do
    mkdir -p "$STAGE/tex/$pack"
    cp -a "public/tex/$pack/diff.jpg" "$STAGE/tex/$pack/diff.jpg"
  done
  # The authoritative server cooks this duplicate collision export. Browsers use
  # the existing region geometry and only compare its release identifier.
  rsync -a --exclude 'wanderer.glb' --exclude 'wanderer-equipment.glb' --exclude 'presence-v1/' public/ashen-reach/ "$STAGE/ashen-reach/"
  cp -a public/meshopt_decoder.js "$STAGE/meshopt_decoder.js"
  cp -a public/HavokPhysics.wasm "$STAGE/HavokPhysics.wasm"
  rsync -a public/characters/bodies/ "$STAGE/characters/bodies/"
  rsync -a public/characters/garments/ "$STAGE/characters/garments/"
  rsync -a public/characters/animations/ "$STAGE/characters/animations/"
  cp -a public/characters/base.glb "$STAGE/characters/base.glb"
  [[ -f public/characters/base-thirdperson.glb ]] && cp -a public/characters/base-thirdperson.glb "$STAGE/characters/base-thirdperson.glb"
  cp -a public/_headers "$STAGE/_headers"
  # Disable Pages' implicit SPA fallback: a missing module must be a 404,
  # never a cacheable 200 response containing the game HTML.
  # https://developers.cloudflare.com/pages/configuration/serving-pages/#single-page-application-spa-rendering
  cp -a public/404.html "$STAGE/404.html"

  echo "Staging $(du -sh "$STAGE" | awk '{print $1}') of playable assets"
  ASHEN_PAGES=1 ASHEN_PUBLIC_DIR="$STAGE" npm run build
fi
# Both paths: the uploaded dist must carry the exact Havok binary.
if ! cmp -s public/HavokPhysics.wasm dist/HavokPhysics.wasm; then
  echo "Deployment build is missing HavokPhysics.wasm" >&2
  exit 3
fi

if [[ "${ASHEN_BUILD_ONLY:-0}" == "1" ]]; then
  echo "Verified Pages assets built in dist"
  echo "After gates pass: node scripts/character-assets/pages-seal.mjs seal --dist dist --out <file outside dist>"
  echo "Then upload those exact bytes: ASHEN_PAGES_SEAL=<file> npm run deploy"
  exit 0
fi

npx --yes wrangler@4 pages deploy dist \
  --project-name="$PROJECT" \
  --branch="$BRANCH" \
  --commit-dirty=true \
  --commit-hash="$(git rev-parse HEAD)" \
  --commit-message="$(git log -1 --pretty=%s | tr -d '\n' | cut -c1-120)"

echo "https://play.sparkify.dev"
# Pages redirects .html to extensionless URLs; use the root entry to avoid that
# extra cold-navigation round trip. Keep local Vite routes unchanged.
# https://developers.cloudflare.com/pages/configuration/serving-pages/#route-matching
echo "https://play.sparkify.dev/?play&clean"
