# Ashen Reach baseline before the Babylon Lite upgrade — 2026-09-25

This captures the live game at source commit `e8ea4b5`, with locked `@babylonjs/lite` **1.28.0** and `@babylonjs/havok` **1.3.14**. It is the comparison point for [the 1.31.1 migration plan](babylon-lite-1.31.1-migration-plan.md). The game runtime and art were not changed to collect this baseline. The benchmark script was strengthened to save every frame interval and reject runs without active physics, movement, the expected canvas/enemies, or an uncapped browser.

## Conditions and interpretation

- Apple M1 Max Mac, macOS Darwin 25.6.0 arm64; Chromium **153.0.8010.54**, headless, WebGPU, uncapped with the harness's frame-limit and GPU-vsync disabling flags. The Mac system report identifies the Apple M1 Max GPU; the browser did not expose a nonempty adapter description.
- Local game URL from isolated harness slot 9: `http://127.0.0.1:6073/ashen-reach.html?play&clean`. Browser viewport **1280×720** and verified render canvas **1280×720** on every run. Seven enemies and Havok active. The runner sets `ASHEN.dev.god=true` to keep combat damage from stopping the walking route.
- Town, bridge, cathedral, and forest each had three **12-second** walks after a 1.5-second moving warmup. The runner places the player at a route start, then holds the normal `W` key. No recording ran during measurement. Each run moved at least **44 m**, with **zero recovery teleports**, and reported no runtime or GPU errors. No run was frame capped.
- FPS is calculated from the measured render-loop frame intervals. These figures measure throughput on this machine and browser, not display-refresh presentation or independent GPU execution time. Compare with a new baseline on the same setup after the dependency change; GPU timestamp behavior itself changes in Lite 1.31.0.
- A separate foreign-worktree Chrome game page was open on harness slot 6 while these runs took place. Its actual GPU activity during each run was not measured, and it was left untouched. Treat the results as an observed baseline with possible competing GPU work. Repeat the paired 1.28/1.31.1 performance comparison under verified quiet conditions before using a small FPS difference to accept or reject the migration.

## Frame pacing

| Route | FPS, runs 1 / 2 / 3 | Mean FPS | Worst run p99 | Worst frame | Frames over 16.67 ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Town | 177.66 / 178.25 / 178.36 | **178.09** | 12.30 ms | **22.40 ms** | 1 |
| Bridge | 219.44 / 216.84 / 216.87 | **217.71** | 9.80 ms | 14.00 ms | 0 |
| Cathedral | 226.15 / 225.67 / 224.63 | **225.48** | 9.90 ms | 10.80 ms | 0 |
| Forest | 189.60 / 190.59 / 191.63 | **190.60** | 11.70 ms | 15.70 ms | 0 |

The lone frame over 16.67 ms occurred in town run 3 at approximately **391 ms** after measurement began. Its neighboring intervals were about 5.9, **22.4**, 3.4 and 2.1 ms. This capture does not establish its cause. The route's three-run FPS was stable, while its frame-time tail remains a useful migration comparison.

The full per-run report, including p95/p99, movement, canvas, enemies, physics state and spike positions, plus all 12 raw frame-interval series, is in [performance-raw.tar.gz](baselines/lite-1.28.0-2026-09-25/performance-raw.tar.gz). The uncompressed local working artifacts are under `ve-capture/ashen-reach/lite1311/baseline/` and are ignored by Git.

## Load timing

The load probe used a separate Chromium page at **1280×720 CSS pixels**, device-pixel ratio 1, with the game's default **960×540 internal canvas**. The harness-created tab in its owned slot was moved to `about:blank` before the valid measurements, so it did not render a second copy of the game. Browser cache was cleared before each cold set; warm runs navigated in the same context with service workers blocked. The local Vite server had already started and transformed the game when its browser-cache cold run began. Production used the currently deployed `ashenReach-COxFpJlG.js`, separate from the local source checkout.

Times below are milliseconds or seconds **from navigation start**, except resource transfer. First contentful paint is the loading page appearing; first game frame comes from the first observed `ASHEN.gpu.frames > 0`. “Ready” is the first observation of both `ASHEN.ready` and `ASHEN.hostilesReady`.

| Target | Browser cache | First contentful paint | First game frame | Ready to play | Resource transfer |
| --- | --- | ---: | ---: | ---: | ---: |
| Local Vite | Cleared | 56 ms | 8.99 s | **10.48 s** | 23.56 MB |
| Local Vite | Warm 1 | 80 ms | 8.59 s | **10.01 s** | 36.3 KB |
| Local Vite | Warm 2 | 80 ms | 8.61 s | **10.04 s** | 36.3 KB |
| Production CDN | Cleared | 8.74 s | 34.99 s | **50.80 s** | 11.50 MB |
| Production CDN | Warm | 0.74 s | 10.52 s | **17.60 s** | 4.5 KB |

