# Production customization evidence — 2026-09-30

See the [milestone result](../../../plans/character-mmo/results/production-customization-2026-09-30.md) for interpretation and release status. Reports distinguish paired baseline, intermediate diagnostics and accepted final build. No frames or failures were discarded.

- `fps-baseline-final`, `fps-default-final`, `fps-stout-bounded` are the paired full-detail comparison. Each contains raw intervals for three 12-second runs on five routes, seven enemies, 1280×720, isolated uncapped Chromium WebGPU on M1 Max, without recording.
- `fps-*-tail-confirmation` investigates differing uncapped pacing bands; these are confirmations, not replacements for the original rows.
- `promotion-final` samples first live family promotion separately from settled FPS and recording.
- `functional-final` includes failed downloads, serialized controls, intermediate/end values, height/capsule, races and saved outfits. Intentional HTTP 500s are negative controls.
- `compact-visual` identifies four compact/full pairs reviewed in the live renderer. PNGs and larger captures remain in ignored task capture storage; published motion is linked in the result.
- `cold-largest.json` is the rejected full-clothing startup strategy. `cold-largest-release.json` is the rejected first compact pass in the final runtime bundle. The next compact pass is ordinary multi-entry preflight `cold-*-accepted.json`; the final release gate uses exact Pages packaging `cold-pages-*.json`.
- `seed-*` identifies the actual saved recipes. Cold reports include first-playable shape/outfit, movement, timestamps and all outliers. Fresh browser cache does not clear OS/driver/CDN caches.
- `final-source-tree` records the index export used for the final clean reproduction. No `.cache` inputs existed in that export; canonical images and assets were included. Node 22.18.0 reproduced the manifest byte-for-byte and the clean build passed.
- Review markdown records independent Grok 4.6/high findings and parent resolutions. Workers started no renderer.

Physical iPhone acceptance and crowd capacity are not measured by these desktop reports. Runtime resources and rollback identity are separate production release checks.

`fps-stout-release.json` is an interrupted final preflight: the rolling 600-sample HUD suggested 240 Hz at cathedral run 2, while the preserved full 12-second sample measured 228.55 FPS and `detectVsyncCap` returned false. The benchmark now retains both rolling/full diagnostics and judges the full window. `fps-pages-*` records the exact Pages build with this corrected protocol. The earlier ordinary multi-entry builds included diagnostic pages; only `cold-pages-*` supplies the final production-build startup gate.

The reviewed-motion candidate uses `record-production-customization.mjs`: 20 endpoint/outfit combinations (including the largest Pilgrim mix), actual Fire Blast/Lava Ball windups, compact clothing movement before refinement, and three race changes. The first recording attempt exposed a Playwright route-handler teardown race; it was retained locally as a failed capture. The finished recording waits for pending handlers before unroute. Performance is sampled separately.

Production verification is for game source `59c08da`, Pages deployment `378af1f5-609a-416e-ad3d-5636dbf13c2b`; later documentation commits do not identify a different deployed bundle. `production-resources` checks all 251 executable/critical resources. `production-functional` repeats all 33 appearance cases; `production-traversal` checks spawn movement and cathedral entry/return at the four build/height endpoint pairs. `production-mobile` and `production-webkit` are desktop touch/WebKit functional checks, not physical-phone acceptance.

`cold-production-native-*` adds twenty fresh-process **unthrottled public-URL** starts for default and largest saved outfit. The original five rows and all fifteen continuation rows are retained. Default p95/max is 1,012.4/8,291.1 ms (18/20 <=1 second); largest is 1,030.9/1,455.2 ms (16/20). These miss reliable public one-second startup despite the local gate passing. First-GPU-completion outliers and input response tails remain open; no rows are discarded or substituted.

`ownership.json` records the final closed browser/server state and every cold probe's closed ownership marker. Unrelated MCP servers and Chrome's crashpad helper were left intact.
