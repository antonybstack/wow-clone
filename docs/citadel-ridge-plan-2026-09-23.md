# V3 — Citadel and ridge depth

Continues the [world vista repair plan](world-vista-repair-plan-2026-09-23.md), using the user's preserved screenshots and matched live V2 views. The visible targets are readable fortress stone, a continuous supporting crag, a complete skyline in the street camera, and mountains with sloped faces.

## Plan

1. Separate fortress masonry from the black silhouette material; reuse limestone with masonry UVs at a consistent scale. Keep dark roofs and small warm windows.
2. Correct wall orientation, close the supporting crag, and distinguish low gate towers, rear towers, and a central Gothic spire. Review the whole fortress from street and aerial cameras.
3. Replace vertical ridge curtains with sloped shoulders and terrain intersections. Review the sides during a live flight and correct exposed surface or foundation defects.
4. Verify movement, geometry data, browser errors, build, and rendering cost. Review the live clip and send it through the authorized Telegram progression channel.

## Implemented

- Corrected wall rotation: box width runs along local X, so the proper yaw is `atan2(-dz, dx)`. Merlons and wall spans now follow the same endpoints.
- Replaced disconnected foundation triangles with a closed, capped crag whose lower skirt enters the heightfield. Added buttresses, stone bands, window recesses, and distinct tower crowns.
- Moved the central citadel from z=260 to z=310 and reduced secondary tower heights. The main spire now fits in the matched Hollowmere street view; the closest northern ridge has a saddle to preserve the sightline.
- Corrected fortress masonry lighting normals. A dedicated material gives shaded stone a restrained skylight fill; existing surfaces default to zero additional fill. Roofs remain dark and windows stay small.
- Replaced mountain curtains with inner slopes, shoulders, crests, and outer slopes. Shared shading normals prevent long triangular streaks across nonplanar quads.
- Added a 512-pixel [CC0 Rock Face texture from Poly Haven](https://polyhaven.com/a/rock_face), with [provenance](../public/ashen-reach/horizon-rock-source.md). World-projected texture coordinates prevent masonry-like horizontal stretching across the crags.

## Live review

Final matched captures are in `ve-capture/ashen-reach/world-vista-repair/v3-clearance/`, with the unchanged baseline in `v3-before/`. Reviewed aerial, south-rim, east-rim, town-street, and two oblique citadel views. The first pass was too bright and the first ridge material read as manufactured masonry; both were corrected. Later review corrected blue-heavy stone, harsh ridge facets, a small roof gap and second-ridge penetration through the fortress rear. The ring wobble is now periodic, avoiding a closing seam.

The world remains sparse beyond the playable area. Fuller ground cover belongs to the open V2 item; the broad sky/land brightness balance remains V4. This pass does not make the distant fortress traversable.

## Verification and delivery

- Production build, syntax, finite geometry data and whitespace checks pass. Live captures and movement raised no page errors. A 1.1-second forward input moved the character 7.70 m along Hollowmere road, with grounded state true after settling.
- An independent geometry review checked the fortress support and ridge intersections. All 612 checked fortress foundation vertices were on the cap. The second and third ridges no longer enter the checked footprint; sampled first-ridge clearance below the foundation ranged from 4.77 to 14.02 m.
- World triangles: **175,005**, versus V2 **171,363** (+3,642). Horizon triangles: 6,932. World batches: **23**, versus 21. No playable collision geometry changed.
- Foreground headless Chrome, no enemies or recording during measurement, 960×540 viewport / 720×405 internal buffer, 300 frame intervals: **60.002 FPS**, **16.666 ms mean**, **16.7 ms p95**, **16.8 ms worst**, 82 observed draw calls. The browser reports a **60 Hz cap**; this does not establish >120 FPS or native-resolution performance.
- Reviewed the encoded [live citadel flight](../ve-capture/ashen-reach/env-lighting/video-world-v3-2026-09-23/citadel-flight.mp4), including street, west/east oblique and aerial motion. H.264, 1280×720, 60 FPS, 18.93 seconds. Diagnostic camera flight; road movement was tested separately. Delivered on Telegram as message **732**. Local implementation only; no public game deployment was performed.