All five valid loads reached readiness without a page error, failed request or HTTP error. Each had **five startup requestAnimationFrame gaps over 50 ms**, and the largest gap was **6.24–6.47 seconds**. These gaps occur during loading and are separate from steady-state gameplay frame times. Resource timing shows the cold production body asset request took 8.06 seconds and the game bundle 4.15 seconds; the capture does not attribute the full 50.80-second load to those requests or identify the cause of the remaining wait. One production cold and one warm navigation are observations, not a latency distribution. Browser/network/edge conditions can change between releases.

The complete [local load report](baselines/lite-1.28.0-2026-09-25/load-local.json) and [production load report](baselines/lite-1.28.0-2026-09-25/load-production.json) retain navigation, paint, asset requests, startup frame gaps, source version and conditions. [The exact probe source](baselines/lite-1.28.0-2026-09-25/load-probe-source.tar.gz) is archived for repeat measurements. The initially observed highly variable runs were discarded after discovering a second game tab rendering in the probe's own Chrome instance; all table values come from the corrected runs with that tab blank.

## Visual and gameplay snapshots

The [contact sheet](baselines/lite-1.28.0-2026-09-25/contact-sheet.jpg) shows ordinary live gameplay views. Local Chromium WebGPU used the standard game camera, a **1280×720 CSS viewport**, and the game's **960×540 internal canvas**. Diagnostic placement set each starting pose. The portrait view used Chromium touch emulation at **390×844 CSS pixels**, device-pixel ratio 3, and a **292×633 internal canvas**. It is not physical iPhone acceptance.

| View | Capture |
| --- | --- |
| Churchyard | [PNG](baselines/lite-1.28.0-2026-09-25/shots/churchyard.png) |
| Town plaza | [PNG](baselines/lite-1.28.0-2026-09-25/shots/town-plaza.png) |
| Bridge approach | [PNG](baselines/lite-1.28.0-2026-09-25/shots/bridge-approach.png) |
| Cathedral silhouette | [PNG](baselines/lite-1.28.0-2026-09-25/shots/cathedral-silhouette.png) |
| Cathedral portal | [PNG](baselines/lite-1.28.0-2026-09-25/shots/cathedral-approach.png) |
| Cathedral nave | [PNG](baselines/lite-1.28.0-2026-09-25/shots/cathedral-nave.png) |
| Woodland tree detail | [PNG](baselines/lite-1.28.0-2026-09-25/shots/woodland-detail.png) |
| Forest performance route context | [PNG](baselines/lite-1.28.0-2026-09-25/shots/forest-performance-route.png) |
| Portrait touch layout | [PNG](baselines/lite-1.28.0-2026-09-25/shots/mobile-portrait.png) |

The reviewed [11.334-second live cathedral traversal MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/lite128-baseline/2026-09-25-cathedral.mp4) follows real `W` input from the bridge into the nave (z 248.97→325.98). It is **1280×720**, square pixels, H.264, with no rotation. Sampled beginning, middle, and end show continuous motion without a loading break or collision jump. Havok stayed active, no recovery teleport was recorded, and no page or console errors appeared. Chromium direct playback confirmed the video dimensions and advancing time; VE returned `video/mp4` and a successful byte-range response. Telegram message **767** returned matching **1280×720** dimensions and **11.334 s** duration. The [visual report](baselines/lite-1.28.0-2026-09-25/report.json), [capture manifest](baselines/lite-1.28.0-2026-09-25/capture-manifest.json), and [capture source](baselines/lite-1.28.0-2026-09-25/visual-probe-source.tar.gz) retain poses, dimensions, timestamps, and error arrays.

These images preserve the current dark but readable nave, hillside tree silhouettes, bridge masonry, and mobile controls for side-by-side review. The woodland still at `(72, 190)` showed 27 tiles, eight at full detail, and 419,872 rendered triangles. The forest performance route at `(130, -50)` points toward a cliff and shows little tree detail; the separate northern woodland still covers that visual comparison. The stills and short clip do not establish full-region visual acceptance.

