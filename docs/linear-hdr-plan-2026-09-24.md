# V13 — linear lighting and a single display transform

## Target

Keep the approved warm fog, cool distance and readable silhouettes while preserving bright lamp/sun colors. Surface lighting, contact occlusion, fog and bloom must share linear floating-point color. Apply exposure and display conversion once, after composition. No inverse reconstruction of already clipped colors.

## Implementation sequence

1. Capture matched churchyard, town and mountain views before changes. Audit installed Lite 1.28 material and post-process behavior; retain the iPhone depth compatibility fix.
2. Add a shared color contract: decode color textures before lighting, keep intermediate targets `rgba16float`, disable native material display processing, and remove custom per-material grading and the fog inverse. Scalar noise/masks remain data textures.
3. Add one final exposure/tone/color/output conversion after HDR bloom. The `noPost` diagnostic route skips fog/occlusion/bloom but retains the necessary display conversion. Expose bounded exposure controls and pipeline state for regression checks.
4. Verify values above 1 survive real render targets, fog bypass and resize preserve resources, and native/custom materials receive the same final conversion. Run existing mobile compatibility and shadow tests. Exercise movement, camera changes, armory and spells.
5. Review matched screenshots and a live gameplay MP4. Correct visible glare or color problems, benchmark separately without recording, document results and deliver video through Telegram/VE. Production deployment requires separate authorization.

## Acceptance

- No intermediate display encoding or tone-map inverse; one final display conversion.
- Sunlit fog retains mountain boundaries; lamps retain a warm core without washing out the scene; the character belongs to the same lighting as the world.
- Floating-point pixel probes are finite and retain radiance above 1; regression checks cover disabled effects, odd portrait resize and the iPhone-compatible depth pipeline.
- No GPU validation errors, black frames or broken movement. Physical phone testing remains distinct from desktop browser emulation.
- Target >120 FPS on the established uncapped desktop benchmark. Record resolution, hardware/browser, population, average and tail frame times.

## Research

The Lite documentation MCP is unavailable in this session. Use installed package implementations and official upstream Lite docs, not Babylon Classic APIs. WebGPU's [texture format capabilities](https://www.w3.org/TR/webgpu/#texture-format-caps) define the floating-point attachment/sampling contract; the canvas remains ordinary SDR with a final display transform. This milestone concerns internal lighting range, not HDR display output.

## Status

Loading-screen baseline committed and pushed as `9eea274`. V13 committed and pushed as `05fe8fe`, deployed on 2026-09-24 to https://play.sparkify.dev through Pages `f71594d2`.

## Implementation and corrections

`color-management.js` defines the color transfer functions and fitted ACES display curve. `display-pass.js` applies bounded fixed exposure (0.9) and saturation (1.05), then sRGB encoding once. Fixed exposure avoids brightness adaptation during camera movement. `post.js` renders scene, contact/AO, fog and bloom into `rgba16float`; bloom starts above linear luminance 1.2 with weight 0.12. Lite's highlight-extraction API internally raises threshold to 1/2.2, so the caller supplies `threshold ** 2.2`. The internally owned bloom output inherits the HDR format and is released on disposal.

World/foliage color samples decode from sRGB before illumination. Scalar cloud/noise textures remain data. Custom sky, shafts, motes and lava output radiance. Fire sprite textures use sRGB sampling, which preserves alpha and decodes their color before additive blending. Fog now composites `surface * transmittance + scattering` directly, without reconstructing clipped display colors. The same final display pass is retained under `noPost`.

### Native material trap

Lite 1.28's ordinary PBR template always gamma-encodes/clamps at its tail. `toneMappingEnabled=false` does not bypass that tail; `-1` is truthy and selects a tone operator. A negative sentinel only guards a separate transmission extension, not the ordinary game materials. The first live capture exposed pale clothing from double processing.

The correction in `linear-materials.js` uses the public custom tone operator and material-plugin APIs: capture linear radiance at the operator slot and restore it after native gamma/contrast but before alpha output. The compiler can eliminate the unused conversion. Standard materials and billboard sprites already emit their color directly. The source-based tests compose real Lite shaders for ordinary, unlit, blended and environment variants.

A second live test, with enemies enabled, exposed an undeclared capture variable during asynchronous material creation. Declaring that variable inside the operator makes even an intermediate unprepared variant compilable. Explicit preparation before scene entry/replacement is still required for first-draw correctness: the body visual loader, equipment stream, NPC original/tint materials, shade garments, training dummy and `Batch.commit` (held sword/mage props) now call it. Registration/deferred-build boundaries and the per-scene render callback provide additional coverage. No global GPU functions or mesh-array methods are patched by the runtime implementation.

### Resource cleanup

