# Shadowed volumetric sunlight

The user rejected V9: its angular sine pattern brightens surfaces and fog without testing sunlight visibility. The apparent beams originate on the ground and follow a view-space pattern instead of mountain shadows. V9 is not an accepted visual baseline.

## Research and engine constraints

- [Babylon Lite architecture](https://github.com/BabylonJS/Babylon-Lite/blob/master/docs/lite/architecture/00-overview.md): the installed package provides directional PCF shadow generation, explicit shadow casters, render targets, effect tasks, matrix inversion, and scene depth. Use Lite APIs and verify installed source; Classic Babylon examples do not apply directly.
- [Maxime Heckel's implementation](https://blog.maximeheckel.com/posts/shaping-light-volumetric-lighting-with-post-processing-and-raymarching/) reconstructs world positions from camera depth and evaluates light-space shadow depth during fog ray marching. Adapt the method to WebGPU's 0–1 depth and Lite's reverse camera depth; do not copy OpenGL depth conversion.
- [Epic volumetric fog](https://dev.epicgames.com/documentation/en-us/unreal-engine/volumetric-fog-in-unreal-engine): directional scattering must receive occlusion, with density and light direction determining visible shafts.

## Implementation milestones

1. Remove angular sky/fog shaft patterns. Retain the supplied sunset palette while separating medium density from illumination. Preserve the rejected screenshot as diagnostic evidence.
2. Render a cached sun depth map from real opaque terrain, mountain, tree, and building geometry. Include the whole mountain range even when off camera. Place the sun near the northern ridge horizon and expose map/visibility diagnostics.
3. Reconstruct view rays from scene depth. Integrate exponential height density, extinction, ambient scattering and shadow-tested directional scattering at half resolution. Stop at the first scene surface. Composite with depth-aware upsampling before bloom, and handle canvas resizing.
4. Verify the mechanism: actual shadow depth, lit/shadowed air probes, an occlusion-disabled comparison, ordinary and elevated views, offscreen sun and camera movement. No fixed stripes, light leaking through mountains, near-object halos, or black shader frames.
5. Measure uncapped performance separately from recording; build, review a live MP4, send it through the authorized Telegram workflow, and record exact conditions and limitations. Production deployment is outside this request.

The sun direction and density are art parameters; mountain occlusion is not. If all fog is genuinely in shadow, adjust the sun elevation or fog's altitude instead of inventing visible beams.

## Implemented and verified

V10 replaces the V9 angular shaft field and per-material fog with one depth-limited world-space volume. The rejected user capture is preserved at `.dream-loop/shadowed-fog/rejected-v9-ground-rays.png`; the original attachment is the recovery source. The earlier WoW Forever screenshot remains the color and depth reference.

The sun renders a cached 2048×2048 PCF depth map from 12 opaque environment batches, including all mountain rings even off camera. The volume uses 48 jittered samples at half the internal scene resolution, exponential height density, Beer–Lambert extinction, Henyey–Greenstein directional scattering, and a shadow comparison at every sample. Depth-aware upsampling composites before bloom. The source material grade is approximately inverted and reapplied around the light composite; already clipped source highlights cannot be recovered. The sun now sits about 12 degrees above the northern horizon so part of the fog genuinely lies above the ridge shadow.

`scripts/ashen-reach/check-volumetric-fog.mjs --tag <unique-tag>` verifies the mechanism. Final evidence is under `ve-capture/ashen-reach/volumetric/v10-final-check/`:

- All 45 GPU sunlight-visibility samples matched independent, two-sided world-triangle raycasts: 27 lit, 18 blocked. Fourteen blocked samples intersected mountain geometry.
- Removing only the mountain caster batch lit 13 of those 14 points. Restoring the batch blocked all 14 again; the remaining point has another opaque blocker.
- The shadow map remained cached through camera movement. Actual keyboard movement covered 5.0 m, and portrait resize rebuilt the scene/volume targets to 292×633 / 146×317. Restoring desktop dimensions succeeded. No runtime errors occurred.
- Matched north, west, street and opposite-facing views were reviewed, including shadow-disabled and sunlight-visibility diagnostics. The live 18.88-second flythrough was reviewed and sent as Telegram message 742: `ve-capture/ashen-reach/env-lighting/video-v10-shadowed-volume-2026-09-23/v10-shadowed-volume.mp4`. Output is 1280×720 at 60 FPS; scene rendering during recording was 960×540, with 480×270 volume integration.
- `npm run build` and `git diff --check` pass. Uncapped Chrome/WebGPU on Apple Metal 3, 1280×720 internal and viewport, seven enemies, no recording: 268.8 FPS average over 600 retained samples, p95 5.7 ms, p99 59.5 ms. Occasional long frames remain; throughput is not a steady-frame guarantee.

The environment casts true volumetric shadows. Fine instanced grass, transparent lamp effects, and animated characters are not sun-map casters in this pass. Mountain shafts are broad where the actual ridgeline is smooth. This implementation performs single scattering; it does not simulate multiple scattering or volumetric cloud self-shadowing. Production was not deployed.

## Installed Lite details worth retaining

- Camera depth is reverse Z, cleared to 0; the sun's PCF depth is conventional 0–1, cleared to 1. Reconstruct world positions with the inverse camera view-projection and WebGPU depth directly. Texture Y is inverted relative to clip-space Y.
- EffectWrapper's fragment entry point is `effectFragment`. ShaderMaterial uses `mainVertex`/`mainFragment`.
- `registerSceneWithShadowSupport` installs the sun shadow task before scene rendering. `setShadowCasterMaterial` supplies a minimal opaque depth shader; `setShadowTaskCasterMeshes` defines the actual occluders. The volume updates its light matrix after the shadow task executes.
- The installed package has no public PCF depth/matrix accessor. The small bridge to `_depthTexture`, `_depthSampler`, `_lightMatrix` and render-target views is isolated in `volumetric-fog.js` and guarded at initialization.
- Native `pickMeshesWithRay` tests aggregate mesh bounds, not individual triangles. It is unsuitable as the independent visibility oracle for batched mountains and trees; the diagnostic uses triangle intersections instead.
