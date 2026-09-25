# V15 — shadowed Hollowmere street

## Production release

User authorized commit, push and production deployment. Game commit **`2dc981b`** is on `origin/main`; Pages **`31f85684`** serves https://play.sparkify.dev. Release build and 72 tests pass, including the upload-order regression below. All 317 deployed JavaScript files match `dist` byte-for-byte; the 2,094,563-byte Havok WASM matches source and has the correct MIME type and magic bytes.

Production street checks: ten fixtures/two slots, 57 actor and restored-shadow samples, 49 fog samples, zero static renders across 96 hits, 11.20 units of actual movement, no runtime/GPU errors. The check now waits for slot weights to reach 1 before comparisons; a fixed 800 ms delay was insufficient during cold production loading and confounded the initial fog comparison with a fading light. That first comparison was discarded and rerun after the wait correction. This changes only the verification script.

Production desktop WebKit: 16.23 units of visible movement. Chromium with injected iPhone depth failure: empty-fragment fallback, 26.77 units of visible touch movement and passing capture-loss, cancellation, menu and blur recovery. Physical iPhone acceptance remains pending. Production evidence is under `ve-capture/ashen-reach/street-lights/production-2dc981b/`.

Reviewed [production MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/street-lights/production-2dc981b.mp4), 12.05 seconds, recorded from the public game. Chromium/WebGPU, 1280×720 recording / 960×540 internal, no enemies, labeled diagnostic shadow toggle and camera cut. Actual walking segments cover 18.19, 10.50 and 10.51 units. No runtime/GPU errors; warm pools, mist and actor motion reviewed across the clip. Media verified HTTP 200 `video/mp4` and HTTP 206 byte-range seeking.

Production motion was delivered via `tg file`, Telegram **753**.

## Target

Extend V14 from the gate sample to the nine freestanding street lanterns along the approach and Hollowmere main street. Timber, masonry and actors should block their light pools and mist. Keep the two 512×512 shadow-map budget and remove the remaining street cone shells and duplicate baked lamp contributions.

## Sequence

1. Capture V14's main street at normal gameplay height.
2. Convert remaining street fixtures to the same suspended emitter and luminous glass used by V14. Preserve building/window lighting and the approved sky/fog palette.
3. Cache unchanged maps. Retain every static world blocker, conservatively select nearby dynamic casters per lamp, and refresh continuously while an animated caster can affect it. Invalidate on membership, material, pose/transform and fixture changes. Avoid depending on camera visibility for shadow casters.
4. Test the ten-candidate route with two slots: fixture selection, fades, material streaming, actor arrival/removal, static reuse, and map reassignments. Verify both irradiance and fog remain shadowed at a town lamp.
5. Run HDR, sun-shadow and mobile regressions. Record actual town movement and a labeled diagnostic comparison, review motion, and send the reviewed MP4 to Telegram and VE.
6. Benchmark separately at 1280×720 with seven enemies and an uncapped browser; report average and long frames. Document limitations and the implementation retrospective.

## Acceptance and limits

- Gate plus nine street lanterns share V14 surface/native/fog visibility; maximum two shadow textures.
- No legacy street light cone meshes or duplicate baked irradiance.
- Static reuse is observable, and an arriving or animated caster cannot retain stale illumination.
- No GPU errors, frozen render, broken controls or loss of iPhone fallback.
- Target >120 FPS under the established desktop benchmark. Physical phone acceptance remains separate.
- Building/window lights and moving spell shadows remain outside this slice. No production deployment requested.

Status: implemented locally, uncommitted and undeployed. Baseline capture: `ve-capture/ashen-reach/street-lights/before-street.png`.

## Implementation

Ten candidates cover gate z=44 and street fixtures z=50,58,66,84,94,104,114,124,134. Street lanterns hang from short arms so their posts do not swallow the downward light. The same emissive glass, irradiance function and fog visibility from V14 apply throughout the route. There are no remaining street cone meshes. Two 512×512 maps retain selection hysteresis and fade before reassignment; distant fixtures retain luminous glass while their local lighting is outside the budget.

The installed Lite 1.28 PCF cache tracks caster transforms, membership, light transforms and material task generation. It does not directly track bone poses. V15 disables unconditional refresh, retains all visible static world casters, and selects dynamic casters against each lamp's finite range (8 m entry / 9 m exit). Nearby skeletons force refresh even when an idle animation leaves its root transform unchanged. Lite's public `enableSkeletonShadows` also supplies posed bounds for its own shadow-frustum culling.

