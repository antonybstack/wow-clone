# V12 contact lighting retrospective — 2026-09-24

## Outcome and release boundary

V12 adds short contact shadows and local ambient occlusion to the existing V11 sunlight and fog. The visible target was modest: better grounding at nearby feet, stones, wall bases, and foliage intersections while retaining the approved horizon and warm lamps.

This record covers the implementation, corrections, and evidence gathered before release. The user subsequently requested this retrospective, commit, push, and production deployment. The release result and identifiers are recorded in [CURRENT](CURRENT.md); the implementation evidence below is local unless explicitly described otherwise.

The [detailed plan](contact-occlusion-plan-2026-09-24.md) contains parameters and results; [source review](v12-contact-review.md) separates code inspection from runtime evidence. V11 was already deployed as `b628f37`, Pages `b14a1aa7`, before V12 implementation began.

## Approach

Start with the approved game and its existing depth and shadow infrastructure. V11's world shadow maps already handle buildings, mountains, and animated silhouettes. V12 addresses nearby contact detail; changing the sun or adding painted shadow disks would not test that target.

The Babylon and Dream Loop workflow shaped the work: inspect installed APIs, reuse a suitable native pass, implement a small playable slice, inspect masks and actual gameplay, correct concrete defects, then measure performance separately from recording. The source rig, physics, world art, and sunlight direction remained the integration constraints.

