# Milestone 2 — actual-region composition checkpoint

2026-09-30, based on `8d04772`. **Milestone 2 remains open:** shared exact/VAT state transitions, action matching, animated bounds and varied-actor churn are next. This developer checkpoint fixes and verifies native crowd composition under unchanged region shadows. It adds no crowd runtime or assets to Pages.

## Root cause and change

The earlier permission-restricted attempt could only reproduce the composer failure offline. Full-access continuation now permits localhost, process inventory, Git and Grok. The original town helper was reproduced live: `topoSort → composeShader → composePbr → rebuildSingle → resolvePendingTaskMeshes → shadow-task`. Its composer lacked the native thin-instance fragment required by VAT. The native offline positive control and the live hidden-registration/public-rebuild candidate establish the cause and fix together.

Owned meshes remain hidden until the public `rebuildScenePbrPipelines(scene, true)` completes. A narrow, version-guarded bridge synchronously claims only this container's queued thin-instance builds before the first await. Otherwise native render-task material transactions can race the rebuild or redundantly rebuild the PBR family once per primitive. The bridge fails closed outside Lite 1.31.1 and preserves unrelated queued meshes. It is a documented limitation of the current public API, not a custom shader or shadow exclusion.

Automatic glTF ticking is suppressed for these VAT-only containers. One scene-owned callback updates retained native handles; removal stops only its owner's clocks. Abort during fetch/rebuild, partial insertion, unused bake textures and double disposal have explicit ownership. Registered meshes retire through native `removeFromScene`. Multipart names retain every material primitive. Prepared v1 appearances use strict existing migration; unknown schemas/catalogues fail. Unsupported Human shapes are rejected rather than silently rendered neutral. Stable ID phase replaces index phase; native offsets are frames, so seconds are multiplied by clip FPS. This is not yet the shared exact/VAT clock.

Version-pinned references are beside the code: [composer](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/material/pbr/pbr-compose.ts), [VAT fragment](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/material/pbr/fragments/vat-fragment.ts), [public rebuilding](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/scene/scene-rebuild.ts), [material transactions](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/scene/scene-material-swap.ts), [retirement](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/scene/scene-remove.ts). Runtime uses the game's one optimized Lite graph.

## Verification

**41/41 targeted tests pass**, including native GPU-free composition, actual-module lifecycle boundaries, cancellation/partial failures, shared texture ownership, stable phase and existing appearance/shadow contracts. Developer and Pages builds pass with existing chunk warnings. All **194 emitted Pages executable/assets files** remain byte-identical to released source `b362dbc`; [hashes](../../../baselines/character-mmo/crowd-region-2026-09-30/pages-bundle-comparison.json). This checkpoint does not require a new production deployment or infer newly measured cold-start results.

Live one/ten/100 correctness cases retain all dressed primitives, clocks and dynamic casters. Mount wall times are **105.1/84.1/92.4 ms**; each uses one shared **965,120-byte** VAT atlas. Wayfarer submits six primitives and Warden eleven. Every disposal and five additional mount/remove cycles returns to **136 meshes / 38 casters / zero VAT meshes**, with no runtime/GPU errors. The 100-town grid is diagnostic and intersects existing buildings; the motion clip instead places it in the open approach. Neither establishes walkable population placement or capacity.

A first receiver probe in existing gate-wall shadow was inconclusive and is retained. A lit meadow positive control finds **80 newly occluded receiver samples**; turning the camera away retains **82 offscreen shadow samples**. Removal leaves **zero ghost samples**. Existing shadows remain enabled. These checks complement town caster membership; they do not prove animated bounds at every action pose.

An independent Grok **4.6/high** review identified the queued-rebuild race and insufficient queue/shared-texture fixtures. Both were corrected and checked live. The reviewer owns no browser. The instancer **0.7.0** MIT tarball was evaluated without installation: compatible Lite peer, multipart IDs, middle removal and phase continuity work in the region. Adoption remains undecided pending native GPU retirement and atlas-sharing checks; apparent mesh-count recovery alone does not prove buffer retirement.

## Performance

M1 Max, one owned uncapped Chromium WebGPU page, **1280×720**, seven enemies, Havok, three **12-second** runs per route, no recording. All solo means exceed 144 FPS; no settled interval exceeds 16.67 ms. Raw intervals and nearest-rank tails are retained in [evidence](../../../baselines/character-mmo/crowd-region-2026-09-30/performance-summary.json).

| Route | Mean FPS range | Maximum interval |
| --- | ---: | ---: |
| Meadow | 197.3–197.7 | 13.1 ms |
| Town | 197.5–197.9 | 13.0 ms |
| Bridge | 235.6–236.0 | 10.6 ms |
| Cathedral | 233.5–233.6 | 12.2 ms |
| Forest | 213.2–223.6 | 13.6 ms |

The first town-only candidate ran 181.7–191.0 FPS against the differently warmed five-route town's 197.5–197.9, triggering investigation. All rows remain. A prescribed matched fresh town-only control runs **187.0–191.8 FPS**, candidate one actor **182.7–186.7**, a **2.49%** mean-frame-time cost. Teardown runs **191.1–191.5** with no persistent >5% regression against the matched control. Candidate p95 is 6.0–10.1 ms, p99 6.7–10.9, maximum 12.0. Mount is measured separately: 79.3 ms asynchronous wall time, warm-up frame maximum **17.0 ms**, zero >33.33 ms. These are throughput/correctness results, not per-frame 144 Hz or 100-actor capacity acceptance.

## Motion and remaining work

Reviewed [live MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/crowd-region-2026-09-30.mp4) shows one walking Wayfarer, ten idle Wardens, 100 walking actors, removal and ordinary Havok traversal. Capture has 542 timestamped frames, **1280×720**, square pixels, rotation zero, **17.746 s**. Post-removal movement is **17.62 m**, zero recovery teleports and zero runtime/GPU errors. VE returns `video/mp4`, byte ranges work, and direct playback/seek/fullscreen pass. Telegram **820** returned matching 1280×720 dimensions; client presentation remains uninspected.

Next: review the pure actor state worker; integrate matching Idle/Walk/non-loop actions into separate exact/VAT resources; prove pose continuity and conservative animated bounds; test varied actors, middle removal, appearance revision, unsupported-shape fallback and cancellation. Keep full milestone open until these gates and reviewed motion pass. Streaming milestone 3 follows acceptance. First-use startup GPU investigation remains deferred by the user.

## Ownership

Root owns harness slot 5: Chrome PID **9438**, CDP **9837**, Vite **5673** (npm PID 9313 / listener 9390). Only one game page rendered during measurements; all benchmark contexts closed and the original page is now blank. Existing Edge user tabs contain no game. Grok workers own no browser/server. The harness is retained for the next correctness package and must be stopped at handoff/session end. Previous permission failures and closed production diagnostic tab are historical, not current blockers.
