#!/usr/bin/env bash
# Build the playable Ashen Reach client and deploy it to Cloudflare Pages.
# Replaces the Fardel Babylon client on play.sparkify.dev (Pages project `fardel`).
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"

export CLOUDFLARE_ACCOUNT_ID=${CLOUDFLARE_ACCOUNT_ID:-6ea5db25020bce6cbefd6c1cc999bef3}
PROJECT=${PAGES_PROJECT:-fardel}
BRANCH=${PAGES_BRANCH:-main}

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "CLOUDFLARE_API_TOKEN is required" >&2
  exit 2
fi

STAGE=$(mktemp -d)
cleanup() { rm -rf "$STAGE"; }
trap cleanup EXIT

mkdir -p "$STAGE/tex" "$STAGE/ashen-reach" "$STAGE/characters"
for pack in forrest_ground_01 rock_wall_08 wood_planks_grey bark_brown_02; do
  mkdir -p "$STAGE/tex/$pack"
  cp -a "public/tex/$pack/diff.jpg" "$STAGE/tex/$pack/diff.jpg"
done
rsync -a --exclude 'wanderer.glb' --exclude 'wanderer-equipment.glb' public/ashen-reach/ "$STAGE/ashen-reach/"
cp -a public/meshopt_decoder.js "$STAGE/meshopt_decoder.js"
cp -a public/HavokPhysics.wasm "$STAGE/HavokPhysics.wasm"
rsync -a public/characters/bodies/ "$STAGE/characters/bodies/"
rsync -a public/characters/garments/ "$STAGE/characters/garments/"
rsync -a public/characters/animations/ "$STAGE/characters/animations/"
cp -a public/characters/base.glb "$STAGE/characters/base.glb"
[[ -f public/characters/base-thirdperson.glb ]] && cp -a public/characters/base-thirdperson.glb "$STAGE/characters/base-thirdperson.glb"
cp -a public/_headers "$STAGE/_headers"

echo "Staging $(du -sh "$STAGE" | awk '{print $1}') of playable assets"
ASHEN_PAGES=1 ASHEN_PUBLIC_DIR="$STAGE" npm run build
if ! cmp -s public/HavokPhysics.wasm dist/HavokPhysics.wasm; then
  echo "Deployment build is missing HavokPhysics.wasm" >&2
  exit 3
fi

npx --yes wrangler@4 pages deploy dist \
  --project-name="$PROJECT" \
  --branch="$BRANCH" \
  --commit-dirty=true \
  --commit-hash="$(git rev-parse HEAD)" \
  --commit-message="$(git log -1 --pretty=%s | tr -d '\n' | cut -c1-120)"

echo "https://play.sparkify.dev"
echo "https://play.sparkify.dev/ashen-reach.html?play&clean"
