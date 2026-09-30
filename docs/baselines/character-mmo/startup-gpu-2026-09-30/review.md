# Public startup GPU review — 2026-09-30

Read-only. Pinned Lite **1.31.1** (`package.json`, installed `node_modules/@babylonjs/lite`). MCP Lite docs track **1.32.0**; API claims below are from installed sources. Parent owns live experiments. Do not drop first-run rows. Do not weaken dressed / grounded / GPU-completed / input.

## Evidence already in hand

**Public unthrottled** (`docs/baselines/character-mmo/production-customization-2026-09-30/cold-production-native-{default,largest}.json`): 20+20 fresh Chrome processes against `play.sparkify.dev`, native network, 1280×720, same probe contract.

| Cohort | p95 playable | max | ≤1s | first-run playable | submit → first-gpu |
| --- | ---: | ---: | ---: | ---: | ---: |
| Default | 1012.4 ms | 8291.1 ms | 18/20 | 8291.1 ms | 734.9 → 8287.3 ms (**7552 ms**) |
| Largest | 1030.9 ms | 1455.2 ms | 16/20 | 1455.2 ms | 724.8 → 1446.4 ms (**722 ms**) |

Default run 1 marks (`cold-production-native-default.json` row 1): `begin` 349.8, `engine-created` 378.6, `gpu-probe-end` 432.7 (**54.1 ms** probe), `register-end` 598.5, `first-render-return` 707.3, `supported-frame-submitted` 734.9, `first-gpu-completed` 8287.3, `supported-frame-completed` 8289.5, `playable` 8291.1. `tasks: []`, `gpuErrors: []`, `frame: 9`, input upper bound **1898 ms**. Subsequent default fences **66.6–89.4 ms** (median 77.5). Ordinary `begin` **274.7–706.1 ms**.

**Local compressed Pages 50 Mbit/s / 40 ms** (`cold-pages-{default,largest}.json`): default p95 **835** / max **839.4**, largest p95 **943.8** / max **944.8**, 20/20 ≤1 s. First local fences **~67–85 ms**. `begin` **168–188 ms**. World stage **~432–442 ms** (download-bound).

**Parent diagnostic (this session, 3 public runs):** first playable **9745 ms**; device creation **1596 ms**; queue-ack gap **7272 ms**; `createRenderPipeline` JS API **≤0.1 ms**; subsequent **603 / 647 ms**. Warm next-run browser trace **655 ms**; `CrGpuMain` WebGPU command tasks **73.9 ms**, no 7 s command-task blob. Supports GPU-service / backend warmup as a **hypothesis**. It does not prove one shader, one pipeline, or one Dawn/Metal cache key.

**Earlier async-shader trial (negative):** `docs/archive/plans/rendering-performance-investigation-2026-09-26.md`. Eight loads, `enableAsyncShaderPipelineCompilation` moved 17 eligible pipelines and left 72–77 synchronous; ready / first-GPU / long-task medians unchanged or slightly worse. First queue completion already lagged the first render callback by ~0.9 s with short JS pipeline calls. PBR / post / effects are outside that opt-in (`architecture/53-async-shader-pipeline-compilation`; installed `lib/material/shader/enable-async-shader-pipeline-compilation.js`).

## Ranked findings

### 1. First-process GPU-service / backend warmup stalls `waitForGpuIdle` after a dressed submit

**Evidence.** Default public run 1 submitted the supported frame at 734.9 ms and reached `first-gpu-completed` at 8287.3 ms. Parent reproduction: 9745 ms playable, 7272 ms queue-ack, pipeline JS ≤0.1 ms, zero probe long tasks. Installed fence is `GPUQueue.onSubmittedWorkDone` (`node_modules/@babylonjs/lite/lib/engine/engine.js:205–206`, comments at `src/ashen-reach/main.js:493–500`). The render loop already fences every frame the same way (`src/ashen-reach/render-loop.js:12,16–19`). Warm `CrGpuMain` command tasks are ~74 ms, matching later fences (~77 ms), not the 7 s hole.

