# Milestone 3 — bounded actual-region appearance streaming

Status: local implementation and verification complete; production verification pending. This is the two-fit Human region path from milestone 2; broader wardrobe/race support and online presence remain later milestones. Do not treat this draft as the milestone exit or a public crowd-capacity claim.

## Policy and ownership

The bounded desktop proof reserves **32 unique actor request IDs**, including the active ID, and runs **one** native decode/upload/build at a time. A new revision for that active ID occupies its existing slot while native work drains; queued requests for the same ID coalesce. Priorities are local appearance 0, target/party 1, nearby 2, visible distant 3, refinement 4. Requests yield through the game's existing animation-frame boundary between preparations. Native glTF decode is uninterruptible; cancellation prevents its late commit rather than pretending the decode stopped.

At most **eight committed exact actors**, **two hidden idle exact containers**, and **one staging container** beyond the live/idle allowance are permitted. Retiring containers remain counted until asynchronous native pipeline builds settle. Two immutable VAT source owners are additional. Compatible idle containers reuse independently posed native skeletons; live same-fit shape revisions only update validated native weights, transform and source pose. They do not decode or rebuild pipelines. Immutable verified GLB/atlas bytes use an **8 MiB process-global ceiling**, shared leases and in-flight promises keyed by full SHA-256. Cancelling one consumer does not abort another; the final lease clears/aborts the fetch. Failed verification is retryable. Closed managers clear resolved byte promises and source-container references as well as native GPU owners.

The two fits require **4,589,720 verified source bytes** (two GLBs plus one shared atlas). Hashed prepared metadata adds **15,149 bytes** to publication. The preparation descriptor is bounded and pinned to **Lite 1.31.1 / appearance recipe 2**. Incoming actor identity and revision are separate from asset keys. An unsupported non-neutral shape stays exact; a new unsupported arrival reports pending/failure instead of displaying a neutral/wrong outfit. A failed or superseded replacement keeps the committed coherent actor. In-use resources are never eviction victims. This is a bounded proof source, not a full-outfit Cartesian product for the future item factory.

`streaming()` reports queue/caches/owners and deduplicated native mesh buffer/texture byte sizes, alongside known CPU typed-array storage. These are lower-bound referenced-resource sizes, not total driver memory: pipeline caches, allocation padding and pending native GPU fences remain outside them. OS browser/GPU/renderer RSS and JavaScript heap are tracked separately during endurance. Physical phone limits are unmeasured; lower runtime overrides are experiments, not a phone support claim.

## Completed checks so far

- Twenty-nine focused actor/direct-count/streaming/lifecycle tests pass (15 concern streaming/lifecycle), including active-ID replacement at capacity, same-fit live revision without another decode/build, independent cached-container reuse, capacity refusal preserving VAT, asynchronous-build/native-decode retirement and shared-consumer cancellation.
- Milestone 2's live regression retains sixteen exact/VAT source-row/world-transform checks at zero difference, action terminal holds, varied outfits, middle removal and complete teardown with no runtime/GPU errors.
- Ten initial eight-actor arrival/change/exit cycles passed. With the two-idle policy each wave converged in roughly 0.42–0.52 seconds; this was functional evidence collected with a source reviewer running, not an isolated FPS claim. The initial cold burst had a 34.7 ms interval; later cycles were 15.9–21.9 ms. Full isolated evidence is recorded separately below when complete.
- Fresh optional region requests at **10 Mbit/s / 80 ms** passed an injected HTTP 503, subsequent retry, two compatible consumers and cancellation of one consumer. The playable local body stayed identical; normal Havok movement advanced 8.42 m with zero recoveries and no GPU errors. Final shared byte count was zero.
- Developer build passes. Default entry imports/assets remain outside this optional renderer; new source publication does not imply the game waits for these assets before play.

Independent Grok 4.6/high review found two reproducible cases: active-ID replacement at a full queue and unnecessary same-fit exact decode/build. Both were fixed with additional tests before the 30-minute run. The resource ceiling includes retiring owners deliberately; its misleading eviction comment was corrected. The review snapshot predates later resource accounting, slow-link, churn and publication checks; these are parent-verified evidence, not claims attributed to the reviewer.

## Isolated endurance

The single-renderer 30-minute run completed **121 cycles over 1,813.187 seconds**. Each cycle admitted eight exact mixed-fit/shape actors, changed appearances, cancelled an older revision, removed middle members, exercised normal Havok input and departed. All 121 idle snapshots retained exactly four owners (two VAT sources and two hidden exact containers), with identical **9,095,664 buffer bytes / 10,335,776 texture bytes / 9,827,888 known CPU bytes**. Peak referenced buffers were 20,741,968 bytes and textures 21,021,440 bytes. These are referenced allocations, not total device memory.

