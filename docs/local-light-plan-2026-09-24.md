# V14 — shadowed lanterns

## Target

At the lych gate and the next two street lamps, masonry, timber and moving actors must block both the pool of light and the illuminated fog. The camera can walk through the light without intersecting a visible cone shell. Preserve the approved V13 sunlight, HDR composition and iPhone depth fallback.

## Implementation

1. Capture the current gate. Mark three fixtures as dynamic; omit their baked upper/ground light contributions and cone meshes while retaining luminous glass.
2. Add two fixed-size spotlight shadow slots using installed Lite PCF generators and native skinned material depth views. Keep these outside the native scene light list: Lite 1.28 selects the CSM receiver when mixed shadow types are present. Use a guarded texture/matrix bridge, as the existing distant sun map does.
3. Share light range, cone falloff, projection and shadow visibility across custom world/foliage materials, a native PBR plugin and fog integration. Select nearby fixtures with hysteresis and fade before reassigning a slot; never illuminate a replacement with an old map.
4. Integrate local scattering over the camera ray's intersection with each light's finite volume. Bound marching by opaque scene depth and sample the same spotlight map. Keep local sampling independent of the long-distance sun fog step length so nearby beams do not disappear between samples.
5. Test selection, fade and baked exclusion; validate real GPU visibility with wall/actor occluders, restoration, streamed materials, portrait resize, direct rendering and teardown. Run existing HDR and mobile compatibility regressions.
6. Play and record a gate/street traversal, review the entire motion through sampled frames, correct visual defects, then send a reviewed MP4 through Telegram and VE. Benchmark separately with seven enemies, 1280×720 internal resolution and an uncapped browser. Target >120 FPS and report long frames.

## Scope and acceptance

- Three selected lamps, maximum two 512×512 shadow maps; remaining town lamps retain their existing implementation.
- No unshadowed baked duplicate for selected fixtures. Walls and animated actors visibly occlude surfaces and fog together.
- Smooth budget transitions, no cone-shell crossings, black frames or GPU validation errors.
- Existing movement, Havok physics, mobile input lifecycle and the iPhone depth fallback continue to work. Desktop WebKit/emulation is not physical phone acceptance.
- No production deployment included in this implementation request.

## Evidence and sources

