# V18 — vegetation stability

Third and final milestone in the authorized V16–V18 sequence. V17 is released and verified before this plan begins.

## Target and evidence

Preserve the approved meadow palette, atlas and planted locations while reducing visible changes during ordinary movement. Current grass swaps at 15 player metres from three small cards to two taller/wider cards; all pools repack only after two metres of movement. Density thinning and final removal are abrupt. Fast vertex flutter continues into subpixel foliage. The alpha cutoff rises at 46–58 camera metres, independently eroding the long-range moor cards.

1. Capture a baseline walk through the meadow. Keep the live camera and existing renderer.
2. Make the first two grass/moor cards identical across near/far prototypes; taper the additional near card before the earliest possible streaming switch. Preserve root placement. Other plant prototype morphing remains out of scope.
3. Derive each plant's deterministic removal radius from the existing density hash and thinning curve. Apply a continuous rooted scale taper in the vertex shader. CPU packing includes a two-metre margin so newly visible plants arrive at zero scale and outgoing plants vanish before removal. Keep pool capacities bounded and report saturation.
4. Attenuate high-frequency flutter with camera distance using the stable instance root. Keep low-frequency wind and player bending. Use a constant texture alpha threshold, separating leaf coverage from plant removal. No new atlas generation or transparent sorting path.
5. Unit-test CPU/GPU policy constants, streaming margins, deterministic density, scale continuity, root preservation and matching shared prototype geometry. Live-test animated movement, real instance counts, mobile/WebKit/depth fallback and lighting. Review a live MP4, correct observed defects, and publish through VE/Telegram.
6. Measure the complete town window separately at 1280×720, seven enemies, uncapped. Report >120 FPS target and all frame tails; record any extra draw/vertex cost. Commit, push, deploy and verify production.

## Sources and boundaries

[GPU Gems: Rendering Countless Blades of Waving Grass](https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-7-rendering-countless-blades-waving-grass) describes crossed cards, vertex wind and distance transitions. The project already uses that general approach; this milestone improves its transitions. [WGSL specification](https://www.w3.org/TR/WGSL/#smoothstep) defines the interpolation used here. Installed Lite 1.28 source supplies the actual instancing/material contracts. The scene is single-sample, so alpha-to-coverage cannot solve this without a separate render-target change. This pass does not promise complete antialiasing or eliminate all distant subpixel shimmer.

## Implementation and corrections

The two common grass/moor cards now have identical geometry, UVs, vertex colors and wind across both prototypes. The third card scales to its root between 10 and 13 player metres, before the earliest possible 15 m switch with two metres of packing lag. Its owned wind-alpha channel encodes root/tip as 2/3; the shader decodes the detail flag and restores wind weights 0/1. Other vegetation retains its existing prototype shapes.

Plant removal uses the inverse of each pool's thinning curve, with a four-metre rooted taper whose start cannot precede 13 m. CPU packing includes two metres beyond the removal radius. A shared integer hash on quantized float32 roots replaces the old sine hash, making CPU/GPU selection agree exactly. All 126,711 planted locations remain; the identities of plants retained at distance change with the new deterministic hash. Distant fast flutter fades over 10–28 camera metres; slower wind and player bending remain. Atlas alpha threshold stays 0.48. Three material configurations share one atlas and the existing twelve draw batches.

Live validation caught two concrete mistakes before release: WGSL required explicit parentheses around multiplication on both sides of XOR; the diagnostic assumed four vertices per quad, while `Batch.quad` expands to six triangle vertices. Both were corrected. The final geometry test checks all twelve common vertices and all six detail alpha values. GPU probes use shared production WGSL and actual packed roots plus synthetic coordinates. Whole-route cumulative drop counters and fresh post-resize GPU errors strengthen the final check.

## Verification and motion review

113 relevant unit tests and the release build pass. Live meadow traversal advances 28.00 metres with no GPU/runtime errors; 64 GPU policy samples match CPU seed/radius/taper calculations. Shared grass/moor geometry matches. No pool saturation was observed in the recorded pass; the final strengthened test also checks cumulative drops throughout the route. Source population remains 126,711. At the final moor view, near instances remain 1,730; submitted far instances increase from 4,512 to 5,459 to cover the safety margin, including plants already at zero scale.

Reviewed [11.65-second live MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/v18/2026-09-24-meadow-stability.mp4), delivered as Telegram **756**, includes a keyboard walk and a labeled cut to the moor. HTTP 200 `video/mp4` and 206 byte-range seeking pass. The view keeps the existing palette and dense foreground, with matched grass silhouettes through the distance switch. Some subpixel shimmer, short ordinary-foliage range, and other plant prototype changes remain; this is not a temporal-antialiasing implementation.

Injected mobile depth fallback/touch movement **26.77 units**, desktop WebKit movement **17.73 units**, town actor shadows **58 samples**, fog shadows **45 samples**, and full HDR/math/bypass/disposal checks pass without runtime/GPU errors. Physical iPhone acceptance for V18 remains unmeasured.

Separate uncapped M1 Max / 32 GB / Chromium 153 WebGPU benchmark, 1280×720 internal/viewport, DPR 1, seven enemies, no recording, ten seconds from town z=80: **247.93 FPS**, 2,480 samples, mean **4.033 ms**, median **2.5**, p95 **7.3**, p99 **74.4**, worst **85.1 ms**; 29 frames exceed 16.667 ms. Final sampled draw count remains **290**; scene triangles **496,791**, versus V17's **489,529** at the matched route's final sample. The margin/shader work costs some throughput in these single runs (V17: 260.67 FPS), still above the 120 FPS target. Long frames remain unresolved. The isolated benchmark slot was stopped afterward.

## Release

Commit, push, production deployment and production verification follow these local gates.
