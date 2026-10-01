# Public startup margin and GPU completion — 2026-09-30

Follow-up to [production customization](production-customization-2026-09-30.md). Performance and the actual saved character at first play remain the constraints. Baseline game source is `59c08da`; documentation/source review starts from `7df62e2`. No GPU backend, animation, clothing, collision, camera, lighting or world-quality change is proposed.

## Implementation plan and evidence boundary

1. Separate document/module transport, device acquisition, CPU pipeline API calls, submitted queue work and callback delivery. Add optional probe-only instrumentation and Chrome/Dawn traces; keep normal cohorts free of it. Preserve every first-run outlier.
2. Compare the unchanged release and one candidate in sequential A/B/B/A blocks on immutable Pages hosts. Attribute stage changes with request timings, rather than claiming all end-to-end variance is the code change. Browser profiles are fresh; CDN/OS/driver caches are uncontrolled.
3. Remove demonstrated serial discovery on saved-character startup. Run the existing strict appearance migration/validation and existing compact asset fetch/decompression before the renderer graph finishes downloading, sharing their exact promises with normal startup. Unsaved default play must load neither optional storage/editor code nor the Human shape family before play.
4. Verify four 20-process local 50 Mbit/s/40 ms cohorts, actual selected appearance at the dressed/grounded/GPU-completed/input boundary, failure/retry/migration behavior, normal movement, the complete solo FPS routes, touch/WebKit and reviewed motion. Release only the measured improvement through the existing Pages workflow, retaining rollback metadata and matching executable/critical resource checks.
5. Preserve the first-use GPU stall as an explicit unresolved limitation unless an actual cold trace attributes and fixes it. Do not drop the first run, substitute submission for completion, hide the saved silhouette, or re-enable the previously negative async/shadow trials without evidence.

## GPU findings

The initial production report's default first run completed at **8,291 ms**, with approximately **7,555 ms** between supported submission and callback. This investigation reproduced **9,745 ms** public first play (device acquisition roughly **1,596 ms**, first queue callback roughly **7,272 ms**), then **603/647 ms**. JS pipeline API calls were at most approximately **0.1 ms**, so their CPU durations do not explain the stall. The unchanged local compressed build also reproduced **8,150 ms**, followed by approximately **930–940 ms**. A fresh public comparison's baseline first row reproduced **9,464 ms**. All these rows remain in the reports.

Warm Chrome traces show `CrGpuMain` WebGPU command tasks of approximately **74 ms** and cache/worker events, but have not captured the multi-second hole. This supports a GPU-service/backend first-use hypothesis; it does **not** identify one shader, prove Metal compilation as the cause, or establish a fix. Queue acknowledgements also include delivery of a browser task; they are not GPU timestamp measurements. `world-start`→`world-end` includes awaited transport/decoding/upload work and must not be called CPU time alone. Extra desktop/simulator compiler services are not proof of another game rendering.

