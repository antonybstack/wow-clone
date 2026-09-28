Archived planning/history: preserved for rationale and provenance; unfinished items here are **not** current commitments. Archiving does not declare them completed. See [current state](../../CURRENT.md) and [the new roadmap](../../plans/character-mmo/vision-roadmap.md).

# One-second uncached playable startup — investigation and plan

**Implemented and released 2026-09-27.** See [the production retrospective](../../complete/2026-09/one-second-startup-implementation-2026-09-27.md): 194–231 FPS and 979.4 ms playable p95 at 50 Mbit/s / 40 ms, 19/20 under one second. The measured initial production transfer is approximately 3.25–3.26 MB; the original 1.50 MB figure below was a planning hypothesis. Physical iPhone startup remains unmeasured.


## Decision and scope

The user confirmed that **a playable starting area within one second, with the rest loading in the background**, is acceptable. The target means a visible, dressed, animated character responding to keyboard/touch movement with Havok and nearby collision active. A loading screen, static screenshot, hidden render, earlier boolean, or character standing over missing terrain does not qualify.

There is a plausible architectural path, but **one second is not demonstrated**. The required change is a much smaller initial scene and asset package, prepared during the build, followed by bounded background installation. Further tuning of the existing full-region startup cannot plausibly remove all of its measured multi-second work.

Proposed first acceptance envelope: M1 Max, Chromium WebGPU, 1280×720, fresh browser profile, at least 50 Mbit/s download and 40 ms configured latency. This is a proposed test condition, not a promise about every connection or device. Physical iPhone 14 Pro Max Safari needs its own load measurements; the user's approximately 60 FPS observation establishes gameplay usability, not startup latency. Keep the 10 Mbit/s / 80 ms profile as a slower-network report. Do not label that profile sub-second unless it actually passes.

This task changes research documentation and reusable probes only. Production gameplay and deployment remain at the terrain-startup release.

## Fresh production evidence

Source baseline: `b05e871` documentation over deployed game source `fb1057d`, bundle `ashenReach-Z5lIq7es.js`, Pages deployment `279d43aa-65e8-43ca-a454-e1bccff1d4c8`.

Nine production navigations used a **fresh Chromium process and temporary profile for every run**, initially empty HTTP cache, blocked service workers, 1280×720, device scale 1, M1 Max, Chrome 153.0.8010.54. Three sequential runs per network profile. DNS, operating-system, CDN and GPU-driver caches were not cleared. Network throttling is desktop CDP simulation; upload limits were 10 and 2 Mbit/s respectively. No CPU throttle, recording, FPS acceptance, or physical-device measurement.

| Network profile | Median existing game-ready | Approx. median from root URL request | Encoded traffic observed through probe completion |
| --- | ---: | ---: | ---: |
| Native connection, unthrottled | 7.60 s | 7.78 s | 11.55 MB |
| 50 Mbit/s, 40 ms configured latency | 8.68 s | 8.88 s | 11.55 MB |
| 10 Mbit/s, 80 ms configured latency | 14.92 s | 15.16 s | 11.55 MB |

All nine reached the current ready state with seven enemies, active Havok, loader removed, and no captured JavaScript/console/request error. These research probes do not assert input response, render correctness or GPU-error-free visual acceptance. Full data: [waterfalls](../../baselines/one-second-startup-2026-09-26/production-waterfalls.json), [summary](../../baselines/one-second-startup-2026-09-26/summary.json).

The root `index.html` redirects in the client to `ashen-reach.html`. Game marks restart at the second navigation's time origin. CDP document request timestamps expose roughly **181 / 206 / 247 ms median** extra root-to-game-request delay in these profiles. Root timing is approximate because it starts at the first network document request, not the initial user gesture/navigation start. Serving the actual game document at `/` can remove this chain. Both current entry paths and query parameters must continue to work.

Native-connection stage medians:

| Existing stage | Median | Interpretation |
| --- | ---: | --- |
| Engine creation | 29 ms | Observed here; not a cold-driver guarantee |
| Whole world construction | 3,550 ms | Geometry, lamp baking, images, upload and related work |
| `setupPlayer` / Havok interval | 1,188 ms | Includes late WASM download, initialization and all static collision |
| Character attachment | 220 ms | Initial body bytes were already downloading earlier |
| Initial scene registration | 220 ms | Does not include every first-use GPU cost |
| First render submission returned → ready | 2,174 ms | Background assets/features, registration, outfit and loader exit |

These stage medians are not an additive attribution of CPU, network and GPU time. First GPU completion and later asynchronous work overlap; the fence callback can also be delayed by main-thread work. Worst startup long tasks remained about **2.08 seconds** in every network profile.

An earlier diagnostic ran another nine fresh profiles with HTTP caching disabled throughout each navigation. It transferred about **13.63 MB**, because this also prevents normal reuse of assets prefetched during that same first visit. It is **not** the representative first-visit result above. [Diagnostic data](../../baselines/one-second-startup-2026-09-26/production-waterfalls-cache-disabled.json) retain that distinction. Its first run also took 573 ms to create the engine and reported the GPU fence at 14.01 s, after the ready mark at 8.90 s. That isolated outlier needs tracing if it recurs; it prevents treating a fast engine initialization or a ready boolean as universal proof of visible readiness.

## What the network and asset inspection show

The first representative run fetched approximately:

| Asset | Observed encoded bytes, rounded | Initial-path implication |
| --- | ---: | --- |
| Player body GLB | 3.40 MB | Largest required character payload; 57 animations and embedded textures |
| NPC base GLB | 1.89 MB | Can arrive after movement is usable |
| Training dummy GLB | 1.06 MB | Can arrive with combat |
| Foliage atlas | 1.02 MB | Grass can arrive later |
| Stone detail texture | 0.92 MB | Higher detail can arrive later |
| Havok WASM | 0.642 MB | Already Brotli compressed from a 2.095 MB file; retain as essential |
| Three starter clothing files, combined | 0.640 MB | Required appearance, but current packing/requests need improvement |
| Initial game JS chunk | 0.141 MB | Already Brotli compressed; not the largest transfer |

The complete observed script traffic is about 0.377 MB across 115 script requests, including late chunks and analytics. Request count matters because some chunks are discovered serially, but loading every chunk eagerly would add work to the initial path. Measure the initial module graph separately and combine only its high-value dependency chains.

Havok is requested after full world construction—roughly 3.8 seconds into the first representative game navigation. `src/player.js` imports its wrapper statically, but `HavokPhysics(...)` is invoked inside `setupPlayer`, after the world and body-byte wait. Its generated loader already uses streaming instantiation when available. Start the existing factory early; do not implement a second WASM loader or assume fetching an ArrayBuffer first improves streaming compilation.