Recorded arrival/change windows had p95 **10.1 ms**, p99 **14.5 ms**, maximum **33.0 ms**, with zero intervals above 33.33 ms. They are separate from settled solo throughput. JavaScript heap oscillated under collection (last ten minutes **53.19–92.84 MiB**); retained allocations were stable rather than merely an extrapolated short-run slope. GPU helper RSS was roughly 599–610 MiB; renderer RSS warmed from approximately 1,147 MiB into a 1,230–1,242 MiB final plateau. These OS measurements include engine/driver/shared mappings. Disposal returned manager owners, referenced allocation counters and shared source leases to zero. There were no recovery teleports or runtime/GPU errors.

The independent reviewer had ended before this run. No recording, encoding or other rendering game was running. A later priority-coalescing metadata correction and extraction of unchanged numeric constants were rechecked by focused tests; the endurance workload supplied its priorities explicitly.

## Isolated appearance and solo windows

Twenty same-fit single revisions took **0.2–0.5 ms** to commit, with native weights and no additional decode/build. Ten different-fit changes included one cold preparation (**33.3 ms** elapsed across frames; largest interval **15.5 ms**) and nine cache reuses (**0.2–0.5 ms**). The same-fit windows peaked at **14.9 ms**; no single-change window exceeded 33.33 ms. All used the published immutable descriptor on the actual world.

Fifteen settled solo runs (M1 Max, uncapped Chromium WebGPU, 1280×720/device scale 1, seven enemies, three 12-second runs on meadow/town/bridge/cathedral/forest, no recording) measured **197.1–235.9 mean FPS**, max interval **14.4 ms**, and zero intervals above 16.67 ms. Mean performance matches milestone 2 within noise; p95/p99 alternate between bursty and smoother runs, which is retained rather than discarded. One forest window was interrupted by an accidental Vite HMR after a comment edit; it was discarded and all three forest runs repeated with no source edits.

The final developer and staged Pages builds pass. Every pre-existing Pages artifact is byte-identical to the milestone 2 build except `_headers`; five optional publication files are added. The game entry graph and its startup assets do not import/fetch the optional renderer. Character/equipment suites pass **141/71** checks.

## Startup, publication and motion

Both fresh-process/profile local built-release cohorts (50 Mbit/s / 40 ms, 1280×720) retained all twenty rows. Default p95 **841.2 ms**, max **845.7 ms**, was 20/20 within one second. Largest saved outfit p95 **943.8 ms**, max **944.9 ms**, was **20/20** within one second. The grounded/dressed/GPU-completed/input-enabled boundary remains unchanged; neither OS nor driver caches were cleared. This is a local transport cohort, not a promise that the deferred public first-use GPU tail is fixed.

The reproducible publication adds two hash-named GLBs, one shared hash-named atlas, pinned hashed metadata and a mutable release manifest (4,604,869 bytes before the pointer manifest). Immutable files use one-year caching; the pointer uses no-cache. The lazy release descriptor avoids a mutable-manifest/version race. Future metadata changes must update the exact `_headers` JSON rule. Normal play does not import this renderer; networking will do so lazily.

Reviewed live motion is [VE](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/region-streaming-2026-10-01.mp4), Telegram **822**. The 739-frame recording preserves its actual **16.852-second** elapsed time, 1280×720 dimensions, square pixels and zero rotation. HTTP video/mp4, range seeking, playback and browser fullscreen passed. Telegram returned matching dimensions/duration; Telegram desktop playback is unavailable here. Two earlier arrangements were rejected for enemy/tree occlusion; the delivered meadow arrangement exposes arrivals, signed build revisions, outfit changes, cached promotion, superseded requests, departures and normal Havok movement after disposal. Recording is separate from FPS sampling.

## Evidence and release gate

Raw counters, tails, tests, captures manifest, publication/graph comparison and independent-review reconciliation are tracked in `docs/baselines/character-mmo/region-streaming-2026-10-01/`. Full frames/MP4 live under ignored `ve-capture/character-mmo/region-streaming-2026-10-01-v3/`; the public VE copy is the recovery path. Scripts reproduce the workloads from the accepted preparation.

Production deployment and artifact/movement/customization/touch/WebKit checks remain the final gate. Milestone 4 has not started implementation. Physical phone resource limits and the broad 100-actor throughput target remain unaccepted.