- Baseline: `ve-capture/ashen-reach/local-lights/before-gate.png`.
- Installed Lite 1.28: `lib/shadow/pcf-spotlight-shadow-generator.js`, `pcf-shadow-task-hooks.js`, `material/plugin/plugin-bridge-shared.js`, `material/pbr/pbr-template.js`.
- [NVIDIA volumetric lighting](https://developer.nvidia.com/volumetriclighting): shadow maps define occlusion of scattering. Our implementation uses bounded ray integration within the existing Lite/WebGPU pipeline.
- [GPU Gems light scattering](https://developer.nvidia.com/gpugems/gpugems3/part-ii-light-and-shadows/chapter-13-volumetric-light-scattering-post-process): extinction and in-scattering compose along view rays; its screen-space radial approximation is not the selected implementation here.

Status: implemented locally, uncommitted and not deployed. Physical iPhone review remains pending.

## Implementation and corrections

`local-light-shared.js` owns the two-slot uniform layout and the exact range/cone/shadow functions consumed by world surfaces, foliage, native PBR and fog. A two-metre selection preference prevents slot chatter; the departing fixture fades to zero before reassignment. A replacement map renders before the color/fog tasks consume its new matrix. The controller preloads newly encountered native material families before changing caster membership, preserves task identity between changes, and guards Lite's empty-list fallback to scene renderables.

PCF maps use the existing sun caster override for opaque world geometry, including the iPhone-selected empty fragment. Native PBR depth views retain mesh skinning and alpha testing. A native material plugin receives the same two textures and uniforms without registering mixed CSM/PCF lights in Lite's scene light list.

The native bridge required three source-specific corrections: PBR plugin uniforms need `markMaterialUboDirty` each frame; the before-final-composition hook is emitted twice, so local diffuse must be added once after IBL reconstruction; and native no-color views inherit plugin sampler bindings. A stable plugin-free caster alias preserves alpha/material state while preventing a shadow map from appearing among its own render pass's sampled resources. Installed-engine composition tests cover all three and retain the V13 linear-output contract. Explicit pre-existing caster overrides are preserved.

An early live capture was black despite healthy startup state. It was rejected; subsequent changes completed fog bindings and isolated caster resources, and fresh captures plus GPU error monitoring passed. The original capture did not have a GPU listener, so its exact cause was not established. Do not describe it as a confirmed reproduction of the earlier physical iPhone bug.

Local fog uses 24 samples over each view ray's finite light-range intersection, bounded by the opaque scene depth. This avoids the distant sun pass skipping a small lantern volume. The selected fixtures' legacy cone geometry and both baked lamp entries are excluded. Short arms place the converted street lights clear of their posts; a separate emissive glass material restores a luminous source without reintroducing an unshadowed pool. Live review increased restrained local mist visibility and corrected a recording camera cut that intersected the gate roof.

## Verification

- **60 unit tests** pass: selection/hysteresis/fade/bake exclusion, actual Lite plugin composition and caster aliases, HDR, GPU compatibility, touch lifecycle, targeting and spell visibility. Build and `git diff --check` pass.
- `check-local-lights.mjs`: 47 actor-shadow samples, 420 static-shadow samples, 626 integrated fog pixels reacting to the same visibility, 89 samples changing after actor relocation, exact zero irradiance when disabled, restoration, 12.24 units keyboard travel, two-slot reassignment, armory, portrait resize, active Havok and all 48 native receiver meshes configured. No runtime/GPU errors.
- `check-hdr.mjs`: finite HDR targets, radiance above one, exact disabled bypass, six GPU/CPU display comparisons, streaming/native output, actual movement, armory, portrait, `noPost` and scene disposal. No errors.
- `check-sun-shadows.mjs --tag v14-local-lights`: 40 actor-shadow samples, 38 native receivers, 15.40 units actual keyboard movement, no reported errors.
- `check-mobile-runtime.mjs --inject-depth-bundle-failure --local-lights`: native touch traversed 27.24 units with visible pixel changes; cancellation, capture loss, menu and blur recovery pass. Empty-fragment depth fallback selected successfully.
- `check-mobile-runtime.mjs --webkit --local-lights`: desktop WebKit traveled 17.07 units through the selected lights with visible changes. Both browser paths used a 322×550 scene and reported no runtime/GPU errors. These are desktop engines, not physical iPhone acceptance.
- Separate uncapped benchmark: Mac Studio, Apple M1 Max, 32 GB, Chromium 153 / WebGPU Metal, seven enemies, 1280×720 internal/viewport, DPR 1, no recording. 600 samples: **242.11 FPS**, mean **4.13 ms**, p95 **7.20 ms**, p99 **72.80 ms**, worst **78.90 ms**; 21 intervals over 8.33 ms, 16 over 16.67 ms. `vsyncCapped:false`. These are animation-frame intervals, not GPU timings. Slot 7 was stopped afterward.

## Remaining limits and reusable lessons

### Motion delivery

Reviewed live recording: [V14 shadowed lantern traversal](https://ve.sparkify.dev/wow-clone/ashen-reach/local-lights/2026-09-24-v14-lanterns.mp4). About 14.3 seconds, 1280×720 at 60 FPS, 960×540 internal scene, no enemies for the focused comparison. The clip labels the shadow toggle and camera cuts; movement uses keyboard input (14.00, 7.11 and 10.50 units in the three forward segments). The final sampled-frame review removed the first take's roof-intersecting camera cut. No runtime/GPU errors were reported. Uploaded with `video/mp4`, verified HTTP 200 and byte-range 206, and sent as a file through Telegram. Local evidence: `ve-capture/ashen-reach/local-lights/video/`.

### Scope still open

This slice covers three fixtures, not every lamp or spell. The map budget smoothly removes the third lamp's dynamic illumination; luminous glass stays visible. Remaining town lamps still have their legacy baked pools/cones. The native plugin supplies diffuse local light; a full local specular BRDF is future work. Fine wind-deformed foliage receives light but is not added as a local caster. Local mist is an artistic thin-scattering approximation with a fixed scattering gain and approximate view attenuation, not a fully coupled multiple-scattering/extinction solver. Transparent emitters still use opaque scene depth. No temporal reconstruction was added.

Keep shadow visibility common to surfaces and participating air; verify the actual fog target rather than merely finding shadow samplers in code. Keep short local integration intervals separate from a distant sun march. When adding native material plugins, test both visible and depth-only shader composition and texture usage; preserve synchronous preparation at streaming boundaries. Review ordinary gameplay motion and close traversal after numeric tests pass. Physical phone performance and occasional desktop stalls remain open.