**Hypothesis.** Chromium GPU process / Dawn / Metal first-use (process or origin) warms on the first real queue, including `requestDevice` (parent 1596 ms; baseline run 1 device create was only 28.8 ms after `begin` — the cost is **variable**). JS pipeline construction is not the 7 s. A single ShaderMaterial or one CSM pass is **unproven**.

**Not claimed.** Async shader compilation would close this. The 2026-09-26 trial was negative, and PBR character/post pipelines used at first play are outside that module. `registerScene` only awaits `_prepareShaderPipelines` when that opt-in is installed (`lib/scene/scene-core.js:249–277`); the game does not call `enableAsyncShaderPipelineCompilation`.

**Next experiment.** Five public fresh-process traces with init-script clocks on `requestAdapter`, `requestDevice`, first `queue.submit`, and `onSubmittedWorkDone` resolve, plus Chrome categories covering GPU/Dawn/Metal (parent already has one warm 655 ms trace). Keep the playable boundary. Compare process 1 vs 2 on the same origin. Record device-create and queue-ack separately. Success: a named GPU-process event spanning ≥5 s on the slow run and absent on the next process, or a clear miss that moves the search.

### 2. Local 50/40 passing does not measure public GPU-service cold or CDN begin variance

**Evidence.** Local Pages 50/40: begin 168–188 ms, fence ~77 ms, all 80 rows ≤1 s (`cold-pages-summary.json`). Public native: begin 275–706 ms; one 8 s GPU fence; p95 1012 / 1031 ms. Probe already states OS/GPU-driver caches are uncontrolled (`scripts/ashen-reach/probe-playable-startup.mjs:40–43,3`). Vite local Brotli plugin (`vite.config.js:147–153`) and HTML preloads (`vite.config.js:155–196`) make local discovery more uniform; public still pays TLS/CDN/Early-Hints (`initiator: early-hints` on `meshopt_decoder.js` in default run 1).

**Hypothesis.** Local cohorts often run after GPU-service and `127.0.0.1` shader/disk caches are warm. Public `play.sparkify.dev` is a different origin. CDP `emulateNetworkConditions` does not throttle GPU.

**Next experiment.** Pair A/B on one quiet machine, same Chrome channel, first process of each origin after a GPU-cache-cold start (reboot or documented Chrome shader-cache disable, disclosed): compressed local Pages vs public URL, n=5 each, native profile. Report device-create, queue-ack, `begin`, playable. Do not average away process 1.

### 3. Ordinary public p95 miss is `begin` / download, independent of the 7 s fence

**Evidence.** Default run 10: `begin` 706.1, submit 919.4, fence 77.6, playable **1012.4** (the p95 row). Resource timing: `ashenReach-*.js` 303–643 ms, `lite-runtime-*.js` 303–695 ms, Havok 304–783 ms, `near-*.br` 304–787 ms. Default `begin` range 275–706 ms; cpu-to-submit 184–470 ms. Encoded bytes at boundary are stable (~3.264–3.268 MB default, ~3.813–3.816 MB largest). Largest p95 1030.9 ms with fences of 96 ms (runs 6, 11) plus `begin` 474–554 ms.

**Hypothesis.** Unthrottled HTTP/2 + CDN TTFB jitter, not extra playable payload. `lite-runtime` grouping (`vite.config.js:81–85`) already collapses serial Lite chunks; remaining cost is bytes and RTT.

**Next experiment.** From existing `resources[]` (and one new 20-run public native if needed), attribute `begin` to HTML TTFB vs module download vs evaluation for every row with `begin>500`. One change at a time if a single asset dominates (preload / priority / Early-Hints). Gate remains p95 playable with every outlier kept.

### 4. Public `world-end` 30–340 ms is a second CPU/decode jitter; local 50/40 hides it behind download

**Evidence.** Default public world durations: 30, 92, 54, 37, **267**, 85, 33, 34, **334**, 84, 171, 50, **338**, 229, 32, 79, 72, **341**, **325**, 232 ms. Local 50/40 world **432–442 ms** every run (geometry still arriving). Fast-start world is `createStarterWorld` (`main.js:177–180`), not `buildChurchyard`. Starter textures often `transferSize: 0` with non-zero `encodedBodySize` (memory/disk cache).

