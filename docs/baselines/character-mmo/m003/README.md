# M003 crowd baseline files

Read the [decision report](../../../plans/character-mmo/results/m003.md) before comparing numbers. All FPS rows are M1 Max, uncapped Chrome WebGPU `requestAnimationFrame` intervals, no recording. Each completed flat cell has three 12-second runs after a two-second warm-up. The real canvas is 1280×720. The named JSON cells include p50/p95/p99/max, threshold counts, the Lite draw-submission counter, frustum-center counts and ancillary sampled GPU timing. Each `rawFile` points to a gzip JSON array of **all** intervals for that run. The raw directory also contains the 60-second churn stream.

- `crowd-100-repeat.json`, `crowd-300-repeat.json`, `crowd-1000-repeat-vat.json`: repeated dressed Human, independent where feasible and VAT.
- `crowd-100-mixed.json`, `crowd-300-mixed.json`, `crowd-1000-mixed.json`: alternating Wayfarer/Warden, idle/walk. `crowd-1000-repeat-independent-rejected.json` preserves the safety-budget rejection.
- `crowd-100-mixed-shadows.json`: fresh flat-scene CSM focus test; dynamic shadow replacement has a separate visual defect.
- `prepared-assets.json`: exact source/item/output hashes, triangle counts, source recipe and license. Prepared GLBs remain ignored in `.cache/character-mmo/m003` and can be reproduced with `node scripts/character-assets/prepare-crowd-probe.mjs`.
- `churn.json`, `cancellation.json`: swaps, ten disposal cycles and a canceled concurrent build. `capture.json` and `delivery.json` record the reviewed MP4 dimensions, timestamps, hash, Telegram response and VE URL.
- `failed-town/attempt.json`: retained **invalid** post-mount intervals and the one-actor reproducible production shadow-composition error. Its baseline intervals precede that error.
- `experimental-shadow-exclusion/`: a temporary source edit excluded VAT meshes from the custom CSM caster list, then was **reverted**. Its 1280×720 and 960×540 paired town runs are diagnostic only and cannot be quoted as committed-product capacity. The camera projects 100/270 centers for the 100/300 cells at 1280×720; building occlusion was not counted.
- `occluded-town/`: early shadow-exclusion trial from behind a gate; the foreground obscured the crowd and the post-disposal pair was interrupted. It is not accepted capacity evidence.

The benchmark browser was Chrome PID 38613, CDP 10037, using Vite 5873; the unrelated Chrome PID 3538 on CDP 9337 had blank pages. The owned tab was returned to `about:blank` after each run. The final process shutdown is in the result report. Physical iPhone capacity, system RAM, total resident GPU memory and independent per-frame animation-evaluation time were not measured; their absence is explicit rather than filled with estimates.
