#!/bin/zsh
set -u
export ASHEN_CDP_PORT=10837
export ASHEN_TEST_URL='http://127.0.0.1:6673/ashen-reach.html?play&clean'
export ASHEN_URL="$ASHEN_TEST_URL"
out='ve-capture/ashen-reach/lite1311/baseline/m0-checks'
mkdir -p "$out"
run_check() {
  local name="$1" source_dir="$2"; shift 2
  echo "START $name $(date -u +%FT%TZ)"
  "$@" > "$out/$name.stdout.log" 2> "$out/$name.stderr.log"
  local result=$?
  echo "$result" > "$out/$name.exit"
  if [[ -d "$source_dir" && "$source_dir" != "$out/$name" ]]; then
    mkdir -p "$out/$name"
    cp -R "$source_dir"/. "$out/$name"/
  fi
  echo "DONE $name exit=$result $(date -u +%FT%TZ)"
}
run_check camera "$out/camera" env ASHEN_CAPTURE_DIR="$out/camera" node scripts/ashen-reach/check-camera.mjs
run_check hdr 've-capture/ashen-reach/hdr/check' node scripts/ashen-reach/check-hdr.mjs
run_check sun 've-capture/ashen-reach/sun-shadows/lite128-m0' node scripts/ashen-reach/check-sun-shadows.mjs --tag lite128-m0
run_check contact 've-capture/ashen-reach/contact-occlusion/lite128-m0' node scripts/ashen-reach/check-contact-occlusion.mjs --tag lite128-m0
run_check local 've-capture/ashen-reach/local-lights/check' node scripts/ashen-reach/check-local-lights.mjs
run_check exploration "$out/exploration" env ASHEN_CAPTURE_DIR="$out/exploration" node scripts/ashen-reach/check-exploration.mjs
run_check region "$out/region" env ASHEN_CAPTURE_DIR="$out/region" node scripts/ashen-reach/check-region.mjs
run_check mobile_fallback 've-capture/ashen-reach/iphone-regression/chromium-depth-fallback-runtime' node scripts/ashen-reach/check-mobile-runtime.mjs --inject-depth-bundle-failure
run_check webkit 've-capture/ashen-reach/iphone-regression/webkit-runtime' node scripts/ashen-reach/check-mobile-runtime.mjs --webkit
