# Graphics milestones

Updated 2026-09-24. Baseline V10 is committed as `8c550ef`, pushed to main, and deployed to https://play.sparkify.dev (Pages deployment `372548bd`). Production smoke check: ready, Havok physics, shadowed volumetric fog, valid WASM, no page errors. This roadmap describes future work, not an automatic task queue.

## 1. A fully shadowed street — deployed

Sunlight now follows the same occlusion on terrain, masonry, vegetation, animated characters, and fog. Three cascades cover the foreground; the cached distant map preserves mountain occlusion. The southern approach supplies the sun/shadow traversal because Hollowmere is largely in mountain shade at this sun angle. Detailed plan and measured results: [V11](fully-shadowed-street-plan.md).

V11 production release: `b628f37`, Pages `b14a1aa7`, 2026-09-24.

## 2. Ground contact and ambient occlusion — implemented locally

Add restrained depth-based contact and ambient occlusion around feet, stones, walls, and vegetation roots. Preserve warm lamp lighting and avoid black halos, screen-edge leaks, and shadows that detach during animation. Validate camera movement and portrait views.

The [V12 plan and results](contact-occlusion-plan-2026-09-24.md) record the native contact pass, local AO, bounded composition, live validation, and remaining limitations. Awaiting a separate release request.

## 3. Linear HDR lighting and exposure

Render surface lighting and volumetric scattering into linear floating-point color. Apply exposure, bloom, and tone mapping once at the end. Remove the current approximate inverse material grade. Match character PBR and custom environment materials; keep highlights colored and the sky readable.

## 4. Local lights with believable occlusion

Replace geometric lantern cones with light scattering that responds to scene depth and appropriate shadow maps. Give major lanterns and spell lights a bounded shadow budget. Lite supports spot shadows; omnidirectional point shadows need a separate design. Test moving spells, walls, and simultaneous lights.

## 5. Material depth and reflections

Introduce selected normal and roughness maps, wet stone, metal response, and restrained environment reflections. Preserve the established stylized textures. Evaluate improvements in ordinary gameplay rather than close-up material previews alone.

## 6. Stability, vegetation, and scale

Improve foliage silhouette shadows and wind correspondence, distance transitions, and temporal stability of fog and shadows. Evaluate temporal reconstruction against the pixel-art presentation. Budget each feature across desktop and mobile resolutions.

## 7. Weather and changing daylight

Drive sky, sun, clouds, fog density, surface light, and shadow direction from a shared weather/time model. Cloud shadows and regional mist should compose with mountain and building occlusion. Capture transitions, not just isolated presets.

## Acceptance shared by all milestones

- Review the actual game with movement, camera changes, and portrait resize; no black frames or GPU validation errors.
- Record a live MP4/GIF, review it, and deliver it via Telegram. Stills support review.
- Target above 120 FPS. Report internal resolution, hardware/browser conditions, population, average and tail frame times; benchmark separately from recording.
- Document limitations and source/API evidence. Keep native Lite/WebGPU and compatible animation/Havok contracts.
- Deploy each new milestone only with deployment authorization; the deployment requested before V11 covers the V10 baseline.
