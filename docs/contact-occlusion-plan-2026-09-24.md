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
- No temporal history blending initially: avoid motion smearing and keep deterministic A/B diagnostics. Lite still allocates and copies history with a current-frame weight of one. Thin foliage and missing off-screen depth are explicit limitations.
- Do not change the sun, add blob shadow geometry, or alter textures/layout to make the effect easier to demonstrate.

## Results

Implemented locally in `src/ashen-reach/contact-occlusion.js`. Native contact tracing feeds a bounded composite alongside half-resolution AO; fog reads this color while retaining original scene depth. Runtime controls are `ASHEN.grounding.state` (`enabled`, `ambient`, `contact`, `radius`, strengths, and diagnostic masks 1/2/3). `?noPost` keeps the existing direct route.

The source review caught a reversed normal and zero derivatives at texture borders; normals now face the camera and use one-sided border derivatives. Singular inverse matrices bypass the custom effect. The native camera proxy forwards cache writes as well as reads, and resets on camera replacement or teleport. See [review notes](v12-contact-review.md). Current cameras cover the full render target; sub-viewports are not supported by this reconstruction.

### Verification

- Build, seven targeting/spell-visibility tests, and whitespace checks pass.
- Live `check-contact-occlusion.mjs --tag v12-final`: three views, each with 9,216 GPU sample points. AO affected 3,960–4,641 samples and contact tracing 1,351–2,191 at a 0.025 mask threshold. Disabled composition was byte-identical at sampled source pixels. Clear sky and highlights above 0.89 had zero sampled color change. Maximum sampled attenuation was 25.36% after 8-bit quantization around the shader's 25% cap.
- Actual W/Space input moved 10.62 units; reference/play cameras and 390×844 portrait passed. The first movement assertion incorrectly spread Lite's vector object, copying `_x`/`_z` instead of public `x`/`z`; explicit coordinates corrected the test.
- Armory camera, disabled resize/re-enable at 391×843, full scene disposal, reload, and direct rendering passed with no runtime/GPU errors. Odd viewport produced 293×632 internal pixels and 147×316 AO pixels. Portrait checks ran in desktop Chromium, not on an iPhone.
- V11 regression: 40 near-shadow sample changes, 38 native receivers, 15.40 units movement. Far-map regression: 45/45 independent GPU/triangle-ray matches, 13 samples relit by ridge removal and 14 blocked after restoration. No recorded errors.

Reports and on/off/mask images: `ve-capture/ashen-reach/contact-occlusion/v12-final/`; near/far reports are under their respective `v12-near-check` / `v12-far-check` directories. These generated artifacts are ignored by Git.

### Performance and motion

Separate Mac Studio headless Chromium/WebGPU run, uncapped flags, 1280×720 internal and viewport, DPR 1, seven enemies, actual keyboard movement, no recording: **292.98 FPS**, mean **3.41 ms**, p95 **6.60 ms**, p99 **53.10 ms**, worst **75.10 ms**, 600 retained samples; 22 exceeded 8.33 ms and 13 exceeded 16.67 ms. The average meets the target, but stalls remain. These are animation-frame intervals, not GPU timestamps or mobile performance. The ordinary capture browser was blank during this run; isolated slot 7 was shut down afterward. This was not a controlled per-feature comparison with V11.

Reviewed live motion: `ve-capture/ashen-reach/contact-occlusion/video-v12-final-2026-09-24/v12-contact.mp4`, **19.45 seconds**, 1280×720 at 60 FPS, 960×540 internal scene and 480×270 AO/fog. Includes labeled off/on comparison, actual walking and jumping, then a camera cut to town. Reviewed off/on views and frames 150, 420, 510, 1050: local grounding and stone seams remain visible without broad dark haze, warm lamps and distant fog remain legible, and the jump does not leave an accumulated contact trail. No capture errors. Telegram delivery is recorded in CURRENT after upload completes.

### Remaining limits

This is visible-depth occlusion, not a replacement for sun maps or a full ambient-light solution. It cannot find off-screen or hidden blockers, and fine foliage can vary as depth coverage changes. The composite attenuates graded combined lighting; bright emission protection is a heuristic, and a future HDR/lighting-component pass should apply AO to ambient light explicitly. Existing foot placement on slopes is not corrected by a lighting effect. Lantern cone geometry and occasional frame stalls remain visible follow-up work. V12 is not deployed.