**Hypothesis.** Meshopt decode + GPU upload + main-thread world install, contended with other processes. Not the 7 s GPU fence (the 8291 ms row had the **fastest** world, 30 ms).

**Next experiment.** Add existing-style `startupMark` splits around starter decode vs `createMeshFromData` / texture `loadTexture2D` only in a diagnostic probe (parent-owned). Correlate 30 ms vs 340 ms rows with `transferSize` and machine load. No terrain-generator rewrite.

### 5. First GPU fence and supported-frame fence are different submits; both wait on the same GPU-service hole

**Evidence.** `onFrameSubmitted` requires `dressed && player.getGrounded()` (`main.js:473–480`). `dressed` is set before register (`main.js:454`). `start()` resolves at the first `render()` **before** GPU idle (`frame-scheduler.js:61–64`; `main.js:491–500`). Default run 1: `first-render-return` 707.3, `supported-frame-submitted` 734.9 (**+27.6 ms**). Later default rows: submit 24–34 ms after first-render. First frame is often not yet Havok-supported (`src/player.js:372–386,594`). Both fences then complete within ~2–13 ms of each other. `frame` at playable is **8–12** on slow and fast rows (`maxPending: 4` in `render-loop.js:8`).

**Hypothesis.** Grounding needs a physics tick inside `onBeforeRender` (`main.js:289`). In-flight cap 4 explains 8–12 frames around a long fence; it does not create a 7 s queue-ack by itself (`onSubmittedWorkDone` is work submitted **before** the call).

**Next experiment.** Diagnostic counters: `ASHEN.gpu.frames`, `getGrounded()`, and fence identity at each of first-render / supported-submit / first-gpu / supported-complete. Confirm frame 1 vs supported frame. Keep awaiting **supported** completion for playable.

### 6. Probe long tasks and GPU timestamps will miss this class of stall

**Evidence.** Probe observes `longtask` only (`probe-playable-startup.mjs:68–77`). All 40 public native rows: `tasks: []`. Parent: pipeline JS ≤0.1 ms. Lite `isGpuTimingSupported` / `setGpuTimingEnabled` use `timestamp-query` pass writes (`lib/engine/engine.js:269–306`; `lib/engine/gpu-timer.js:33–40`) and measure encoded GPU work **after** pipelines exist. `gpu-compatibility.js:13–31` already calls `createRenderPipeline` during probe (default run 1 **54.1 ms**, later **~1.8 ms**); that is a small first-pipeline JS/GPU hiccup, not the 7 s.

**Hypothesis.** Compilation / GPU-process warmup lives in `CrGpuMain` / Metal, outside longtask and possibly outside timestamp queries.

**Next experiment.** Extend the existing probe init wrapper (already patches `GPUAdapter.requestDevice`) with durations for adapter/device/submit/`onSubmittedWorkDone`, and one Chrome trace per first/second process. Leave `timestamp-query` off the playable path until a warm frame shows GPU-pass time, not service warmup, as the remainder.

### 7. Input 1898 ms on the default outlier is after playable; treat it as a separate tail

**Evidence.** Playable 8291 ms, then `keyAt` 9173 → `observedAt` 11071, `responseUpperBoundMs` 1898, frames 9 → 38 (`cold-production-native-default.json` run 1 `input`). Background work starts at `playable` (`main.js:520–525`, `bg-start` 8291.2). Largest input max 236 ms.

**Hypothesis.** Late register / foliage / hostiles (`main.js:682–693`) contending after overlay removal, plus leftover GPU-service. Not a reason to move the playable fence earlier.

**Next experiment.** On the next public first-run outlier, record `bg-*` marks vs `input.responseUpperBoundMs` and `ASHEN.gpu.frames`. One row with background imports disabled (diagnostic query) vs default.

## Measurement validity pitfalls