The [earlier asynchronous shader trial](../../../archive/plans/rendering-performance-investigation-2026-09-26.md) remains a negative result for its workload. Native `enableAsyncShaderPipelineCompilation` covers eligible ShaderMaterial registration, not all PBR/post/first-use work. It stays disabled. [WebGPU queue completion](https://developer.mozilla.org/en-US/docs/Web/API/GPUQueue/onSubmittedWorkDone) fences earlier submissions; [asynchronous pipeline creation](https://developer.mozilla.org/en-US/docs/Web/API/GPUDevice/createRenderPipelineAsync) can move compilation off the first-use path, but that alone does not establish lower end-to-end startup.

The optional probe records adapter/device acquisition, shader/pipeline calls, queue submission/fence identity and animation callback CPU duration. `ASHEN_PROBE_GPU_EVENTS=1` and `ASHEN_PROBE_CHROME_TRACE=1` are diagnostic only. Dawn tracing includes its [disabled category](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/gpu/command_buffer/service/dawn_service_serializer.cc). An optional [Chromium shader-disk-cache switch](https://chromium.googlesource.com/chromium/src/+/HEAD/gpu/config/gpu_switches.cc) is explicitly reported and excluded from ordinary acceptance. Neither switch changes production code.

## Deferred follow-up — 2026-09-30

The user explicitly directed: “you can move on to milestones, just record this to followup later.” Milestone 2 crowd correctness is now active; this unresolved startup tail is retained without blocking its entry.

- Preserve released source `b362dbc`, production deployment `60c0ca70-6575-4cd6-a717-b99984c9964f`, all baseline/candidate rows and the completed-GPU/dressed/grounded/input boundary. The released largest-outfit first row submitted at **581.7 ms** and completed at **1,245.7 ms**, approximately **664 ms** apart; actual first play reached **1,248.3 ms**. Earlier unchanged runs reached 8.15–9.75 seconds. These are different observations, not proof of one cause.
- Resume with an isolated, actually slow GPU-service trace, correlating queue submission, backend/device spans and browser callback delivery. Compare unchanged builds and fresh processes; report uncontrolled OS/driver/CDN caches. Warm traces and disappearing outliers cannot establish a fix.
- Revisit native asynchronous compilation or shadow scheduling only if that trace identifies applicable work; previously negative trials remain disabled. Physical iPhone startup remains a separate measurement.
- This attempted continuation obtained no new game trace or benchmark. Shell process enumeration/external DNS were blocked, and Vite could not listen on localhost (`EPERM`). Browser approval review rejected raw CDP tracing on `play.sparkify.dev`, stating permission was declined. The owned diagnostic favicon tab was closed; no game renderer was started. Do not circumvent these denials through another runtime or browser surface.


## Measured loading change

A saved character previously awaited the full game graph, then dynamically discovered the appearance store/contract, then its manifest and selected body/clothes. The new small asynchronous HTML entry invokes that **same** strict store/migration API and starts the **same** compact asset requests. Main reuses its result, manifest and asset/decompression promises. Saved neutral/race/recoverable-fallback records also start the starter they already use in main. Missing compact pieces fail explicitly. Speculative failures can retry through the same loader; untrusted storage supplies item identifiers, never fetch URLs. GPU scene ownership and the playable boundary remain in main.

Two initial packaging attempts failed to improve startup and are retained as diagnostics. Vite merges ordinary HTML module scripts into the game entry. Separating the entry was necessary, but Rolldown's recursive groups initially pulled Vite's preload helper into Lite and the equipment catalogue into the appearance-storage group. That made early requests wait for the renderer and made default play fetch optional storage. Explicit native groups with `includeDependenciesRecursively:false` and a priority for the preload helper correct these dependency boundaries. Post-generation build checks reject renderer/optional-storage imports in the early entry, optional appearance imports in main, duplicated shared startup modules and missing compiled provenance guards. The diagnostic ungrouped-Lite build passes the same graph checks. Default cohort request logs verify the other direction. Applicable [Vite build](https://vite.dev/guide/build.html#multi-page-app), [Rolldown grouping](https://rolldown.rs/reference/TypeAlias.CodeSplittingGroup) and [async script](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script#async) links are beside the relevant code. No alternate character loader, codec or rendering engine was added.

## Public paired comparison

Twenty fresh native/unthrottled Chrome processes per identity and source, M1 Max, 1280×720, A/B/B/A blocks of ten. Baseline `378af1f5.fardel.pages.dev`; candidate preview `05b396f7.fardel.pages.dev` (uncommitted candidate based on `7df62e2`, not the final source commit). Hosts share the Pages project but differ in hostname/cache history. No timing run records video, and only one game page renders at a time.

| Identity | Baseline p95/max ms | Candidate p95/max ms | <=1 second, baseline→candidate |
| --- | ---: | ---: | ---: |
| Default | 841.3 / 9,464.3 | 707.5 / 951.7 | 19/20 → 20/20 |
| Largest saved outfit | 751.8 / 1,447.9 | 673.9 / 780.9 | 19/20 → 20/20 |

Saved-manifest discovery demonstrably moved earlier. The full default p95 difference and candidate's lack of a first-use outlier cannot be attributed entirely to the source change: uncontrolled cache/backend state and host variance remain. These batches establish useful public margin in this experiment, not universal one-second loading or a repaired cold-GPU driver.

## Final verification

Two read-only Grok 4.6/high reviews are preserved with the [parent resolution](../../../baselines/character-mmo/startup-gpu-2026-09-30/review-resolution.md). The optional-chain provenance concern was not reproduced in generated code; valid sharing, neutral-prefetch, malformed-piece and test coverage findings were addressed. Native grouped and diagnostic ungrouped-Lite builds pass the graph/provenance checks. The final targeted suite passes **32 tests**; earlier character/equipment suites pass **141/71**. The eight native early-request/migration/stale-manifest cases and 33 customization cases pass. Four body endpoints enter and leave the cathedral on normal controls, zero recovery teleports. Native mobile-sized Chromium touch/depth fallback and desktop WebKit pass with the largest saved outfit; physical iPhone acceptance remains distinct.

M1 Max, isolated uncapped Chromium WebGPU, actual 1280×720, seven enemies, three 12-second runs per route, no recording:

| Route | Baseline FPS | Final neutral FPS | Final largest-body FPS |
| --- | ---: | ---: | ---: |
| Meadow | 197.3 | 197.3 | 195.7 |
| Town | 197.6 | 197.5 | 198.1 |
| Bridge | 235.8 | 235.6 | 233.3 |
| Cathedral | 233.5 | 233.5 | 228.4 |
| Forest | 219.1 | 219.0 | 216.8 |

The largest-body FPS fixture is height **1.15**, build **+0.95**, starter outfit. The largest saved-outfit startup fixture is independently height **0.90**, build **−0.95**, with the hood/mixed cloth/skirt/gloves/staff/book loadout recorded in its recipe; “largest outfit” denotes prepared mesh payload, not maximum stature.

Neutral mean changes stay below 0.1%. Largest-body runs are within 2.3% of the neutral baseline. Maximum settled intervals are **12.6 ms neutral / 15.2 ms largest body**, zero >16.67 ms; worst run p95/p99 intervals are **10.3/11.1 ms neutral** and **10.7/11.4 ms largest body**. This is uncapped throughput, not a guarantee every frame meets 144 Hz. Raw full-window/tail results are retained.

Reviewed [live startup and movement](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/startup-gpu-2026-09-30.mp4) is Telegram **819**, explicit returned **1280×720** dimensions, **19.175 s**, square pixels and normalized rotation. Capture timestamps determine encoded elapsed time; recording is not a startup/FPS benchmark. The selected outfit is present at first play, the loading frontier remains physical while region detail arrives, and movement finishes near z=69 with Havok active, seven enemies, zero recovery teleports and no runtime/GPU errors. Direct VE video/mp4, range seeking, advancing playback and fullscreen pass; Telegram desktop client presentation was not independently inspected.

The additional Dawn diagnostic spans peak near **72.5 ms** in WebGPU and **17.3 ms** in Dawn command handling. It did not reproduce the multi-second hole; disabling Chromium shader-disk cache is not equivalent to clearing Metal/OS caches. Raw traces remain ignored under `.cache/startup-gpu-2026-09-30/`; the tracked SHA/event summary and probe flags make this diagnostic reproducible. It is not a quiet acceptance measurement.

## Final exact-build cold cohorts

Twenty sequential fresh Chrome processes per profile, M1 Max, native Pages packaging served with the existing compressed-preview server, 1280×720, 50 Mbit/s download / 40 ms latency, no recording or GPU/trace/cache diagnostic flags. Every row is retained and selected identity, Havok, grounded state, completed GPU fence and keyboard movement are asserted.

| Profile | p95 ms | Maximum ms | <=1 second |
| --- | ---: | ---: | ---: |
| Unsaved default | 843.7 | 844.7 | 20/20 |
| Largest saved outfit | 950.5 | 951.1 | 20/20 |
| Stout endpoint | 840.3 | 844.1 | 20/20 |
| Saved neutral | 841.0 | 841.7 | 20/20 |

An earlier pre-review candidate also passed 80/80 (p95 836.7–947.2 ms); its reports remain ignored as diagnostic evidence. The table above uses the final reviewed native bundle after neutral prefetch and graph/provenance guard corrections. It does not establish cold-driver behavior or physical-phone startup.

## Release status

Committed/pushed game source **`b362dbc12b22831ccbc708f9fffadcc083f48804`**. Existing `scripts/deploy-pages.sh` published Cloudflare Pages production **`60c0ca70-6575-4cd6-a717-b99984c9964f`**, [play.sparkify.dev](https://play.sparkify.dev), immutable [deployment](https://60c0ca70.fardel.pages.dev). Rollback is **`378af1f5-609a-416e-ad3d-5636dbf13c2b`**, source `59c08da`. All **251** executable/critical-resource checks pass, including geometry, textures and Havok; **191** executable/HTML/Havok files match the final locally measured native bundle byte for byte. No runtime art payloads were regenerated. Final public custom-domain cohorts use twenty fresh native/unthrottled Chrome processes per identity, 1280×720, no recording or diagnostic GPU flags:

| Identity | p95 ms | Maximum ms | <=1 second |
| --- | ---: | ---: | ---: |
| Default | 753.4 | 758.8 | 20/20 |
| Largest saved outfit | 860.0 | 1,248.3 | 19/20 |

The largest-outfit outlier is **run 1**, retained without rerun or exclusion. Its supported frame was submitted at **581.7 ms**, supported completion at **1,245.7 ms**, first play at **1,248.3 ms**. Selected body/clothes were installed by approximately 519 ms. This approximately **664 ms** submission/completion gap again prevents claiming that transport prefetch fixes all GPU tails. All forty runs retain the actual selected appearance, completed-GPU/grounded/input boundary, Havok and observed keyboard movement with no runtime/GPU errors. Native public p95 passes in these cohorts; one-second startup on every start/device remains unproved.

Production **33-case customization**, spawn movement and **four body-endpoint cathedral entry/return** checks all pass with Havok active and no recovery teleports. Largest-outfit **native touch/depth fallback** and **desktop WebKit** pass on the production URL, no runtime/GPU errors. All local checks and public cohorts use the shipped executable hashes. No rollback was needed. Owned browser contexts, both shared harness launches and both compressed-preview servers are closed; the final ownership report records the audit. Physical iPhone acceptance and Telegram client presentation remain unmeasured.

The GPU first-use tail remains unresolved, irrespective of whether the new public batch reproduces it.


## Remaining work and next investigation

The measured serial discovery problem is fixed and released. The **multi-second GPU first-use defect remains open**; candidate absence of that stall is not a fix. Before changing rendering policy, collect a genuinely slow run with `ASHEN_PROBE_GPU_EVENTS=1 ASHEN_PROBE_CHROME_TRACE=1`, save its complete Chrome/Dawn trace, and correlate device acquisition, shader/pipeline identities, submit serials, GPU-service tasks and callback delivery. Compare identical profiles/URLs sequentially; document OS/driver/cache conditions rather than claiming that a fresh browser or disk-cache flag clears them. A fast diagnostic cannot explain a slow baseline. Do not force context loss or restart the user's machine to manufacture a cold run.

Only an attributed fix should change pipeline initialization: reuse the installed Lite 1.31.1 native capabilities, measure PBR/world/post/compute coverage separately, and repeat normal four-profile startup/solo gates without instrumentation. Preserve saved identity, immutable provenance, Havok, full first-frame GPU completion and current quality. Shadow caching and async compilation remain disabled because existing trials did not justify enabling them. Crowd correctness in milestone 2 remains the next feature after the performance follow-up; physical iPhone startup/memory is still a separate acceptance item.
