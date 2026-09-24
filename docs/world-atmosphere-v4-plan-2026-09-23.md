# V4 — World atmosphere lighting balance

Continues the [world vista milestones](world-vista-repair-plan-2026-09-23.md) after [V3 citadel and ridge depth](citadel-ridge-plan-2026-09-23.md). The user's elevated screenshots showed a bright sky over nearly black land. V3 still showed that split in matched road and elevated views.

## Plan and acceptance

1. Capture twelve fixed gameplay views, including churchyard, lych gate, town gate, north overlook, west ridge, and south vista. Compare stable sky and ground regions.
2. Restrain the cloud deck's warm sunward faces and rim without a new horizon seam.
3. Recover middle-distance outer-slope detail with spatially limited fill. Keep the churchyard and central town corridor out of that fill. Preserve dark trees and citadel separation.
4. Review live town and elevated rim motion. Check normal movement, build, and frame time without recording. Deliver a reviewed live MP4 on Telegram.

Target: readable dusk landforms, local warm lamps, no return of the earlier white glare. Distant ground cover remains V2 work; play-view interface polish remains V5. Baseline captures: `ve-capture/ashen-reach/env-lighting/v4-baseline-2026-09-23/` from the active Babylon Lite game at a 1280×720 viewport. Camera poses are in `scripts/ashen-reach/capture-vistas.mjs`.

## Implemented and reviewed — 2026-09-23

- Reduced sunward cloud light and rim contribution in `src/ashen-reach/materials.js`. The fixed churchyard sky sample fell from mean luma 145.4 to 134.9, and its 95th percentile from 202.2 to 189.9. Churchyard foreground stayed 57.9 to 57.7.
- Added spatially limited outer-ground fill in that shader, away from the churchyard and central corridor. North slope mean luma rose 52.6 to 65.3; west ground rose 44.6 to 61.7. The citadel and ridge layers remained visible in matched road and elevated views.
- Reduced the two broad town-gate halo strengths from 0.60 to 0.46 in `src/ashen-reach/scene.js`. Close fixture lights remain unchanged. The fixed gate wall sample fell 115.2 to 111.2 and road 105.4 to 102.0.
- Tried a lower mist maximum, saw no material improvement to the southern hill, and restored its prior value. The smooth hill and sparse distant cover remain open V2 terrain work.

Twelve matched gameplay views are in `ve-capture/ashen-reach/env-lighting/v4-second-2026-09-23/`; six elevated boundary views are in `ve-capture/ashen-reach/world-vista-repair/v4-second-2026-09-23/`. Reviewed live diagnostic motion: [town MP4](../ve-capture/ashen-reach/env-lighting/video-world-v4-town-2026-09-23/town-atmosphere-share.mp4) and [rim MP4](../ve-capture/ashen-reach/env-lighting/video-world-v4-rim-2026-09-23/rim-atmosphere.mp4), delivered on Telegram as messages 733 and 734. These are scripted camera/player glides; a separate actual forward-input check moved the grounded character about 7.8 m without page errors.

`npm run build`, syntax checks, and `git diff --check` passed. A five-second performance run without recording or enemies, at 1280×720 viewport and 960×540 internal buffer, sampled 209 frames: 60.004 FPS, 16.6656 ms mean, 16.8 ms p95 and p99, 82 draw calls, and 175,005 world triangles. The test browser was capped at 60 Hz, so the >120 FPS goal remains unverified. V5 play-view polish is next.