An attempted root import of `disposeRenderTarget` failed because Lite does not export it there. It was removed. Bloom now owns its output through its supported default target behavior; the live disposal test verifies the scene and bloom textures are released. A stalled WebKit run during that intermediate import error is not counted as a successful check; the corrected build was retested.

## Final verification

- **47 tests**: nine color-math tests, eight native-material tests, thirty existing GPU compatibility/touch/targeting/spell tests.
- Build and `git diff --check` pass.
- `node scripts/ashen-reach/check-hdr.mjs`: finite floating-point targets across churchyard/town/approach, native material preparation, exact contact/fog/bloom bypass, six GPU/CPU display comparisons, exposure bounds, reference/play camera switching, armory, odd portrait resize, 10.50 units of keyboard movement and full scene disposal. Scene peaks reached 37.81 and composed fog 15.31, demonstrating retained radiance beyond 1; no runtime/GPU errors.
- `check-sun-shadows.mjs --tag v13-corrected`: 43 actor-shadow samples, 38 native receivers and visible movement; no runtime/GPU errors. This run overlapped another browser check, so its movement distance is not used as an isolated measurement. Final movement measurements come from the isolated HDR and mobile checks.
- `check-mobile-runtime.mjs --webkit`: desktop WebKit native path, mobile viewport, 18.65 units of visible-world movement, no errors. Chromium injected-depth-failure check exercises the empty-fragment fallback, real touch movement, capture loss, cancel, modal and blur recovery. These are desktop browser checks, not a physical iPhone GPU acceptance claim.
- Matched live before/after screenshots: `ve-capture/ashen-reach/sun-fog/v13-before/` and `v13-linear-native/`. Review caught and corrected the pale native materials. The street retains dark masonry/character values, warm lamps and readable mountain boundaries.
- `record-hdr.mjs`: reviewed **13.8-second MP4**, 1280×720 viewport / 960×540 internal, real keyboard movement/jump, Lava Ball and Fire Blast, labeled camera cuts to churchyard and town. Movement 19.36 units; each spell cast once, dummy HP 2000 → 1640; no errors. Encoded at 60 FPS, separate from the benchmark. Silent capture.
- Reviewed MP4: https://ve.sparkify.dev/wow-clone/ashen-reach/hdr/2026-09-24-v13-lighting.mp4 — verified HTTP 200 `video/mp4` and byte-range HTTP 206; Telegram **749**.
- Uncapped benchmark: isolated harness slot 7, Chromium/WebGPU, Apple M1 Max Mac Studio / 32 GB, 1280×720 internal/viewport, DPR 1, seven enemies, no recording or other active test scenes. 600 samples: **292.45 FPS**, mean **3.42 ms**, p95 **6.50 ms**, p99 **55.00 ms**, worst **74.60 ms**; 20 frames over 8.33 ms, ten over 16.67 ms. `vsyncCapped:false`; these are animation-frame intervals, not GPU timer readings. Benchmark slot stopped afterward.

## Remaining limits and retrospective

Physical iPhone review remains pending; production deployment is complete. This is an internal HDR lighting pipeline with SDR output, not an HDR-monitor mode. The ACES fit remains an artistic approximation; albedo/vertex palettes were authored for the former pipeline and can receive future tuning. Ambient/contact occlusion still darkens combined surface color with highlight protection, not a separately rendered ambient term. Transparent emitters inherit the opaque depth used for fog. Geometric lantern shafts and point-light occlusion belong to the next milestone. No temporal reconstruction or auto-exposure was introduced. Tail frame stalls remain despite good average throughput.

The important process correction was to inspect actual native shader composition, then validate ordinary and asynchronously created materials in the live full scene. A plausible engine flag and green no-enemy screenshots did not establish a single display transform. Keep numeric float-target probes, real gameplay review, stream-boundary tests and the iPhone fallback test together whenever the render pipeline changes.

## Production release verification — 2026-09-24

Release build and 47 tests passed. Production entry JavaScript matches the built asset byte-for-byte; versioned Havok WASM returns HTTP 200 with the correct magic bytes. Both production browser checks confirmed active physics, `rgba16float` composition, and the shared final display transform. Native desktop WebKit with a mobile viewport traveled 18.09 units with visible image changes; Chromium's injected depth-failure fallback traveled 27.22 units using native touch and passed capture-loss, cancellation, menu and blur recovery. Neither reported runtime/GPU errors. These checks do not establish physical iPhone acceptance.

Reviewed production portrait movement recording: https://ve.sparkify.dev/wow-clone/ashen-reach/hdr/production-05fe8fe.mp4. Code deployed: `05fe8fe`; Pages deployment: `f71594d2`. Subsequent documentation commits do not change the deployed code.