`local-light-bounds.js` transforms the entire local box under every bone and unions the resulting world bounds before testing distance. This includes blended vertices between bones, nonuniform scale, rotation and shear. Missing or unsupported bounds are conservatively included. The implementation avoids per-vertex scans and camera visibility tests. It intentionally accepts false positives to protect shadows from disappearing. Current assets use static or skeletal casters; future morph/VAT/custom displacement assets require their own shadow and invalidation review.

## Verification

- 71 unit tests pass, including 11 bounds tests with mixed weights, affine transforms, moving palettes and invalid input.
- `check-street-lights.mjs`: ten fixtures, two slots, zero old cones, Havok active; 58 ground samples respond to an arriving actor and 58 restore after removal. Stationary animation keeps maps updating. Static-only maps record zero new renders over 96 cache hits. Reassignment to lamps 124/134 and return to 94/104 pass. 57 integrated fog samples respond to town blockers. Actual keyboard movement: 11.31 units. Desktop/portrait captures reviewed, no runtime/GPU errors.
- `check-local-lights.mjs`: 50 actor, 420 static, 626 fog and 92 moved-shadow samples; 48 native receivers; 12.24 units of movement. Shared fog readback is factored into `scripts/lib/fog-pixels.mjs`.
- HDR checks preserve finite floating-point radiance above 1, exact bypass, six CPU/GPU display comparisons, resize/armory/direct rendering and scene disposal.
- Sun regression: 40 actor-shadow samples, 38 native receivers, 15.40 units of movement, no errors.
- Chromium mobile emulation with injected depth-bundle failure: empty-fragment fallback, 26.88 units of native touch movement, changed displayed world, capture-loss/cancel/menu/blur recovery. Desktop WebKit: 18.29 units of visible keyboard movement. Both use the town route and 322×550 internal rendering, with no runtime/GPU errors. Neither constitutes physical iPhone acceptance.
- Release build and `git diff --check` pass.

Final repeat after isolating the sun-test context and factoring fog readback: 71 tests and build pass again; street actor/restoration counts remain 58/58, static reuse remains 0 renders/96 hits, fog comparison finds 46 samples, movement is 10.98 units, and runtime/GPU errors remain empty. Fog counts vary with animated scene geometry and sampling time.

## Motion review and performance

Reviewed 12.17-second MP4: labeled shadow off/on comparison, forward keyboard traversal, labeled camera cut and return along the street. Recording is Chromium/WebGPU at 1280×720, internal 960×540, with enemies disabled for the visual comparison. Three walking segments cover 18.19, 10.62 and 10.62 units. No runtime/GPU errors. Review found readable warm pools, softer mist, moving actor silhouettes and no old cone shells.

[Live MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/street-lights/2026-09-24-v15-street-lights.mp4), delivered through `tg file`, Telegram **752**. Public media verified HTTP 200 `video/mp4`, byte range HTTP 206. Local evidence: `ve-capture/ashen-reach/street-lights/`.

Separate uncapped Mac Studio, Apple M1 Max, 32 GB, Chromium 153 WebGPU/Metal, seven enemies, no recording, 1280×720 internal/viewport, DPR 1. Start z=80, 1.5 s walking warmup, 7 s measurement; metrics retain the latest 600 samples. **279.85 FPS**, mean **3.57 ms**, median **2.30 ms**, p95 **7.00 ms**, p99 **56.50 ms**, worst **77.50 ms**. Nineteen frames exceed 8.33 ms; eight exceed 16.67 ms. `vsyncCapped:false`; GPU timestamps disabled. This measures animation-frame throughput, not isolated GPU duration. Long frames remain. Different route from V14, so no direct speedup claim. Isolated slot 7 was stopped afterward.

## Retrospective

Release review caught an upload-order defect: `setEffectUniforms` writes immediately, while local lamp data had been packed after the call. Moving packing before both uploads prevents fog using previous-frame matrices and weights during lamp reassignment. A regression executes the actual update function with immediate-upload snapshots and checks the first frame and changed lamp data. The release suite now contains 72 tests.

1. Capture the actual town before extending the technique. This exposed the remaining geometric cones and established fixture coverage as the concrete goal.
2. Reuse the surface/fog visibility contract. Expanding fixtures required no extra shadow maps or a second fog approximation.
3. Read installed cache behavior before enabling reuse. Root-transform checks alone miss skeletal motion; force updates for nearby animated actors and use conservative posed bounds.
4. Test removal and return, not only an arriving actor. Those cases catch stale cached silhouettes and reassigned maps.
5. Keep test pages private. An early concurrent sun check navigated the street check's page, producing an invalid 88-unit movement result and a closed-page failure. Both were discarded and rerun separately; the sun helper now owns its context, and street movement has an upper bound to reject teleports.
6. Review motion before delivery and benchmark separately. Publication does not imply production deployment. Physical phone review, broader light budgets, spell shadows and local specular response remain separate follow-up work.
