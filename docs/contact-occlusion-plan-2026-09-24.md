# V12 contact shadows and ambient occlusion

## Target

Ground the current character, stones, and building junctions with short, restrained occlusion. Keep the approved golden horizon, mountain silhouettes, shadowed fog, warm lamps, source animation, and movement. V11 is the release baseline; this next slice is local until another release is requested.

Acceptance: visible contact darkening at nearby intersections, no dark sky or silhouette halo, no history trail behind walking feet, working camera changes and portrait resize, and more than 120 FPS under the documented desktop benchmark conditions. Review and deliver actual gameplay motion, independently of performance measurement.

## Research and constraints

- [Lite screen-space effects demo](https://github.com/BabylonJS/Babylon-Lite/blob/master/lab/lite/src/demos/screen-space-effects.ts) establishes the native contact-shadow task over scene depth. The installed 1.28 declarations and `lib/post-process/screen-space-contact-shadows.js` are the implementation contract.
- [NVIDIA ambient occlusion overview](https://developer.nvidia.com/rendering-technologies/horizon-based-ambient-occlusion-plus) motivates local depth-based visibility. This implementation is a small horizon sampler, not NVIDIA HBAO+ or a claim of equivalent quality.
- Native contact shadows trace toward the sun through the visible depth buffer. They supplement existing world shadow maps; invisible or off-screen geometry remains the shadow maps' responsibility.
- There is no native AO post task in this installed version. Use a compact custom depth pass. Scene depth is reverse Z with zero as clear; reconstruct positions using the active camera's inverse view-projection matrix.
- Materials currently grade before post. This pass necessarily attenuates graded combined lighting. Limit the total darkening and protect bright lamp/emissive pixels; separating only ambient light belongs to the subsequent linear HDR milestone.

## Implementation checkpoints

1. **Pipeline and contact producer.** Reuse native contact shadows with `composition: 'none'`, full resolution, short world-space rays, and current-frame filtering. Supply the active camera, reset on camera replacement/teleport, and expose runtime toggles. Retain the scene depth attachment for later fog integration.
2. **Local ambient occlusion.** Reconstruct normals from the closer depth neighbor on each axis. Sample a small world-space radius in eight screen directions, reject clear/out-of-frame samples and distant surfaces, and fade out distant receivers. Render half resolution; use depth-aware reconstruction to keep sky and foreground silhouettes clean. No temporal accumulation in the initial slice.
3. **Bounded composition.** Combine AO and contact shadows before fog, with a strict darkening ceiling and highlight protection. Keep exact source color sampling. Add diagnostic masks and independent toggles. The fog still terminates at the original opaque depth and receives composed color separately.
4. **Verification and correction.** Capture matching disabled/enabled views of feet, street corners, lamps, and the mountain skyline. Inspect raw masks, walk and jump with actual inputs, switch cameras, resize to portrait, check disabled/direct routes and disposal. Fail on shader/GPU errors. Retain V11 near/far regressions and spell/targeting checks.
5. **Delivery.** Run an isolated uncapped 1280×720 internal benchmark with seven enemies and no recording. Record a separate live MP4, review sampled motion frames, correct defects, send with `tg file`, and document observed results and limits.

## Guardrails

- Start with AO radius 0.55 world units, three samples in eight directions; full contribution only nearby, fading between 20 and 45 units.
- Contact ray length 0.30 units and 12 steps. AO strength 0.30 and contact strength 0.14 are initial tuning values, with combined attenuation capped at 25% before highlight protection.
- No temporal history initially: avoid motion smearing and keep deterministic A/B diagnostics. Thin foliage and missing off-screen depth are explicit limitations.
- Do not change the sun, add blob shadow geometry, or alter textures/layout to make the effect easier to demonstrate.

## Results

Pending implementation and live review.
