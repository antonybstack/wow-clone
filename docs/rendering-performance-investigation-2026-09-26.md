# Shadow caching and asynchronous compilation investigation

Investigated 2026-09-26 against source `837f18a`, exact Babylon Lite **1.31.1**, Havok **1.3.14**. Performance and loading time are the priorities. This report records isolated experiments and a conditional implementation plan. It does not enable either option in the released game.

## Decision

- **Do not enable static CSM caching with the current gameplay camera.** The native option made all sampled scenarios slower and still refreshed every static cascade every frame. Investigate camera invalidation before spending more time on cache integration.
- **Do not enable distributed updates as a standalone optimization.** They spread sun-drift/periodic refits, not camera-driven refits; the current sun is fixed.
- **Keep asynchronous shader compilation disabled by default for now.** Eight instrumented loads showed no meaningful readiness or long-task improvement. The stronger path is eliminating repeated terrain generation calculations: one separate CPU profile attributed about five seconds to terrain normals. Implement that bounded change first, then reconsider shader work only if a remaining pipeline stall is measured.

## Evidence and limits

The [evidence directory](baselines/rendering-options-2026-09-26/) contains raw frame intervals, GPU summaries, native policy probe, isolated source patch, runner scripts, and reviewed stills. Main-checkout runtime files were unchanged. No production deployment occurred.

CSM trials used M1 Max, Chromium **153.0.8010.54**, WebGPU, uncapped harness slot 13, **1280×720 actual canvas**, seven enemies, and native GPU timing. Mode order was baseline/cache/cache/baseline, with four **8-second** scenarios per navigation and settling/warmup before each. There were **23,936 measured frames**, zero reported runtime/GPU errors and zero recovery teleports. All sampled frames stayed below 16.67 ms. The gameplay camera used radius 5/pitch .24; these are paired diagnostic results, not the usual release benchmark or directly comparable to its absolute FPS. GPU means are means of the runtime's rolling 600-sample GPU summaries, not the complete eight-second distributions. No recording ran during timing.

An older unrelated game tab was present on CDP 9937 and left untouched; its workload was not controlled. Other inspected historical browser endpoints were blank. The sequential paired order and repeatable cache-work counters support rejecting this candidate, but small performance differences require a quiet exact-build repeat before release. The async agent and parent took separate GPU windows.

## Static cache and distributed updates

### Native contract and application fit