Research used the official [Lite screen-space demo](https://github.com/BabylonJS/Babylon-Lite/blob/master/lab/lite/src/demos/screen-space-effects.ts), the installed Lite 1.28 declarations and source, and NVIDIA's [ambient occlusion overview](https://developer.nvidia.com/rendering-technologies/horizon-based-ambient-occlusion-plus). Installed source was decisive for camera capture, temporal weighting, composition output, and ownership. The custom AO is a compact horizon sampler; it is not an implementation of NVIDIA HBAO+.

## Implementation decisions

The controller is [contact-occlusion.js](../src/ashen-reach/contact-occlusion.js). It reuses `createScreenSpaceContactShadowsPostProcessTask` with `composition: 'none'`: the native task returns a mask and the game controls composition. Twelve samples trace 0.30 world units toward the sun at full resolution. This supplements the shadow maps using visible depth; it cannot discover hidden or off-screen blockers.

The custom AO pass reconstructs world positions from reverse-Z scene depth, with zero treated as clear. It chooses the closer neighbor on each axis to estimate a normal, samples three distances in eight directions within a 0.55-unit radius, and rejects clear, out-of-frame, and distant samples. AO and receiver distance share an `rg16float` half-resolution target. Four depth-weighted neighbors reconstruct the result at full resolution. Contributions fade between 20 and 45 world units.

Both masks feed one bounded composite: AO strength 0.30, contact strength 0.14, combined darkening capped at 25%, and bright colors protected by a smooth threshold. Exact source texel loads preserve the pixel presentation. This is an interim approximation: materials already grade their combined lighting before post, so the pass cannot attenuate ambient light alone. Highlight protection is a heuristic, not a substitute for separate lighting components.

The frame order is:

```text
sun maps → scene color and depth → native contact mask → local AO
         → bounded color composite → fog integration/composite → bloom
```

[post.js](../src/ashen-reach/post.js) owns ordering. Fog now accepts composed color separately while retaining the original scene depth for ray termination. Replacing that depth with the new color-only target would break the volume.

Lite captures the contact camera at task creation, while the game switches among play, reference, and armory cameras. A proxy forwards reads and cache writes to `scene.camera`; camera replacement and teleport increment the reset version. Both custom and native passes recover conservatively from a singular inverse. Current reconstruction assumes a camera covering the whole target; partial viewports remain unsupported.

Temporal samples are one and configured temporal weight is zero. The installed implementation resolves these settings to a current-frame weight of one and constant sample phase. There is no history blending, but native history allocation, spatial filtering, and copy work still occur. Calling this “no history” would misstate its cost.

## Corrections and lessons

1. **Normal orientation was initially reversed.** Inspecting installed reconstruction and the live mask exposed the mismatch. The corrected normal uses the cross product and explicitly faces the camera. Shader compilation cannot establish that an otherwise valid normal points the right way.
2. **Clamped border samples produced zero derivatives.** The independent source review found that choosing the shorter difference at a texture edge selected the clamped center itself. One-sided differences now handle all four borders. Odd-size resize was tested afterward.
3. **An invalid inverse originally threw.** The custom pass now bypasses composition and returns zero AO when inversion fails. This recovery was reviewed in source; deliberately singular cameras were not exercised in the saved runtime checks.
4. **The movement test measured missing fields.** Spreading Lite's position object copied `_x` and `_z`, while the assertion read `x` and `z`, yielding an invalid distance. Explicit coordinate reads fixed the test. A failed assertion was investigated before attributing it to gameplay. The final W/Space test moved 10.62 units.
5. **Native temporal options needed source verification.** A zero configured weight does not mean zero current-frame contribution. Checking the actual weighting formula avoided an incorrect stability claim.
6. **Visual, numerical, and performance evidence answer different questions.** Masks establish locality, GPU samples establish bounds and bypass behavior, gameplay motion exposes temporal defects, and a separate uncapped run measures throughput. None replaces the others.

No precise time saving or complete count of failed iterations was measured. The reusable improvement is to validate normal orientation, borders, camera identity, depth ownership, and the test's own data access before tuning strength.

The release review found two additional test weaknesses: a flat 29% assertion could miss regressions above the intended 25% cap, and zero sky/highlight differences were reported without coverage counts. The release test now allows only half an 8-bit color step of rounding in the luminance comparison and records/asserts qualifying sample coverage. The lifecycle report remains coarse: it saves dimensions, direct-route readiness, and errors, while the executed disposal and resize sequence is described in the implementation notes. Future lifecycle tests should record each transition explicitly. Singular-camera recovery remains source-reviewed only.

## Evidence and limits

The final local test sampled 9,216 GPU points in each of three views. AO and contact masks contained nearby occlusion; disabled composition matched sampled source pixels exactly. Sampled clear sky and bright highlights had zero change. Maximum measured attenuation was 25.36% after color quantization around the shader's 25% cap. This is sampled evidence, not an exhaustive proof of every pixel or camera angle.

The stronger release rerun (`v12-release-final/report.json`) passed with zero excess beyond the quantization-aware ceiling. Its stone/street views included 226/79 clear-sky samples and 30/29 highlight samples, all unchanged; the ground-facing feet view had neither category. Movement was 10.50 units and the error list was empty. Observed maximum relative attenuation in this rerun was 25.75%, still within half a color step at the sampled luminance.

Build and seven targeting/spell tests passed. Live checks covered play/reference/armory cameras, walking and jumping, portrait and odd-size resize, disabled resize/re-enable, scene disposal/reload, and `?noPost`. V11 near-shadow checks and all 45 far-map GPU/triangle-ray probes still passed. No runtime/GPU errors were recorded. Source review, code fallback behavior, and actual runtime checks remain distinct in the plan.

Performance: Mac Studio, uncapped headless Chromium/WebGPU, 1280×720 internal and viewport, DPR 1, seven enemies, keyboard movement, no recording, 600 retained samples. Mean **292.98 FPS / 3.41 ms**, p95 **6.60 ms**, p99 **53.10 ms**, worst **75.10 ms**; 22 frames exceeded 8.33 ms and 13 exceeded 16.67 ms. The capture browser was blank during the run, and benchmark slot 7 was stopped afterward. These are animation-frame intervals, not GPU timestamps. Average throughput clears the target; the long tail remains a problem. This was not a controlled per-feature comparison with V11 and does not establish iPhone performance.

Reviewed live evidence was delivered by `tg file` as **Telegram 744**: a **19.45-second, 1280×720, 60 FPS MP4**, with 960×540 internal scene rendering and 480×270 AO/fog. It contains labeled off/on comparison, actual walking and jumping, then a cut to town. The reviewed mask/still views and motion frames 150, 420, 510, and 1050 showed local grounding, readable lamp lighting, and no accumulated jump trail. The recording had no captured errors.

Artifacts are ignored by Git: `ve-capture/ashen-reach/contact-occlusion/v12-final/` contains reports and stills; `video-v12-final-2026-09-24/v12-contact.mp4` contains motion. The tracked test and recorder reproduce the checks. Telegram retains the delivered clip if local artifacts are unavailable. Release bookkeeping should associate this clip with the committed V12 revision using `bash scripts/tg record`.

## Next-time checklist

- Confirm installed API behavior and target formats before wiring the graph.
- Prove normal orientation and flat-surface behavior with a raw mask, then inspect all borders.
- Treat active camera changes, depth attachment ownership, resize, and disposal as first-class integration checks.
- Keep independent toggles and exact disabled bypass for diagnosis.
- Read public vector coordinates explicitly in browser assertions.
- Review actual movement and preserve the capture's resolution and staging details.
- Benchmark without recording; report frame-time tails alongside average FPS.
- Keep visible-depth, fullscreen, graded-lighting, and mobile limits explicit.

The next graphics milestone remains linear HDR lighting and one final grade, which can separate ambient attenuation from direct and emissive light. Lantern cone replacement, off-screen contact information, fine foliage stability, terrain-aware foot placement, and occasional frame stalls remain separate work.
