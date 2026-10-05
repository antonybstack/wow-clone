# M5 startup packaging and timing evidence

Source base: `ce63e62ccb670929132efe82b0470ec584f6fb9a`, with this checkpoint's
native Rolldown grouping, build guards and probe corrections. Babylon Lite 1.31.1,
Havok 1.3.14, Vite 8.2.2; Apple M1 Max, Chromium 154, WebGPU, 1280×720/DPR 1.
The `build-seal.json` is the **ordinary multi-entry local build** measured here.
Do not substitute it for a Pages staging/public-CDN release receipt.

## Preserved evidence

- `cold-*-20.json`: six final cohorts, twenty fresh browser processes/profiles
  each, 50 Mbit/s down / 10 Mbit/s up / 40 ms latency, no CPU throttle. Actual
  selected source, native root/morphs, eyes/brows/hair visibility, retained groups,
  grounded Havok, completed GPU frame and input readiness are checked. Raw
  timings/waterfalls/outliers remain in every file. `cold-summary.json` uses
  nearest-rank p95. Final rows all finish within one second locally.
- `cold-*-pilot.json`: preceding default, unchanged largest saved ponytail,
  rejected module-preload hint and intermediate grouped pilots. The 2,930 ms
  first-use row is retained. Intermediate grouped pilot is not final acceptance:
  the held-Lite check subsequently caught an early dependency regression.
- `fps-*.json`: nine cohorts × five routes × three 12-second runs, seven enemies,
  no recording, actual Havok movement and canonical saved recipes. Raw positive
  frame intervals are preserved. `fps-summary.json` includes pooled route tails,
  matched pairs and **all** full-window/rolling near-refresh cap hints.
  Telegram playback was paused before the batch but found resumed afterward;
  its restart time is unknown. These are provisional tail comparisons, not a
  continuously monitored quiet-machine release gate.
- `repeat-*.json`: affected route comparisons after pausing Telegram again,
  checking no other game/playing media before each helper, and retaining every
  repeat. Original/selected neutral compare meadow and bridge; tall/slender
  largest compare town; short/stout largest compare cathedral. These do not
  replace a complete final Pages/public release cohort.
- `seed-*.json`: exact canonical saved recipes, including matched height/build,
  equipment and dye controls. An empty helmet has no helmet dye. The largest
  outfit means this mixed eight-slot fixture, not an interchangeable preset.
- `prefetch-live.json`, `saved-live/report.json`, `mobile/*/report.json`: actual
  built-page functionality, native early identity and desktop emulation/WebKit.
  Mobile reports are not physical-phone or performance acceptance.
- `pages-build-seal.json`, `pages-native-verified.json`, `pages-prefetch.json`,
  `pages-saved-live/`, `pages-mobile-webkit/`: the separately staged native Pages
  build, served byte/cache matches and actual early/saved/WebKit cases.
- `pages-startup-motion/`, `pages-startup-media.json`, `telegram-delivery.json`,
  `ve-verified.json`, `playback-review.json`: final live Pages recording and public
  motion delivery/actual play/seek/proportion review. No FPS claim from recording.
- `hair-tip-control/`: diagnostic static walk comparisons only; no reproduction
  of the moving back patch and no assertion that its photographed labels match.
- `build-verified.json`: exact browser-negotiated compressed executable/critical
  resources; `build-seal.json`: every local artifact hash and the unchanged 286
  art/physics payloads against the saved-fit checkpoint. JS packaging differs.
- Character/startup logs and the bounded Grok read-only report. Review limits and
  parent dispositions are in the linked review; Grok did not accept the pixels
  or final cohorts independently.

Representative PNGs are unedited actual first-play/mobile captures. They are
review aids. Timestamped live startup MP4 delivery is recorded in the result;
recording is excluded from all timing acceptance. No private Telegram UI capture
is persisted here.

## Reproduce

Audit OS processes, browser game pages and playing media first. Reuse one owned
uncapped harness, park its initial page `about:blank`, and run helpers sequentially.
See [ownership](../../../../debug-view.md#browser-ownership-and-performance-isolation).
Build once, restart `scripts/ashen-reach/serve-startup-preview.mjs` after **every**
build, then verify compressed bytes with `scripts/verify-pages.mjs` before probes.

```sh
npm run build
ASHEN_PREVIEW_PORT=7174 node scripts/ashen-reach/serve-startup-preview.mjs dist
# Separate terminal; supplied port must be the audited owned harness.
ASHEN_RELEASE_URL=http://127.0.0.1:7174 node scripts/verify-pages.mjs /tmp/build-verified.json
ASHEN_TEST_URL=http://127.0.0.1:7174/ ASHEN_PROBE_RUNS=20 \
  ASHEN_PROBE_APPEARANCE=docs/baselines/character-mmo/m5/isolated-timing-2026-10-05/seed-prime-ponytail-largest.json \
  node scripts/ashen-reach/probe-playable-startup.mjs /tmp/cold-pony.json
ASHEN_CDP_PORT=10037 ASHEN_TEST_URL=http://127.0.0.1:7174/ \
  ASHEN_FPS_RAW=1 ASHEN_RECORD_CAPPED=1 \
  ASHEN_BENCH_APPEARANCE=docs/baselines/character-mmo/m5/isolated-timing-2026-10-05/seed-prime-ponytail-largest.json \
  node scripts/ashen-reach/measure-region-fps.mjs /tmp/fps-pony.json
```

Use the current helper's arguments/environment, close its owned contexts and stop
the harness/server afterward. Fresh browser cache does not clear OS/GPU-driver
caches. Local HTTP/1.1 packing gains do not establish public HTTP/2/3 CDN gains.
`ASHEN_BOOT_BUNDLE=0` disables only the native boot group; it does not recreate
every previous packaging setting. No quality setting, source curve or art pin
was reduced for this checkpoint.