Character and GLB responses were uncompressed at the HTTP layer, while JS and Havok already used Brotli. The original body compresses to **2.487 MB** in a local Brotli quality-6 experiment. That is useful potential transfer reduction, not a measured production configuration result. [Cloudflare Compression Rules](https://developers.cloudflare.com/rules/compression-rules/) can target file extensions/content types; test response negotiation on this Pages custom domain, decompressed hash equality and Safari before adoption. Do not merely attach `Content-Encoding: br` to an uncompressed file or mislabel its MIME type.

The fresh-cache run reuses most repeated prefetched content; some clothes requests revalidate. The cache-disabled diagnostic exaggerates duplicate byte costs. Promise-based reuse of required asset fetches can eliminate redundant work without declaring all repeated URLs duplicate full transfers.

### Starter character size experiment

The read-only experiment uses the installed glTF Transform and Meshopt tools. It retains idle, walk, sprint, backwards movement, both strafes, both turns and all three jump clips. It preserves geometry/index/skin-weight attribute bytes through encode/decode, keeps one skin, and does no vertex reordering or quantization. Existing shared-accessor regressions make those transformations inappropriate as an automatic optimization.

| Body variant, excluding clothes | Raw GLB | Local Brotli quality 6 |
| --- | ---: | ---: |
| Current, 57 animations | 3.400 MB | 2.487 MB |
| 11 movement animations, original textures | 3.149 MB | 2.475 MB |
| 11 animations, textures capped at 512 px | 2.120 MB | 1.446 MB |
| 11 animations, textures capped at 256 px | 1.682 MB | 1.009 MB |

Dropping animations alone saves only **251 KB raw**, and just **11 KB** in this re-encoding/Brotli comparison. Smaller textures help more, but even the smallest experiment plus existing clothing and Havok is too large for the proposed initial-byte budget. No candidate was written to production assets or accepted visually. The experiment verifies geometry bytes, not animation equivalence, joint-bind identity, clothing integration or readability. [Raw results](../../baselines/one-second-startup-2026-09-26/starter-asset-size.json).

A new starter asset therefore needs deliberate compact packing: only visible starting meshes, the approved outfit, shared textures, a small material set, and essential source-rig motions. Investigate redundant buffer storage and unused material/image data before considering a lower-detail mesh. A lower-detail starter body is a separate visual experiment; preserve the silhouette, fit, gait and joints and do not reuse the old combined `wanderer-equipment.glb` blindly. Historical startup notes identify an incorrect idle pose in that path.

## Feasibility budget

Pure transfer time is `encoded megabytes × 8 / megabits per second`, before latency, requests, decoding or rendering:

| Initial encoded payload | 50 Mbit/s | 10 Mbit/s |
| --- | ---: | ---: |
| Current observed 11.55 MB through probe completion | 1.848 s | 9.240 s |
| Proposed 1.50 MB playable package | 0.240 s | 1.200 s |
| Aggressive 1.00 MB package | 0.160 s | 0.800 s |

The 11.55 MB is an inventory comparison, not an exact byte boundary at `ready`: the probe also waits for hostiles and the GPU fence before its snapshot. Future playable measurements must count completed and in-flight traffic up to that specific boundary separately.

At 10 Mbit/s, the current compressed Havok payload alone consumes about 0.51 seconds of ideal transfer time. Sub-second startup on that connection would require an exceptionally small remainder and tight overlap. A universal uncached one-second guarantee is not credible.

For the initial 50 Mbit/s experiment, adopt **1.50 MB encoded as a ceiling, not an achieved result**:

| Component | Proposed allowance |
| --- | ---: |
| Havok | 650 KB |
| Initial JS, HTML, CSS and decoder | 200 KB |
| Dressed starter character and essential animation | 400 KB |
| Starting-area geometry, collision and coarse visible surroundings | 150 KB |
| Starting-area textures | 100 KB |

These are feasibility gates; the 400 KB dressed-character allowance is especially unproven given the experiment above. Start with an asset inventory and reject a plan that silently exceeds its byte budget.

An illustrative critical-path allocation is 200 ms document/discovery, 300 ms initial transfer, 250 ms initialization/decode/upload and 150 ms first render/input, leaving 100 ms margin. Operations must overlap. This is an engineering budget, **not** a prediction or an additive forecast from today's stage medians. If the minimal real scene cannot meet it, report the measured floor and revise the target envelope before expanding the architecture.

## Implementation sequence

### P0 — Instrument actual playable readiness and remove avoidable dependency delays

Keep the existing `ASHEN.ready` and `hostilesReady` meanings compatible with existing tests. Add `playableReady`/`whenPlayable`, `combatReady`, and `regionReady` for their respective contracts. The new playable boundary requires grounded Havok, local render/collision, dressed animation, usable camera, enabled input and a visible presented frame. Trace key/touch event → actual displacement → subsequent rendered frame; validate with live motion rather than a DOM boolean alone. Measure from the root URL, including entry navigation.

Instrument separately: adapter/device request, GPU compatibility probe, Havok fetch/factory, collider installation, image decode, character decode, pipeline registration, first submitted/completed frame, input release and complete region. Existing world/Havok marks combine several causes.

Serve the game HTML at `/` as well as `/ashen-reach.html`, preserving query parameters, preload transformation and deployment verification. Begin the existing Havok factory promise and truly required downloads early. Match the exact versioned WASM URL and fetch mode if using preload. Apply the existing Pages [Early Hints](https://developers.cloudflare.com/pages/configuration/early-hints/) support to a small set of required assets, then measure it; hints only help when critical bytes are discoverable early. Avoid preloading the entire region.

Remove the 350 ms loader fade from the input-critical path once a valid playable frame is visible. `finishLoading()` currently awaits two animation frames plus that timer, then main enables input. A shorter or independently finishing exit effect must not cover the playable view or intercept movement. Preserve reduced-motion behavior, error/retry and device-loss handling.

**Gate:** new milestones do not change current full-ready assertions, root/direct URLs work, no duplicate full Havok fetch, and the timing probe measures actual input response. Do not claim one second from this phase alone.

### P1 — Produce a small, deterministic starting-area asset at build time

Extract the deterministic geometry/material/collider description from `buildChurchyard()` and `Batch.commit()` into an exportable data stage. Bake positions, normals, indices, UVs, lamp UV2 and colors once during asset generation. Include material identifiers, spatial bounds, collision descriptors, landmark IDs, light ownership and a schema/source/seed hash. Keep the procedural generator as the authoring source and equality oracle.

Compare **standard glTF with Meshopt** against a small typed-buffer container loaded by public Lite `createMeshFromData`. Use glTF when it preserves custom attributes/shading economically; use a minimal binary envelope only where it avoids a demonstrated conversion or size cost. Keep the existing renderer, materials and physics APIs. A whole-world JSON dump or raw multi-megabyte binary loaded before play defeats the objective.

Choose a starting neighborhood using measured camera visibility, maximum movement speed and bytes/colliders, testing approximately 32–64 m partitions as candidates. Preserve immediately visible cathedral/town/tree silhouettes through coarse geometry where necessary. Match surface normals and collision along boundaries, assign stable collider ownership, and include shadow casters outside the camera frustum. Retain the existing woodland's 128 m detail tiles; terrain/architecture need not use the same tile size.

Prepare only starting-area Havok shapes before play. The current saved world has six mesh colliders and 678 boxes. Partition mesh collision into local geometry and install it through the existing owned shape/body path in `src/player.js`. Export geometry and box descriptors, **not undocumented cooked Havok blobs**. No verified Lite cooked-shape serialization API was found.

**Gate:** deterministic rebuild, buffer/material/collision comparison, seam walking and camera obstruction pass; initial package fits its allowance; initial GPU upload and shape creation fit measured time limits. Retain the same finite region and routes.

### P2 — Build and validate the dressed starter character

Create a new generated starter asset using existing equipment composition and source-rig tooling. Keep current spawn appearance and locomotion. Reduce texture payload and unnecessary initial material features; verify hair alpha and avoid lossy normal/roughness artifacts. First inspect why the original remains large after animation pruning. Any mesh reduction needs bind/weight/vertex-sharing safeguards and live gait inspection.

Load optional clips, alternate race packs, customization UI, spell assets, audio, dummy and NPCs after the playable boundary. Additional animations must attach to the same compatible skeleton or transfer state through the existing body ownership hooks; do not replace a running animation/player by recreating it mid-step. Preserve equipped clothing, clip time, heading, camera, combat sockets and disposal on upgrade.

**Gate:** first frame is dressed, idle/walk/sprint/strafe/backwards/jump work, no T-pose or naked frame, starter bytes fit the agreed budget, and later enhancement does not reset position or pose. If 400 KB is not attainable with acceptable appearance, use the measured larger payload in the one-second feasibility decision.

### P3 — Prove the minimal vertical slice before restructuring the full region

Behind an opt-in startup mode, load only the real starting neighborhood, required Havok collision, the dressed starter character and essential rendering. Start independent initialization in parallel. Begin with a small material/pass set while retaining the approved visual direction; compare a baked-light/sky starting view to the full post/shadow stack before accepting deferred expensive passes.

Prove visible movement under a one-second navigation target with cold-browser runs. Then walk continuously while one neighboring chunk loads. This is the stop/go experiment: if it misses, attribute the remaining critical path and solve that before implementing a region-wide loader.

Async shader compilation is a conditional experiment here because the bottleneck changes. Reuse `enableAsyncShaderPipelineCompilation(engine)` and public preparation/registration APIs; it covers ShaderMaterial, **not** all PBR, postprocessing or every pipeline. Earlier full-world trials showed no readiness improvement. Compare again only if first-use eligible pipeline stalls remain. Static shadow caching stays disabled given its measured gameplay regression.

**Gate:** first playable frame plus observed input effect ≤1,000 ms in the declared envelope, with repeated runs and visible motion evidence; report misses/outliers. A fast median from three runs is not sufficient release proof.

### P4 — Extend background loading without freezing movement

Fetch spatial chunks in bounded priority order: adjacent traversable collision/render surfaces, nearby interaction, visible details, then distant content. Use worker decode with transferable buffers where justified; keep device-bound GPU installation and the existing Havok world under their current ownership. Limit main-thread install work to an initial **1–2 ms per frame budget**, adapting downward under input or slow frames. This is a budget to validate, not a guarantee that any size physics call fits it; split assets further when one indivisible operation exceeds the budget.

Maintain an explicit chunk lifecycle: requested → decoded → physics installed → render installed → available, with cancellation/failure and idempotent disposal. Do not allow the player to reach a visually open surface whose collision is missing. Prefetch distance must cover maximum speed × measured worst-case readiness plus safety margin. For outages or a player catching up, provide a visible temporary gate/loading frontier and retry; never silently clamp coordinates, drop terrain or count recovery teleports as success. Remove the gate only after the neighboring route is safe.

Scheduling the old multi-second `buildChurchyard()` after `ready` is insufficient. `Promise.resolve()` does not yield to rendering; feature-detect `scheduler.yield()` with a browser-compatible fallback, or use a frame-budget queue. Avoid unconditional idle-only scheduling that can starve required chunks. The [browser task guidance](https://web.dev/articles/optimize-long-tasks) explains why async function names alone do not make main-thread work nonblocking.

Audit snapshot dependencies before making content dynamic: local/spell lighting currently captures material sets; shadow caster retirement has a guarded compatibility bridge; foliage currently precedes combat; `registerLateFeatures` unregisters/re-registers the scene. Update those sets incrementally through supported Lite APIs and profile registration while moving. Do not repeat whole-scene registration for each small chunk without measuring its cost. Cache loaded finite-region chunks within a stated memory cap; require safe unloading tests if eviction is added.

**Gate:** continuous movement during terrain/character/detail upgrades, no missing collision/shadows, no route traps, failure/retry/teardown tests, no streaming-induced long tasks, and measured frame tails within the existing gameplay budget. Complete all current eight destination return routes and cathedral vertical routes after region readiness.

### P5 — Release gates

Use at least 20 fresh-profile navigations per target profile for an initial percentile estimate; retain individual samples, p50/p95/max, CPU/network/GPU stages and initial bytes. Target p95 ≤1,000 ms in the declared fast-network envelope; increase samples before making a broad reliability claim. Include actual root navigation, an empty HTTP cache with same-navigation reuse allowed, and separate new-process/driver-cache limitations. Test slower profiles and report them honestly.

Verify physical iPhone 14 Pro Max Safari independently. Run portrait input, loading frontier behavior, first spell, armory/race change, movement while upgrading, device loss, failed chunk retry, disposal and mobile depth fallback. Repeat the established M1 Max uncapped Chromium 1280×720 seven-enemy gameplay tests, three 12-second runs per representative route, separately from recording; preserve >120 FPS and report p95/p99/max and intervals over 16.67 ms. Measure streaming frames separately from settled-world frames.

Review live startup and continuous-walk MP4s for naked/T-pose frames, lighting pops, silhouette loss and late freezes. Deliver motion through the normal Telegram/VE process. Only then commit/push runtime milestones and release through the existing Pages verification/rollback gates. Roll back if loading, input, physics or streaming correctness fails.

## Approaches that do not independently solve this

- Cache-Control, service workers and persistent caches help subsequent visits; they cannot supply never-downloaded bytes for a true first visit.
- Eagerly downloading every region asset increases the initial bandwidth demand. Preload only the playable package and move independent required work earlier.
- Moving procedural generation into a worker can improve responsiveness but still consumes time and memory; build-time generation removes that client work. Worker decode remains useful for later chunks.
- KTX2/Basis may improve GPU memory/upload cost, but adds decoder/transcoder work. Existing Lite loaders support it; compare total first-play bytes, transcode time and iPhone output against current JPEG/WebP/PNG before selecting it.
- Async shader compilation changes scheduling, not the amount of downloaded or generated world content; precompiled native GPU pipeline blobs are not a portable WebGPU deployment asset.
- A 350 ms fade reduction, GLB compression, or root redirect removal is useful but cannot by itself turn today's 7–15 second path into one second.

## Documentation and tools reused

The Babylon Lite docs MCP is not exposed in this session, so the research used official documentation pinned to the installed **1.31.1** release plus local `index.d.ts`/implementation. No dependency upgrade is proposed.

- [Lite loaders](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/04-loaders.md): standard GLB loading; existing Meshopt support.
- [Lite public API](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/index.ts): `createMeshFromData`, buffer upload, GPU completion and scene APIs; confirm signatures against installed declarations.
- [Lite physics](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/42-physics.md): existing Havok shapes, bodies and controller ownership.
- [Lite asynchronous shader compilation](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/53-async-shader-pipeline-compilation.md): opt-in ShaderMaterial preparation and its limits.
- [Lite bundle tooling](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/38-bundle-size-tooling.md): model runtime-loaded bytes and enforce ceilings; its lab scripts are a pattern to adapt, not a drop-in game command.
- [Meshoptimizer JS API](https://github.com/zeux/meshoptimizer/blob/master/js/README.md): existing codec and optional worker decoder; keep output compatible with the pinned decoder.
- [glTF Transform prune](https://gltf-transform.dev/modules/functions/functions/prune) and [texture compression](https://gltf-transform.dev/modules/functions/functions/textureCompress): use existing asset tooling instead of writing a new glTF optimizer.
- [WebAssembly streaming instantiation](https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/JavaScript_interface/instantiateStreaming_static): preserve the generated Havok loader's streaming path and correct WASM MIME type.
- [Transferable worker buffers](https://developer.mozilla.org/en-US/docs/Web/API/Worker/postMessage): explicit buffer ownership for background decoding.
- [Fetch Priority](https://web.dev/articles/fetch-priority), [Pages Early Hints](https://developers.cloudflare.com/pages/configuration/early-hints/), [Cloudflare compression](https://developers.cloudflare.com/speed/optimization/content/compression/): discovery and delivery optimizations after reducing the required initial content.

## Reproduce this investigation

```sh
node scripts/ashen-reach/probe-uncached-startup.mjs /tmp/ashen-first-visit.json
ASHEN_PROBE_DISABLE_CACHE=1 node scripts/ashen-reach/probe-uncached-startup.mjs /tmp/ashen-cache-disabled.json
node scripts/ashen-reach/probe-starter-asset-size.mjs /tmp/ashen-starter-size.json
```

The first probe launches and closes its own Chrome processes; it leaves existing browser sessions alone. It saves selected response metadata, timings and byte counts rather than credentials or full headers. The asset experiment writes JSON only. Neither script deploys, changes gameplay assets or claims visual acceptance.
