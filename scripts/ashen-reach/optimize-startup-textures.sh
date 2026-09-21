#!/usr/bin/env bash
# Downsample world textures to what the WGSL nearest-neighbour quantizer actually uses.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
cd "$ROOT"

resize_jpeg() {
  local src=$1 max=$2
  local tmp
  tmp=$(mktemp -t ashen-tex).jpg
  sips -Z "$max" -s format jpeg -s formatOptions 72 "$src" --out "$tmp" >/dev/null
  mv "$tmp" "$src"
  sips -g pixelWidth -g pixelHeight "$src" | paste -s -
  ls -lh "$src" | awk '{print $5, $9}'
}

resize_png() {
  local src=$1 max=$2
  local tmp
  tmp=$(mktemp -t ashen-tex).png
  sips -Z "$max" -s format png "$src" --out "$tmp" >/dev/null
  mv "$tmp" "$src"
  sips -g pixelWidth -g pixelHeight "$src" | paste -s -
  ls -lh "$src" | awk '{print $5, $9}'
}

resize_jpeg public/tex/forrest_ground_01/diff.jpg 512
resize_jpeg public/tex/rock_wall_08/diff.jpg 1024
resize_jpeg public/tex/wood_planks_grey/diff.jpg 512
resize_jpeg public/tex/bark_brown_02/diff.jpg 512
resize_png public/ashen-reach/foliage-atlas.png 1024

# Epitaphs are sampled at 160 px; JPEG at 768 is plenty vs a 4 MB PNG.
sips -Z 768 -s format jpeg -s formatOptions 72 public/ashen-reach/grave-face.png --out public/ashen-reach/grave-face.jpg >/dev/null
ls -lh public/ashen-reach/grave-face.jpg
echo "grave-face.jpg ready; point materials at it"
