# V11 — a fully shadowed street

## Target

In an ordinary Hollowmere gameplay view, buildings and trees block the same sun for the ground, foliage, animated actor, and fog. The actor casts a moving silhouette and crosses a visible sun/shadow boundary. Preserve readable ambient and lantern light. Retain V10 mountain occlusion and target above 120 FPS under the documented uncapped benchmark.

## Findings and design

V10's cached 2048 world shadow map controls fog. Custom `shade()` ignores visibility, foliage adds unoccluded transmission, and animated actors are absent from the caster list. The world map covers too much area for detailed character shadows.

Use Lite's native cascaded directional shadow generator for the main sun: three stabilized cascades covering the playable foreground and middle distance, with world-space bias and cascade blending. Native PBR receives this map. Custom WGSL receivers use the public `getCsmReceiverTexture` / `onCsmReceiverUpdate` bridge. Keep the cached broad map for distant fog and surfaces beyond the near shadow range, with the same direction and world casters. Near fog samples use the cascades so buildings and actors occlude light consistently. Surface shadowing affects direct sunlight, rim and leaf transmission; ambient, emissive, and local lamps remain independent.

Native skinned shadow support must use the current skeleton and equipment, never an undeformed position-only character override. Opaque world batches can retain their cheap depth material. Grass receives sunlight shadows in this milestone; fine alpha-tested wind casters belong to milestone 6 unless their existing material path can be reused safely. Contact ambient occlusion is milestone 2; the sun silhouette supplies direct ground contact here.

Research: [Lite feature comparison](https://github.com/BabylonJS/Babylon-Lite/blob/master/docs/lite/02-feature-comparison.md), [Lite architecture](https://github.com/BabylonJS/Babylon-Lite/blob/master/docs/lite/architecture/00-overview.md). Implementation authority is installed `@babylonjs/lite` 1.28 declarations and `lib/shadow/csm-directional-shadow-generator.js`, `csm-shadow-task-hooks.js`, and skeleton shadow support. The Lite docs MCP is unavailable in this session.

## Implementation checkpoints

1. Add shared sun-shadow controller, explicit caster/receiver selection, dynamic actor refresh, debug state, and lifecycle cleanup.
2. Wire custom world/foliage receivers and native PBR skin shadows. Preserve non-solar lighting in shadow. Check biases and cascade seams in live movement.
3. Integrate near cascades into volumetric sampling with a defined transition to the far map. Preserve distant ridge tests.
4. Add targeted checks: sun/shadow receiver response, actor animation and equipment membership, mountain occlusion, keyboard traversal, portrait resize, no GPU errors. Inspect actual captures.
5. Record and review the street traversal; correct visible defects. Benchmark separately at 1280×720 internal resolution with uncapped owned Chromium. Deliver live MP4 via Telegram and update CURRENT with results and remaining limits.

## Acceptance

- Building/tree occlusion is visible on both ground and actor; actor shadow follows movement and pose without a rigid bind-pose silhouette.
- No sunlight transmitted through occluding buildings in the near fog; distant mountain shafts remain tied to actual occlusion.
- Shadows preserve ambient and lamp illumination; no opaque grass-card rectangles, severe acne, detached feet, or obvious cascade discontinuities in the review route.
- Build and relevant tests pass. Desktop and portrait WebGPU views render without validation errors.
- Above-120-FPS target measured honestly; tail stalls and any missed criterion recorded rather than hidden.

## Results

Implemented locally on 2026-09-24. V10 (`8c550ef`, Pages `372548bd`) remains the deployed production baseline.

- Three 2048 cascades cover 180 units. World surfaces, grass, flowers, native character materials, and near fog now consume sun visibility. Native skinning drives actor shadows; hidden/parked meshes are excluded. NPC receiver flags are set before compilation.
- The distant map has its own frame-graph task. Lite 1.28's mixed PCF/CSM native-light binding failed validation; keeping only CSM on the scene sun resolves this. A second compatibility guard rebuilds cascade tasks on caster membership changes to prevent stale skinned shadows. Details: [architecture](sun-shadow-architecture.md).
- The scene is drawn once, after both shadow passes. The direct `?noPost` route has the same ordering. Live direct rendering and full scene disposal both passed without runtime/GPU errors.
- `check-sun-shadows.mjs --tag v11-final-native-receivers`: actor caster removal changes **41** ground samples; actual W input travels **15.51 units**; all **38** visible native material receivers are enabled; street occlusion toggling and portrait resize pass; zero runtime/GPU errors.
- `check-volumetric-fog.mjs --tag v11-far-regression`: **45/45** GPU/triangle-ray visibility matches, 13 points relit by removing the ridge batch and 14 blocked again on restoration; movement 4.90 units, stable far-map cache during camera movement, portrait resize, zero errors.
- Build, spell-visibility/targeting tests, and `git diff --check` pass.
- Final uncapped desktop measurement: **397.75 FPS** average, mean **2.51 ms**, p95 **4.70 ms**, p99 **7.70 ms**, worst **20.30 ms**. 600 retained samples; 5 exceeded 8.33 ms, 2 exceeded 16.67 ms; 233 draw calls. Conditions: Mac Studio, Chromium/WebGPU, `--disable-gpu-vsync --disable-frame-rate-limit`, 1280×720 internal and viewport, DPR 1, seven enemies, actual W movement, no recording. These are animation-frame intervals, not GPU timings or an iPhone result. Benchmark browser/server were shut down afterward.

### Visual review and remaining scope

The current sun puts Hollowmere largely in the mountain shadow. The review route therefore walks from sunlight into tree/building shade on the southern approach, then cuts to an actual street traversal. This preserves the approved sun position. World, grass, and actor receive the same transition; the town keeps its warm lamp pools and distant mountain occlusion. Alpha foliage casts no solid card rectangles because fine foliage casting is deferred.

The final reviewed live MP4 is **15.82 seconds**, 1280×720/60 FPS output with a 960×540 internal scene and 480×270 fog integration buffer. Sent via `tg file` to **Telegram 743**. File: `ve-capture/ashen-reach/sun-shadows/video-v11-final-2026-09-24/v11-street.mp4`. Source capture: 950 frames at 60.01 FPS, zero runtime/GPU errors. Frames from the sunlit path, moving shadow, shade transition, and street traversal were reviewed before delivery. This is live gameplay capture, not an offline render.

Remaining milestones are deliberate: ambient contact/occlusion, linear HDR composition, replacement of geometric lantern cones, fine wind/alpha foliage casters, and temporal reconstruction. The distant map remains static-world-only; native PBR uses the near cascades. Mobile performance and device recovery need separate hardware testing. This milestone does not claim a complete global illumination solution.