Use the pinned [CSM guide](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/17-cascaded-shadow.md), [distributed refit change #701](https://github.com/BabylonJS/Babylon-Lite/pull/701), and installed `lib/shadow/{enable-csm-static-cache,csm-shadow-cache,csm-refit-gate,deformable-shadow-casters}.js` as the authority.

`enableCsmStaticCache(engine, generator, options)` is asynchronous and must finish **before scene registration or the first receiver-texture request**. Our receiver texture is currently requested inside `createSunShadows`, so enabling it after startup is too late. The experimental patch makes that constructor asynchronous, awaits the native option before receiver acquisition, and awaits the constructor in `main.js`.

The experiment used `forceRefreshEveryFrame:false`, `refitAngle:.01` radians, `refitMaxIntervalMs:0`, and `staticCascadesPerFrame:1`. The angle is an experimental valid value, not a tuned artistic setting; the fixed light never reaches a drift threshold. Skeleton bounds support, custom shadow caster materials, caster-retirement bridge, three 2048-square cascades, and receiver behavior were preserved.

Native caching begins with dynamic casters and demotes them after 120 quiet frames. World/thin-instance changes promote them. `enableSkeletonShadows` also wraps skeletal casters and increments the wrapper version when their calculated bounds change; examining only `createCsmRefitGate` would incorrectly conclude that all skeletal animation is ignored. However, bounds changes are not a general guarantee for deformations that leave bounds unchanged. Pose-only changes, alpha/material changes, and GPU-time deformation remain explicit correctness checks for any future rollout.

At our settings the additional `depth32float` static texture consumes **48 MiB** (2048 × 2048 × 3 × 4 bytes), excluding other task/buffer overhead. Dynamic overlay frames copy cached depth into the live array before drawing dynamic shadows. That extra work must be paid back by avoided static draws; a full camera refit pays the cache work plus rendering.

The [native policy probe](baselines/rendering-options-2026-09-26/refit-policy.mjs) confirms that a camera change renders all three layers immediately, while a sun-only drift can render one layer per frame. Scene content, caster membership, promotions/demotions, and pending-generation rules can also force full updates. `SUN_DIR` in `atmosphere.js` is fixed, so distributing drift has no normal gameplay benefit today.

### Measured outcome

FPS values are the mean of two runs per mode; p99 is the worse of the two per-run p99 values. GPU values summarize the rolling samples described above.

| Scenario | Baseline FPS | Cache FPS | FPS change | GPU mean ms, baseline → cache | Worst run p99 ms, baseline → cache |
| --- | ---: | ---: | ---: | ---: | ---: |
| Standing gameplay camera | 187.17 | 178.67 | −4.54% | 1.091 → 4.561 | 11.6 → 12.2 |
| Town movement | 180.34 | 172.87 | −4.14% | 1.150 → 4.623 | 12.2 → 12.7 |
| Bridge movement | 208.82 | 198.12 | −5.12% | 0.974 → 3.810 | 10.7 → 11.6 |
| Forest movement | 188.81 | 179.96 | −4.69% | 1.063 → 4.115 | 6.7 → 12.1 |

Every cached measurement executed **three static passes per frame**, so there was no static draw reuse. The baseline counter named `dynamicExecutes` counts its ordinary cascade tasks; it does not mean that baseline contains only dynamic casters.

A separate five-second cause probe found:

| View | Observed frames | Camera-triggered refits | Forced/content-triggered updates | Drift-only refits |
| --- | ---: | ---: | ---: | ---: |
| Stationary gameplay view | 895 | 895 | 0 | 0 |
| Fixed reference view | 1,128 | 0 | 0 | 0 |

The fixed reference view demonstrates that the native cache can reuse maps. Its 225.56 FPS and .917 ms GPU mean are **not** an improvement comparison: it sees a different composition. The cause probe establishes camera invalidation as the immediate blocker; it does not yet attribute the dirty camera to a particular target/radius/physics write. `CameraRig.update()` writes a desired radius, samples the desired camera endpoint for collision, then writes the resolved arm radius. Havok target motion and asymptotic zoom/arm recovery are other possible causes. These are hypotheses for instrumentation, not permission to suppress camera updates or quantize collision.

Reviewed [play](baselines/rendering-options-2026-09-26/csm-play.png) and [reference](baselines/rendering-options-2026-09-26/csm-reference.png) captures contain rendered world/characters without an obvious blank-frame failure. They do not establish moving-shadow, equipment, mobile, or teardown acceptance. Because the candidate failed the performance investigation, a full visual release cycle was not run.

## Conditional shadow implementation plan

1. **Diagnose real versus redundant camera changes.** In an isolated development probe, record desired/resolved radius, alpha/beta, target, Havok body position, camera matrix/version, and cascade matrices over standing, zoom recovery, wall obstruction, walking, and orbiting. Count intermediate writes as well as final values. Files: `src/camera-rig.js`, `src/player.js`, a new focused probe using the existing harness. Keep diagnostics outside the production hot loop. If final camera transforms actually change, preserve correct refitting. Do not introduce an arbitrary movement epsilon merely to pass the counter check.
2. **Fix only proven redundant work.** Prefer Lite camera/position APIs. If collision endpoint calculation unnecessarily mutates the live camera twice, separate the query camera from the final camera or use an appropriate existing Lite helper after checking its semantics. Preserve input mappings, collision sweeps, immediate retraction, smooth return, zoom, and headroom. Add a focused stationary-version regression test only when its expected behavior follows from the proven cause; run `test-camera-rig.mjs` and live camera/obstruction checks. Measure this change by itself with cache disabled—it may benefit several matrix consumers.
3. **Retry the native cache only if the camera fix creates meaningful reuse.** Await `enableCsmStaticCache` inside `createSunShadows`, before `getCsmReceiverTexture`; update constructor callers/tests for the async boundary. Register cleanup before awaiting and test disposal/setup failure while enablement is pending. Use `staticCascadesPerFrame:0` initially: there is no reason to add drift scheduling to a fixed-sun experiment. Do not build an application-owned duplicate cache or access the private gate to force arbitrary dynamic classifications.
4. **Prove invalidation and ownership.** Test idle/casting/hit poses, skeletal bounds with unchanged extrema, garment/race replacement, hidden/dead actors, shadow disable/re-enable, woodland full/reduced transitions, and camera projection/portrait changes. Existing woodland code changes visibility and deliberately advances a caster transform version; retain that signal unless an equivalent public contract is demonstrated. Keep offscreen casters used by shadows. Preserve the validated caster-retirement bridge, and ensure both static/dynamic tasks and the extra texture retire behind GPU completion. Check wind-deformed surfaces explicitly; current opaque world shadow material does not reproduce the visible wind displacement, so do not claim this trial fixed that inherited limitation.
5. **Reject a trade that hurts ordinary traversal.** Use the existing 3 × 12-second town/bridge/cathedral/forest benchmark plus stationary cases, same M1 Max/1280×720/seven enemies. Run throughput without diagnostic recording; collect GPU attribution in a separate matched pass to disclose timing overhead. Proposed adoption gate: repeatable ≥5% benefit in a representative workload, every run >120 FPS, no repeatable >5% route FPS regression or >10% p99 regression, no correctness failure. A stationary-only win with slower movement does not justify a global default. Include physical iPhone memory/runtime checks because of the extra 48 MiB; the user's current ~60 FPS report applies to the released configuration.
6. **Stop if native semantics remain unsuitable.** Keep caching disabled and archive the negative result. Revisit distributed updates only when a moving sun or periodic refit workload actually exists; its maximum delay is `ceil(cascades / budget) - 1` frames, and cascade depth/receiver transforms must remain paired by the native scheduler.

## Reproduction

The CSM source experiment is an archived patch, not a patch applied to the active game. Create an isolated checkout of `837f18a`, install the exact lockfile, synchronize ignored public assets with `scripts/harness/sync-public-assets.mjs`, apply `csm-experiment.patch`, and start `node scripts/harness/up.mjs --slot 13 --headless --uncapped`. The archived runners assume that slot's URL/CDP port. Run them from this evidence directory in a checkout containing the normal dependencies. Their temporary outputs go to `/tmp/ashen-csm-trial.json` and `/tmp/ashen-csm-causes.json`; they navigate the owned tab to blank on completion. The source patch affects both A and B equally except for the `csmCache` query switch.

`node docs/baselines/rendering-options-2026-09-26/refit-policy.mjs` runs the CPU-only native policy probe. It intentionally imports the pinned package implementation to investigate scheduler policy; it is not a production private-API dependency.


## Asynchronous shader compilation

### Native capability

The pinned [asynchronous compilation guide](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/53-async-shader-pipeline-compilation.md) and [implementation](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/material/shader/enable-async-shader-pipeline-compilation.ts) describe `enableAsyncShaderPipelineCompilation(engine)`. It is an older opt-in feature, introduced in 1.22.0, available in our installed 1.31.1. It is not a new feature introduced by this particular upgrade.

Call it immediately after engine creation, before building/registering ShaderMaterial renderables. Native registration prepares eligible task/material variants using `createRenderPipelineAsync`; our two existing awaited registration boundaries are suitable. World/sky/ash custom materials and their supported shadow tasks qualify. PBR characters/garments, Standard/Node/geometry materials and post-processing effect pipelines are outside its scope. Compilation still involves main-thread descriptor/module work, and unseen late variants can fall back to synchronous creation. Automatic preparation logs failures and falls back; awaiting registration alone does not prove that asynchronous preparation succeeded.

Lite already uses its cross-material ShaderMaterial pipeline cache. Do not introduce another application pipeline cache, raw GPU descriptors, or a worker-based renderer to exercise this option. Use native task-specific preparation only when a measured first-use stall identifies the exact eligible material/layout/target.

### Paired load results

Eight sequential loads used mode order **baseline, async, async, baseline, baseline, async, async, baseline**. Each used a fresh browser context on the same owned Chromium process, Vite localhost, M1 Max, WebGPU, 1280×720, seven enemies. Browser HTTP cache was cleared on the first run only. The remaining seven are the warm-process comparison: three baseline and four async observations. Vite, OS and driver pipeline caches were not cold or controlled. This is a screening experiment, not production or physical-iPhone load acceptance. Both modes carried the same instrumentation; screenshots were taken after timed readiness.

The raw probe's `subsequent cache warm` label means process reuse only; fresh-context HTTP-cache and driver-cache warmth was not verified. The archive includes all eight runs, without selecting the fastest samples. `first GPU completion` is a queue fence after the first render callback, not a claim about screen scanout or completion of the dressed playable scene. `ready` is the game's final readiness marker after equipment/combat/foliage setup and the loading-overlay transition. Times below are milliseconds from the navigation origin; world/registration/long-task values are durations.

| Run | Mode | World stage | Initial registration | First GPU completion | Ready | Worst long task |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | Baseline, HTTP-cache cleared | 7,862.2 | 36.8 | 10,573.5 | 11,205.0 | 6,600 |
| 2 | Async | 7,684.0 | 67.0 | 10,078.7 | 10,705.4 | 6,574 |
| 3 | Async | 7,440.5 | 61.5 | 9,797.7 | 10,403.4 | 6,332 |
| 4 | Baseline | 7,449.4 | 37.2 | 9,893.3 | 10,671.2 | 6,344 |
| 5 | Baseline | 7,817.8 | 35.7 | 10,510.8 | 11,151.8 | 6,573 |
| 6 | Async | 7,941.4 | 67.9 | 10,464.9 | 11,117.7 | 6,676 |
| 7 | Async | 7,723.1 | 61.2 | 10,138.7 | 10,752.6 | 6,527 |
| 8 | Baseline | 7,543.5 | 29.2 | 9,917.5 | 10,536.0 | 6,431 |

Warm medians, baseline → async:

- Ready: **10,671.2 → 10,729.0 ms** (+0.54%).
- First GPU completion: **9,917.5 → 10,108.7 ms** (+1.93%).
- Worst startup long task: **6,431.0 → 6,550.5 ms** (+1.86%).
- Initial registration: **35.7 → 64.25 ms**.

These differences are small relative to load variance and do not demonstrate either a useful gain or a general async performance defect. Async mode consistently moved **17** eligible pipeline creations to the native asynchronous path, but **72–77** synchronous pipeline creations remained. There were zero collected runtime/GPU errors. The baseline first queue completion lagged the first render callback by roughly 0.9 seconds despite very short JavaScript pipeline API calls; `presentMs` alone would misrepresent readiness. API-call duration is not GPU execution time.

Reviewed [baseline](baselines/rendering-options-2026-09-26/async-baseline.png) and [async](baselines/rendering-options-2026-09-26/async-candidate.png) stills show the dressed character and complete churchyard with similar appearance. Initial-frame, first-use spell, mobile/WebKit and rejection/fallback motion acceptance remain untested. With no benefit demonstrated, there is no reason to proceed to a release on this evidence.

### Separate CPU profile: the practical load-time opportunity

A ninth, separately profiled **baseline** boot was excluded from the timed comparison. The [Chrome CPU profile](baselines/rendering-options-2026-09-26/boot-baseline.cpuprofile), [summary](baselines/rendering-options-2026-09-26/boot-profile-summary.json) and [stage marks](baselines/rendering-options-2026-09-26/boot-profile-marks.json) identify where further work belongs:

| Stack/function | Approximate inclusive sampled time |
| --- | ---: |
| `buildChurchyard` | 7,424.5 ms |
| `height` | 6,139.0 ms |
| `terrainNormal` | 4,985.7 ms |
| Outer terrain per-corner normal callback, `scene.js:448` | 4,602.4 ms |
| `setupPlayer` including Havok | 918.3 ms |

Inclusive rows overlap and **must not be summed**. The height chain spends substantial self time in regional route shaping (1,613.9 ms), ridge evaluation (1,541.3 ms), and legacy height calculation (773.2 ms). Lamp baking is a separate 748.8 ms self-time cost. Sampling/profiler overhead and the shared machine limit numerical precision; these are attribution clues, not promised savings.

Current outer terrain construction (`scene.js:444–451`) recomputes four corner positions and four central-difference normals for every cell. Adjacent cells repeat shared corners. Each `terrainNormal` invokes the complete height chain four more times. This gives a concrete path to eliminate repeated pure calculations while retaining the existing terrain, native Lite mesh upload, material system and Havok geometry.

## Recommended execution order and load implementation plan

**P0 — Make the measurement reusable before changing startup.** Promote the archived probe into a maintained script under `scripts/ashen-reach/`, parameterized by the existing harness URL/CDP conventions. Keep GPU API interception in the diagnostic init script. Add narrowly scoped performance marks to `main.js` for world generation, physics, body, both registrations, first render return, first completed queue, overlay removal/ready, and hostiles. Use the public completion helper where possible. Preserve current readiness semantics and capture unexpected errors. Record actual dimensions, enemies, browser, commit, cache policy, request bytes and stage durations. Use one exact built baseline for comparison; distinguish warm reloads from fresh owned browser profiles and never label HTTP-cache clearing as a cold driver cache.

**P1 — Reuse terrain grid samples within one build.** This is the first implementation candidate, ahead of shader or shadow-cache adoption.

1. Files: `src/ashen-reach/scene.js` outer terrain loop; a small pure helper if needed in `geometry.js` or a nearby terrain module; the existing terrain/world tests and a focused equivalence fixture. Do not change the height formula, route shaping, grid spacing, normal step `.5`, triangle order, random seeds, material grouping or collision data.
2. After terrain/routes are initialized, lazily compute each used `TERRAIN_X`/`TERRAIN_Z` corner's position, normal and legacy comparison height once. Index by integer grid coordinates. Reuse those values in adjacent cells. Keep cache local to that build and release it once batches are committed. Avoid a global floating-coordinate memoization map that could grow during gameplay or retain obsolete route configuration.
3. Preserve JavaScript numeric precision until the existing final Float32 mesh conversion. Keep triangle winding, UVs, color evaluation order, mountain/far-earth classification and batch boundaries exactly as before. Start with height/normal reuse; do not precompute color/random-dependent values without verifying their purity. Reuse existing `Batch` and Lite `createMeshFromData` machinery.
4. Generate before/after buffers from the same seed/grid fixture and compare positions, normals, UVs, colors, indices and batch assignment exactly where deterministic. Include grid seams, protected churchyard/town pads, cathedral approach, mountain transitions, route bridges, landmark entrances and the outer boundary. Confirm visible and Havok terrain still share the same geometry. This equivalence test verifies actual output, not the cache's implementation details.
5. Run focused `test-regional-terrain.mjs`, `test-region-world.mjs`, `test-world-composition.mjs`, relevant route/cathedral checks, then the production build. Inspect live landscape/portrait captures and terrain seams; traverse all eight destinations, cathedral levels and perimeter with Havok active and no recovery teleports. No new rendering API is required for this change.
6. Repeat serial built-load pairs and the separate three-by-twelve-second route benchmark. Proposed success gate: ≥10% median playable-ready improvement **or** ≥20% reduction in the world stage and worst startup long task, with no repeatable total-ready regression >3%, no visual/physics change, and the normal >120 FPS/no-regression gates. Report absolute milliseconds as well as percentages. A theoretical fourfold reduction in repeated samples is not a claim of fourfold faster loading.

**P2 — Reprofile the successful P1 result.** If the same math still dominates, examine a bounded per-build sample cache for central-difference height inputs; verify exact coordinate keys and peak memory. If lamp baking is then material, optimize its measured repeated work while preserving its churchyard/windowing invariants and lamp-profile checks. Only consider a worker or offline terrain bake after these smaller changes are measured: either adds transfer, memory, asset/versioning and collision-readiness complexity. Prefer existing Vite worker support, transferable buffers and existing mesh/asset tools over a custom job framework if that later step is justified. Do not start a terrain-streaming rewrite.

**P3 — Investigate camera invalidation independently.** Follow the shadow plan above with cache disabled first. Revisit static caching only after measuring meaningful reuse and checking moving-route cost. A new sun animation is outside scope and should not be added to create a use for distributed updates.

**P4 — Revisit async compilation only after the bottleneck changes.** If a repeat profile or first-use spell/equipment capture shows an eligible ShaderMaterial pipeline stall, repeat the isolated native toggle. Retain both awaited registration boundaries, preserve loader behavior and add the pinned guide link beside the call. Run at least five alternating warm built pairs and three fresh-owned-profile pairs, disclose cache policy, and record first completed frame, ready, long-task tails and fallback failures. Suggested adoption gate: ≥5% median ready improvement, or ≥20% worst-startup-long-task reduction with ready within 3% and first completed frame within 5%. Effects below 100 ms need strong repeatability. Verify Chromium, desktop WebKit, mobile depth fallback, first-use motion, rejection handling and device-loss reload. Do not enable by default if the benefit remains within noise.

**Release each accepted change separately.** Preserve >120 FPS on the established M1 Max/1280×720/seven-enemy suite; compare p95/p99 and long frames, not just means. Treat physical iPhone loading and GPU memory acceptance separately. Commit/push the accepted source, build and verify exact production assets, record the previous Pages deployment for rollback, and repeat production movement, cathedral and mobile/WebKit gates. Review live motion and deliver the required Telegram MP4 with a verified VE URL. Update `CURRENT.md`, the roadmap/current plan and retrospective with actual results. None of these future steps is recorded as complete by this investigation.

## Artifact use and verification

`async-experiment.patch` applies independently to source `837f18a`; do not stack the CSM patch when reproducing the load experiment. The archived load/profile probes use owned slot 14 (6573/10737). Their source records exact capture/cache/instrumentation behavior. `async-load-results.json.gz` is the losslessly compressed raw report; `async-load-summary.json` lists all eight rows. The CPU profile can be opened in Chrome DevTools' Performance/JavaScript profiling tools. The two experimental harness slots were stopped after capture.

For this documentation delivery: parsed every JSON/profile artifact (including the compressed report), checked both patches against `837f18a`, ran the native policy assertions and syntax checks for archived probes, reviewed four live stills, and ran `git diff --check`. Runtime tests and deployment are not claimed for an unchanged production game. No optimization is visually accepted or released by these stills.