A second [16.173-second motion baseline](https://ve.sparkify.dev/wow-clone/ashen-reach/lite128-baseline/2026-09-26-migration-matrix.mp4) exercises the exact production bundle `ashenReach-COxFpJlG.js`: town lamps and walking, Graveweaver equipment, diagnostic chest hit, targeted Fire Blast, cathedral wall camera obstruction, ordinary cathedral approach movement, and northern woodland. Diagnostic placements between segments are logged; each walking segment uses normal controls. The camera radius shortened to 11.19 m from a requested 20 m at the wall. The production capture kept Havok active, seven enemies, a 1280×720 canvas, and zero recovery teleports, request failures, runtime errors, or GPU errors. The encoded H.264 file is 1280×720, square-pixel, with zero rotation; VE returned `video/mp4` and byte-range playback. Direct Chromium playback reported 1280×720 dimensions, 16.173 s duration, advancing time, and no media error. Telegram message **768** returned matching dimensions and duration. Its [contact sheet](baselines/lite-1.28.0-2026-09-25/m0-motion/contact.jpg), [capture report](baselines/lite-1.28.0-2026-09-25/m0-motion/report.json), [timestamp manifest](baselines/lite-1.28.0-2026-09-25/m0-motion/capture-manifest.json), and [capture driver](../scripts/ashen-reach/record-lite-migration-baseline.mjs) preserve the procedure and observations.

## M0 trust checks — 2026-09-26

At M0 start, HEAD was `30d205c` with no unrelated working changes. Installed and locked Lite were both 1.28.0; installed and locked Havok were both 1.3.14. The M1 Max and Chromium version are recorded above. Cloudflare Pages production deployment was `6a174b2a-4885-42da-aa11-9991641858c2`, serving `ashenReach-COxFpJlG.js`.

The URL-corrected contact-occlusion and local-light checks visited the intended clean 1.28.0 worktree at `http://127.0.0.1:6673/ashen-reach.html?play&clean`. The [nine-check matrix summary](baselines/lite-1.28.0-2026-09-25/summary.json) and [exact runner commands](baselines/lite-1.28.0-2026-09-25/matrix-command.sh) cover camera, HDR, sun, contact, local lights, cathedral exploration, region traversal, injected mobile depth fallback, and desktop WebKit: **9/9 exited successfully** with no recorded runtime or GPU errors. All **eight** region destinations were entered and exited with Havok active and no recovery teleport. The mobile result is desktop emulation; a physical iPhone was not tested.

A clean build from `30d205c` served `ashenReach-yX9Pxf29.js` and passed the [built-runtime smoke](baselines/lite-1.28.0-2026-09-25/m0-built-runtime.json): seven enemies, active Havok, shadows, 1280×720 canvas, and 14.02 m of normal walking with no recovery. Its first isolated-worktree build had failed to copy 120 symlinked public textures; Vite served fallback HTML at those image URLs and image decoding failed. Materializing those assets with `rsync -aL` before rebuilding resolved the failure. The corrected build is the only one used for the passing report.

The [enemy collision baseline](baselines/lite-1.28.0-2026-09-25/m0-enemy-collision.json) passed in the clean slot. That narrow probe is sensitive to solver/frame pacing: the same check also failed in another slot with untouched 1.28.0 HEAD as the player slid laterally around the enemy. Treat a single pass/fail of this script as insufficient proof of a physics regression without a same-slot control.

Offline character tests initially failed because their strict one-buffer fixture parser was fed the checked-in meshopt-compressed two-buffer GLB. The fixture and validator scripts now decode that asset in memory before passing it to the legacy parser; game assets and the live loader are unchanged. Two equipment tests also still expected 55 clips although the shipped set contains 57. With those test assumptions corrected, **76 character, 47 equipment, and 89 focused world/runtime tests pass** on Lite 1.28.0. The normal build passes.

## Reproduce

Use an unused `scripts/harness/up.mjs --slot N --headless --uncapped` slot and the Vite/CDP ports it prints. The slot 9 numbers above describe this capture and are not a fixed requirement. Save a new report under a distinct directory so the 1.28 data remains intact.

```sh
ASHEN_CDP_PORT=<printed CDP port> \
ASHEN_TEST_URL='http://127.0.0.1:<printed Vite port>/ashen-reach.html?play&clean' \
ASHEN_BASELINE_COMMIT=$(git rev-parse --short HEAD) \
node scripts/ashen-reach/measure-region.mjs ve-capture/ashen-reach/<pass>/performance.json
```

The runner writes a report and `route-run-frames.json` for each run. Resolve all assertions and inspect error arrays before using a result as a comparison. End the owned slot with `node scripts/harness/down.mjs --slot N` after capture.
