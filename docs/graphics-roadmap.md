# Graphics milestones

## V16–V18 update

The user authorized three sequential milestones. V16 material depth/specular, V17 measured CPU-work reduction and V18 vegetation stability are all deployed and verified. Current game commit is `849fda6`, Pages `8585b672`. [CURRENT.md](CURRENT.md) is authoritative for release status. The three-milestone sequence is complete.

- [V16](v16-material-depth-plan.md): stone normal/roughness detail and shadowed native/custom lantern highlights. Wet surfaces and broader reflections remain future work.
- [V17](v17-frame-pacing-plan.md): observed HUD dimensions, shared posed bounds, full-window frame measurements. Long frames remain; investigate actual GPU queue/pipeline stalls before claiming smooth frame pacing.
- [V18](v18-vegetation-stability-plan.md): matching grass LOD shapes, smooth rooted removal and reduced distant flutter. Other plant prototype transitions, broader foliage shadowing and antialiasing remain future work.

After this authorized sequence, the strongest next investigation is frame-tail attribution and pipeline reuse with device/animation validation. Weather, cloud shadows and changing daylight remain larger design milestones. These are recommendations, not authorization to start another milestone.

## Earlier milestone notes — historical release state

Updated 2026-09-24. Current production baseline is V15, committed as `2dc981b` and deployed to https://play.sparkify.dev through Pages `31f85684`. Production rendering, movement, physics and mobile depth fallback checks pass. User confirmed the production game works on their phone after this release. This confirms reported usability; no on-device frame-time measurement was supplied. This roadmap describes future work, not an automatic task queue.

## 1. A fully shadowed street — deployed

Sunlight now follows the same occlusion on terrain, masonry, vegetation, animated characters, and fog. Three cascades cover the foreground; the cached distant map preserves mountain occlusion. The southern approach supplies the sun/shadow traversal because Hollowmere is largely in mountain shade at this sun angle. Detailed plan and measured results: [V11](fully-shadowed-street-plan.md).

V11 production release: `b628f37`, Pages `b14a1aa7`, 2026-09-24.

## 2. Ground contact and ambient occlusion — deployed

Add restrained depth-based contact and ambient occlusion around feet, stones, walls, and vegetation roots. Preserve warm lamp lighting and avoid black halos, screen-edge leaks, and shadows that detach during animation. Validate camera movement and portrait views.

The [V12 plan and results](contact-occlusion-plan-2026-09-24.md) record the native contact pass, local AO, bounded composition, live validation, and remaining limitations. Released as `8c20843`, Pages `3d6eb578`, on 2026-09-24. See the [implementation retrospective](v12-lighting-retrospective-2026-09-24.md).

## 3. Linear HDR lighting and exposure — deployed

Render surface lighting and volumetric scattering into linear floating-point color. Apply exposure, bloom, and tone mapping once at the end. Remove the current approximate inverse material grade. Match character PBR and custom environment materials; keep highlights colored and the sky readable.

[V13 implementation and results](linear-hdr-plan-2026-09-24.md): shared linear targets, native material compatibility bridge, one final display transform, live GPU probes, mobile-browser regression checks and reviewed movement/spell video. Deployed as `05fe8fe` / Pages `f71594d2`; physical iPhone review remains pending.

## 4. Local lights with believable occlusion

[V14 first slice](local-light-plan-2026-09-24.md) established shared native/custom/fog visibility. [V15 street extension](street-light-plan-2026-09-24.md) covers all nine freestanding street lanterns plus the gate with two shadow slots, conservative animated caster selection and static map caching. Both are released as `2dc981b` / Pages `31f85684`. Live town, HDR, sun and mobile-browser checks pass; reviewed motion is delivered. Physical iPhone review remains pending. Building/window lights, local specular response and moving spell shadows remain future work.

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