1. **Empty longtask list ≠ idle GPU.** GPU-process work does not create window long tasks.
2. **`createRenderPipeline` JS time ≠ compilation / queue-ack.** Parent ≤0.1 ms beside a 7 s `onSubmittedWorkDone`.
3. **`waitForGpuIdle` is queue completion, not scanout** (`engine.js:201–206`; `main.js:493`). Keep it as the playable GPU boundary.
4. **First `onSubmittedWorkDone` can include GPU-service warmup** that later processes do not pay.
5. **Local 50/40 after other WebGPU work** warms GPU-service and localhost caches; it can pass while public first-process fails.
6. **Origin / disk shader caches uncontrolled.** Probe text already says this. `127.0.0.1` vs `play.sparkify.dev` may not share them.
7. **`begin` includes HTML + module graph** (`main.js:61–72`). CDN TTFB shows up as `begin`, not as GPU.
8. **`transferSize: 0` with `encodedBodySize > 0`** is cache/Early-Hints, not a missing download.
9. **World duration on 50/40 is not the same clock as public native world duration** (download-bound vs CPU-bound).
10. **`frame` 8–12 at playable is normal** under `maxPending: 4` + rAF during a fence; it is not proof the GPU produced 9 completed scene presents.
11. **Nearest-rank p95 with n=20 is one row** (default p95 = run 10 at 1012.4). Retain max and count ≤1 s.
12. **Playwright `channel: "chrome"` headless** (`probe-playable-startup.mjs:49`) is not a physical iPhone and not a visible tab vsync.
13. **Lite MCP 1.32.0 vs installed 1.31.1.** Confirm every API against `node_modules/@babylonjs/lite`.
14. **Do not treat parent 3-run device-create 1596 ms as the same as baseline run 1 engine-created 28.8 ms.** Both are real; GPU-service cost is bursty.

## Safe existing-native / API reuse (no Classic)

Already on the playable path, keep:

- `waitForGpuIdle` / `queue.onSubmittedWorkDone` (`engine.js:205–206`) as the completion boundary.
- `registerSceneWithShadowSupport` awaited before first render (`main.js:469–470`; `scene-core.js:266–277`).
- `createEngine` opportunistic `timestamp-query` (`engine.js:66–73,101–105`).
- Probe `uncapturederror` hook (`probe-playable-startup.mjs:78–85`).
- Unconditional `startupMark` names (`src/ashen-reach/startup-trace.js`); add names, do not rename.

Diagnostic-only, existing Lite:

- `setGpuTimingEnabled` / `isGpuTimingSupported` behind `?gpuTiming` (`main.js:288`, `metrics.js:154–161`) for **warm** GPU-pass time.
- `enableAsyncShaderPipelineCompilation` remains installed in the package and **off**. Revisit only if a new trace shows eligible ShaderMaterial first-bind as the stall **and** a paired toggle beats the 2026-09-26 result. PBR/post still out of scope.

Avoid: Classic `beginAnimation` / `ImportMeshAsync`; app-owned pipeline caches; awaiting `waitForGpuIdle` as a per-frame hot-loop addition beyond the scheduler’s existing completion (`engine.js:203–204` already warns). Starter-world dispose already fences uploads (`starter-world.js:571–575`); that path is teardown, not playable.

## Instrumentation recipe (parent)

1. Init-script timestamps: `requestAdapter`, `requestDevice`, `queue.submit` count/time, `onSubmittedWorkDone` create→resolve, `createRenderPipeline` / `createRenderPipelineAsync` / `createShaderModule` (expect ~0 for JS).
2. Existing marks plus `grounded` boolean on first two `onFrameSubmitted` calls.
3. One Chrome trace for public process 1 and process 2; keep `CrGpuMain`, Dawn, Metal if present.
4. Resource timing already collected; slice `begin` contributors.
5. Same `probe-playable-startup.mjs` assertions: grounded, physics, no loader, supported-submit ≥ equipment-end, supported-complete ≥ submit, playable ≥ supported-complete, canvas 1280×720, no GPU errors.

## What would falsify H1 (GPU-service warmup)

A slow first public run whose `onSubmittedWorkDone` gap is 7 s **and** whose GPU-process trace shows a 7 s **application** command/encode blob (one pass, one pipeline compile identifiable in JS), or a 7 s **main-thread** task the current longtask observer missed. Parent’s warm 73.9 ms `CrGpuMain` command tasks do not yet falsify H1; they describe the fast run.
