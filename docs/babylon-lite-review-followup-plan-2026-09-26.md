# Babylon Lite review follow-up plan

Source: [adversarial review](reviews/babylon-lite-1.31.1-adversarial-review-2026-09-26.md). This pass addresses findings whose fix is clear from the installed Lite 1.31.1 API and current game code.

1. **Shadow teardown.** Stop new shadow work on scene disposal, defer release of generator-owned depth textures and uniform buffers until submitted GPU work completes, and drain Lite's deferred resource retirements. Expose the completion promise for disposal checks. Verify repeated live scene disposal with GPU errors observed *after* the fence.
2. **Disabled shadow work.** Skip the custom far sun task when sun shadows are disabled. Skip local spot tasks when sun shadows, local lighting, or local shadows are disabled. Keep existing receiver bindings so enabling shadows resumes the maps. Check draw counters through off/on transitions.
3. **Cheap render-pass allocations.** Reuse the display uniform buffer and contact-occlusion camera position object. Reconcile dynamic sun casters without making a filtered array every frame. Verify the relevant effects, caster changes, and live rendering.
4. **Dependency reproducibility.** Pin Havok to the installed and tested `1.3.14`; run the physics lifecycle test and built movement check.

The review's socket-transform allocation is older than this migration and has no measured frame-tail attribution. Keep Lite's public matrix functions for now; profile it alongside the bridge spikes before substituting project math. Do not remove the guarded CSM retirement bridge or replace half-resolution targets with floor-rounded Lite scaling: the review found those compatibility constraints still apply.

Acceptance: focused tests, build/runtime checks, live scene and shadow toggle probes, uncapped 1280×720 movement/performance comparison to the tracked baseline, reviewed motion capture, and no GPU errors. Record any verification limits rather than inferring visual acceptance from tests.

## Local implementation and verification

The four changes above are implemented. Shadow controllers now expose `gpuRelease` so disposal probes can wait for the Lite GPU idle fence and resource-retirement drain. A mock lifecycle test proves their depth textures and uniform buffers remain owned until the fence resolves. The far and local custom maps stop rendering when their respective shadow controls are off; the live off/on probe counted far/local calls `17/34 → 17/34 → 53/106`, with no GPU errors. Dynamic sun caster reconciliation reuses its candidate buffer. The display pass reuses its uniform payload, contact shadows reuse the last camera position, and Havok is pinned to `1.3.14`.

`npm run build` and 29 focused tests passed. Live camera disposal, sun shadow movement/actor silhouettes, local lights, mobile portrait, and a separate `noPost` scene disposal passed with zero runtime/GPU errors. The comprehensive HDR script timed out on its later third reload before disposal while multiple WebGPU tabs were active; a fresh isolated `noPost` load and fenced disposal passed. The full HDR script is not counted as a pass.

Uncapped Chromium 153 WebGPU on M1 Max, 1280×720 canvas, seven enemies, three 12-second unrecorded walking runs per route: **180.73 / 220.83 / 227.16 / 192.51 FPS** for town / bridge / cathedral / forest. The preceding F1–F7 candidate measured **179.43 / 218.88 / 225.53 / 191.68 FPS** in the same conditions. Worst current frame was **22.1 ms at bridge** (p99 at most 10.5 ms there); frame-time tails remain unexplained. All 12 runs had active Havok, no recovery, no browser/GPU errors, and no VSync cap. Raw report: `/tmp/ashen-review-followup-performance.json` (local artifact).

Reviewed [live walking motion](https://ve.sparkify.dev/wow-clone/ashen-reach/lite-review-followup-2026-09-26.mp4) lasts 15.851 seconds at 1280×720 square pixels. This capture is visual evidence; the uncapped measurements above were recorded separately. Physical iPhone acceptance remains outstanding.

## Production release

Source commit **`b3e88c7`** was pushed and deployed to `play.sparkify.dev` as Pages deployment **`3f0cdce8-f539-49d4-9e49-89bf6c1c511d`**. Previous production / rollback deployment: **`ec4176ce-5f5a-43d4-a0a4-7f350c46b9b4`**. The public HTML loaded `ashenReach-DGHroqNh.js`, matching the staged bundle; all **347** checked JavaScript, woodland, texture, HTML, and Havok WASM files matched the staged build.

The first production movement probe reported 0 m with an ungrounded player. A fresh retry moved **14.01 m**, and a focused/grounded rerun moved **14.00 m**, both with Havok active, seven enemies, zero recoveries, and no runtime/GPU errors. The first failure was a test-context false negative consistent with a background tab pausing the frame scheduler; `check-built-runtime.mjs` now brings its page forward and waits for grounding before pressing keys. Production Chromium mobile depth fallback and native touch moved **26.09 m**; desktop WebKit moved **17.40 m**. Both reported zero runtime/GPU errors. All five cathedral routes (both bell towers, both chapels, gallery/parapet) were entered and exited with Havok active and zero recoveries.

Telegram motion delivery **781** returned matching **1280×720**, 15.851-second metadata. The VE URL above returned `video/mp4` and supported byte-range playback. The user subsequently reported successful physical iPhone 14 Pro Max play at approximately 60 FPS; no instrumented device frame-time trace was collected. [The bridge interval follow-up](bridge-frame-spike-followup-2026-09-26.md) found no repeatable stall. Startup device loss before the render loop and late material compilation remain unverified risks; changing those requires a targeted reproduction. The guarded CSM task retirement and Lite 1.31.1 compatibility exceptions remain intentional.
