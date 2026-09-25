# V16 — material depth and lantern highlights

First of three sequential milestones authorized for autonomous implementation, commit, push and production deployment. V15 is the baseline; the user confirmed it works on their phone. V17 frame pacing and V18 vegetation stability are provisional directions, to be planned individually after each release's evidence.

## Target

Give Hollowmere stone relief and varied roughness, and make native metal/cloth respond differently to nearby lanterns. Preserve the palette, pixelated albedo, exposure, two-map light budget and current physics/animation. No new mirror/reflection render pass.

## Implementation sequence

1. Capture current street and player baseline. Inspect installed Lite PBR composition and existing licensed texture maps.
2. Reuse the Rock Wall 08 normal/roughness maps for masonry and paving, sampled as linear data with mip filtering. Use continuous UV derivatives for a stable tangent frame, geometric normals for shadow bias, and fade fine detail at distance. Restrict earth/wood to rough material response.
3. Add bounded GGX/Schlick lantern specular using the same shadow visibility and linear HDR path. Native PBR uses its real roughness/reflectance values. Keep cloth rough, and prevent metal from receiving a dielectric diffuse response.
4. Add diagnostic toggles and regression checks for finite highlights, roughness/material differences, shadowed highlights, actual shader composition, texture deployment and moving/portrait gameplay.
5. Review a labeled live comparison and traversal, run mobile fallback/WebKit checks, benchmark independently at 1280×720 with seven enemies. Target >120 FPS while reporting frame-time tails.
6. Commit/push, deploy, verify served assets and actual production movement. Publish reviewed MP4 to VE/Telegram and record results before planning V17.

## Sources and decisions

- Installed `@babylonjs/lite` 1.28 source and PBR plugin hook tests are authoritative for this runtime; Lite-docs MCP is unavailable in this session.
- [Filament material properties](https://google.github.io/filament/Materials.md.html) describes roughness, metalness and reflectance; use the established GGX/Schlick model with a roughness floor suitable for this game's resolution.
- [Rock Wall 08](https://polyhaven.com/a/rock_wall_08), Amal Kumar, [CC0](https://polyhaven.com/license). Reuse the local diffuse/normal/roughness set, record its exact source and orientation before shipping. The project already uses its diffuse texture.

## Acceptance

Review correction: match Lite's native cotangent frame by negating bitangent for the unflipped OpenGL normal map. Masonry image V increases downward; a directional sign regression now covers this convention. Initial captures before the correction are superseded.

Live wall/ground detail and moving highlights visible without glossy cloth or a brightness wash. Occlusion still blocks specular. No validation errors, frozen frames or input regression. Tests/build pass; actual iPhone follow-up remains distinct from desktop browser emulation. Production is released only after the local checks and reviewed motion.

## Implemented and verified

- World stone/paving uses a 512×512 packed OpenGL normal RGB / roughness A texture (921,347 bytes), linear mip filtering, continuous UV derivative frame and 10–38 m detail fade. Existing albedo quantization, palette and exposure remain. Earth and wood remain rough. Stone detail is restricted to the northern scene through a z=40–52 fade.
- Shared GGX/Schlick specular uses current shadow visibility. Roughness is bounded at .22, the BRDF response is bounded independently of HDR radiance, and zero/grazing vectors are guarded. Native PBR uses `N`, `V`, texture-adjusted `roughness` and `colorF0`; Lite's `surfaceAlbedo` already removes pure-metal diffuse response. Plugin-free native shadow aliases remain intact.
- `ASHEN.localLights.state.specular` and `.details` supply diagnostic switches. The GPU probe now reports actual shared specular energy.
- **82 unit tests** and the build pass. Native shader composition, linear output, caster isolation, uniform layout, packed texture, roughness/F0 behavior and orientation are covered. Live checks find **100 shadow-suppressed specular samples**, 15.39 units of keyboard movement, finite output and no runtime/GPU errors. Street cache/shadow tests and HDR float/bypass/resize/disposal checks pass.
- Desktop WebKit and Chromium's injected iPhone depth fallback pass town movement and rendering (19.34 and 30.84 units respectively), with touch cancellation/capture/menu/blur recovery and no runtime/GPU errors. These are desktop tests, not new physical phone measurements.
- Reviewed **10.41-second** [live MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/v16/2026-09-24-material-depth.mp4), labeled off/on and camera cut, actual walking. Chromium WebGPU, 1280×720 capture / 960×540 internal, no enemies. Published `video/mp4`; HTTP 200 and range 206 verified. Original captures were superseded after the normal orientation correction.
- Separate uncapped Mac Studio M1 Max / 32 GB / Chromium 153 WebGPU/Metal, seven enemies, 1280×720 internal and viewport, DPR 1, start z=80, no recording: **276.29 FPS**, mean **3.62 ms**, p95 **5.20 ms**, p99 **59.30 ms**, worst **73.40 ms**, 600 retained frames, 13 above 16.67 ms, `vsyncCapped:false`. GPU timestamps disabled. Average remains above goal; frame-time tails motivate V17. Benchmark slot 7 stopped afterward.

## Retrospective

Released as **`8e9fc92`** / Pages **`508c1b3b`** to https://play.sparkify.dev. Production bundle, packed texture and WASM compare byte-for-byte. Live production check: 99 specular-shadow samples, 15.39 units movement, no runtime/GPU errors. Production desktop WebKit: 16.73 units; injected iPhone fallback: 26.21 units with input lifecycle checks. Reviewed clip delivered via `tg file`, Telegram **754**. First of the three authorized milestones is complete; V17 is planned next. No new physical iPhone measurement is claimed.

Reuse of the existing texture family preserved composition while adding directional relief. One packed data map bounded bandwidth; derivative UVs avoid the zero gradients created by pixel-quantized albedo coordinates. Native PBR values prevented a material-wide gloss override. Source review caught a green-channel convention error that ordinary GPU validation could not detect; the directional test and corrected live review are both required. Per-milestone delivery includes motion, a separate benchmark and production verification rather than treating shader compilation as acceptance.
