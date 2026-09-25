# V17 — frame pacing and repeated render work

Second of three authorized milestones. V16 is released (`8e9fc92`, Pages `508c1b3b`). Its 1280×720 uncapped town run averaged 276 FPS but retained p99 59.3 ms and worst 73.4 ms. Investigate before changing the rendering budget.

## Target and sequence

1. Profile the full town traversal using an isolated uncapped browser: CPU samples, frame durations, pipeline construction and memory/long-frame observations. Record profiler overhead and distinguish GPU/compositor stalls from JavaScript work.
2. Identify repeatable game-side work from source and profile. Implement the smallest substantial improvement supported by evidence; candidates include repeated posed-bound scans and repeated shadow/material setup. Preserve animation updates, caster invalidation, current images and two-map budget.
3. Extend measurements to retain the complete requested window and associate long frames with route/state. Add regressions for the specific cache/invalidation contract, including stationary animation, replacement materials, toggles and slot reassignment.
4. Compare matched before/after runs at 1280×720, seven enemies, no recording. Report all samples and tails; do not discard stalls or call average throughput a stable frame-rate guarantee. Target >120 FPS and a demonstrated reduction in the identified repeated work.
5. Run gameplay/HDR/shadow/mobile checks, review a live traversal clip and deliver through VE/Telegram. Commit/push, deploy, verify production before starting V18.

## Guardrails

Do not lower resolution, hide enemies, reduce map sizes or weaken shadows to manufacture a pass. If the measured long frames are outside the game-side change, report them as remaining; acceptance also requires actual workload reduction and preserved rendering, not an unsupported claim that all stutter is gone.

## Implementation and findings

The 15-second CPU traversal identified repeated HUD layout reads and light-bound scans. `ResizeObserver` now supplies CSS canvas dimensions to nameplate projection; scene disposal disconnects it. Both lamps share one posed world box per mesh per frame. The epoch advances after body/combat/equipment animation, preserving stationary animation, replacement meshes and conservative unknown-bound behavior. Cache counters are exposed for live integration verification.

The benchmark now separately reports `fullWindow`, retaining all frames for the requested duration. The historical top-level HUD summary remains limited to 600 frames; use `fullWindow` for tails. A regression puts a stall before the last 600 frames and verifies it remains counted.

Matched instrumented CPU profiles at 1280×720, seven enemies, three five-second town walks: HUD `project` self samples **934.33 → 8.75 ms**; posed bound evaluation **362.83 → 185.54 ms**. These sampling totals demonstrate reduced work, not an end-to-end FPS guarantee. Source profiles are under ignored `ve-capture/ashen-reach/v17/profile-{before,after}`.

Full-window baseline: **266.12 FPS**, 2,661 frames, mean **3.758 ms**, p95 **6.4**, p99 **70.2**, worst **76.5 ms**. Clean final browser run: **260.67 FPS**, 2,619 frames, mean **3.836 ms**, median **2.6**, p95 **6.7**, p99 **70.3**, worst **80.2 ms**, 30 frames above 16.667 ms. Both use M1 Max / 32 GB, Chromium 153 WebGPU, 1280×720 internal/viewport, DPR 1, seven enemies, uncapped, ten seconds from town z=80 after warmup, no recording. The baseline retained lightweight pipeline/long-frame diagnostic hooks; the final run restarted the harness to remove them. This is not evidence of a throughput improvement. Average remains above 120 FPS; long-frame behavior remains unresolved.

Pipeline creation continued during traversal (106 before, 79 after); cache membership changes and CSM task retirement are plausible sources, not proven attribution for individual stalls. Queue writes dominate other CPU samples. Do not replace safe caster/task invalidation with an unverified cache to conceal this limit.

## Verification

102 relevant unit tests pass, including cached skeleton animation, invalid/missing bounds, replacement meshes, CSS resize/disposal and full-window metrics. Build passes. Live town tests: 58 actor/restoration samples, 49 fog samples, zero static redraws across 96 hits, 1,824 bound evaluations plus 1,824 cache hits during real animation, 10.97 units movement. Material tests: 100 shadow-suppressed specular samples, 15.39 units movement. HDR math/bypass/disposal and portrait checks pass. Injected Chromium depth fallback/touch movement 26.21 units and desktop WebKit movement 16.68 units pass without runtime/GPU errors. These are emulation/desktop checks, not fresh physical iPhone acceptance.

Reviewed [10.2-second live MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/v17/2026-09-24-traversal.mp4) shows material toggles and keyboard traversal with a labeled cut; 1280×720 capture, separate from performance measurements. HTTP 200 `video/mp4` and 206 byte-range seeking verified. Production release evidence follows.

Released and pushed **`b3183c8`**, Pages **`a35f2e7e`**. Production JS, stone texture and Havok WASM match build/source bytes. Production street tests retain 58 actor/restoration samples, 57 fog samples, 1,824 evaluations/1,824 hits, 11.31 units movement. Production injected mobile fallback/touch movement 26.55 units and WebKit movement 16.24 units pass with no runtime/GPU errors. Telegram **755** carries the reviewed MP4. Second of three milestones complete.
