# World vista repair — 2026-09-23

Source: the user's three unaltered local game screenshots, preserved at
[`references/world-vistas-2026-09-23/`](references/world-vistas-2026-09-23/).
They show Hollowmere and the outer landscape from elevated developer flight.
The existing Sword Hero references and the night churchyard direction in
[`CURRENT.md`](CURRENT.md) remain the visual target.

## What the screenshots establish

| Priority | Visible problem | Evidence and scope |
| --- | --- | --- |
| Critical | The ground stops abruptly at the world boundary, exposing broad pale/lavender empty bands. | Images 2 and 3. `scene.js` builds earth only over x = -90…90, z = -95…145; the camera and sky continue beyond it. This is scene geometry, not a targeting or physics fault. |
| High | The near rim and distant mountain bands read as flat, sharply separated sheets. | Images 1–3; especially the transition beneath the citadel. The current landscape uses a rectangular heightfield and several single-surface ridge curtains. |
| High | The citadel reads as an almost black wall of towers, with little readable masonry or base; its scale overwhelms the settlement. | Images 1 and 3. Check from the road as well as in flight before changing the approved skyline. |
| High | Distant evergreens repeat a narrow cone silhouette at similar spacing and value. The outer fields between them are sparse. | Images 2 and 3. This repetition becomes obvious from above. |
| Medium | The sky is very bright and warm while the lower scene is nearly black; the landscape loses depth and material detail between the two. | All three images. Tune exposure, haze, and surface values together after the missing geometry is fixed, retaining the dark world and warm lamp accents. |
| Medium | Hollowmere's roofs and masonry are repetitive, and the distant settlement has few readable landmarks or signs of use. | Image 1. Existing streets, lamps, people, and encounters should be judged at ground level before adding content. |
| Medium | The top help text and bottom action labels are tiny and low contrast at this desktop viewport. | Images 1 and 3. The debug controls are intentionally present in this `?dev` view. |

The player is airborne because the screenshots explicitly show **DEV GOD FLY**.
These images do not establish a broken grounded controller. The frame counter
shows about 144 FPS at a reported 1305×994 render size; that is one captured
condition, not a performance guarantee for a larger world.

## Milestones and acceptance gates

1. **V1 — Close the terrain boundary.** Extend the visual ground beyond the
   playable rectangle with a coarse, continuous apron. Preserve the current
   in-bounds heightfield, walkable bounds, churchyard, and texture alignment.
   Review matched elevated views from all three screenshot directions and a
   normal on-foot view. No pale gap, vertical edge, or new repeating grid.
   Measure frame time and triangle cost against the >120 FPS goal.
2. **V2 — Give the outer land believable structure.** Replace the bare belts
   and cone-tree repetition with a small set of distinct tree silhouettes,
   uneven clustering, visible ground cover, and terrain forms that connect to
   the current hills. Keep it backdrop-only and inexpensive. Review aerial
   and road-level parallax; no obvious repeated stamp or empty field.
3. **V3 — Recompose the citadel and ridges.** Clarify its crag attachment,
   tower hierarchy, wall depth, and stone values. Shape the mountain layers
   so each has a readable crest and transition, without masking the sky or
   replacing the established Gothic landmark. Check from Hollowmere street,
   gate overlook, and elevated side angles.
4. **V4 — Balance the night atmosphere.** Reduce the hard sky/land contrast,
   recover mid-distance surface detail, and keep lamps warm and local. Verify
   day-sky glare does not return, the churchyard remains legible, and distant
   depth survives camera movement. This is a scene-wide lighting review, so
   it follows geometry and composition.
5. **V5 — Finish readable play views.** Improve the desktop help and action
   labels at the captured viewport, distinguish dev-only controls, and check
   normal combat, targeting, flying, and mobile layouts. Capture a reviewed
   live walk and flight clip. Every visual milestone also requires a reviewed
   live GIF or MP4 on Telegram before delivery.

## V1 progress — 2026-09-23

The visual far-ground grid now shares the playable ground's border vertices,
height, UVs, vertex color, and lamp contribution, then continues beyond the
camera far plane. The playable mesh, collision, bounds, and far-tree placement
remain unchanged. Matched local `ve-capture/ashen-reach/world-vista-repair/`
flight views show the exposed pale void is gone. The pale hillside and cone
trees remain visible. The ground-level view was also checked.

The build and syntax checks pass. World triangles rose from 140,799 to 154,831
(+14,032); draw batches remain 21. The capture browser was capped at 60 FPS
with a 720×405 internal render buffer in a 960×540 viewport, so this does not
yet verify the >120 FPS goal. A 16.25 s live diagnostic flythrough was reviewed
and sent to Telegram as message 730.

V2–V5 remain open until their live acceptance views and performance
measurements pass.

## V2 implementation plan — 2026-09-23

The V1 captures `02-south-rim`, `03-east-rim`, and `04-town-ground` are the
comparison views. The main defect is a broad, nearly uniform lit slope with
regular cone silhouettes; the ground now continues, but it has too few
landforms and too little vegetation hierarchy to read as a landscape.

1. Shape shallow gullies and spurs in the outer heightfield, easing them in
   from zero at the playable boundary. Preserve every in-bounds height and
   the current movement clamp. Recheck the hill crest from town so added
   relief does not swallow the citadel or sky.
2. Rebuild the far woodland as mixed, asymmetric low-poly silhouettes in
   uneven groves. Retain broad open patches and clear space around the
   citadel. Do not place a uniform tree row along the boundary.
3. Add restrained low scrub/stone variation where the new continuous slope
   is visibly empty. Keep material and draw-call growth low; inspect foliage
   at ground level so it does not look like hovering stamps.
4. Compare matched V1/V2 live screenshots at the three elevated directions
   and a normal street camera, then review a moving flight and walk capture.
   Run the build and world counts, report measured frame-time conditions,
   and send a reviewed live MP4 or GIF on Telegram. The >120 FPS goal remains
   open if the available display caps the measurement at 60 Hz.

## V2 implementation and review — 2026-09-23

- Added shallow spurs and cuts to the outer heightfield, easing to zero at the playable boundary. The movement bounds and in-bounds terrain are unchanged.
- Refined the continuous far-earth grid and shifted the distant surface toward muted heath tones. Reworked far trees into varied crowns and uneven woodland groves, with open space around the citadel. Current live scene reports 661 far trees and 139 far rocks.
- Tried separate scrub and young-tree silhouettes in live captures. They read as dark dots and cutouts, so those variants were removed. The distant moor still lacks convincing close-range ground cover; this V2 acceptance item remains open.
- Reviewed matched elevated and town-ground screenshots under `ve-capture/ashen-reach/world-vista-repair/v2-heath-contrast/`. The [16-second live flight](../ve-capture/ashen-reach/env-lighting/video-world-v2-2026-09-23/boundary-flythrough.mp4) was reviewed and delivered on Telegram (message 731). The clip still shows sparse slopes and a dark, oversized citadel; V3 and V4 address those visual issues.
- Movement check: a 1.1-second forward input moved the character about 7.7 m along the Hollowmere road; grounded stayed true and no page error occurred. Build and syntax checks passed. World triangles: 171,363 versus V1's 154,831 (+16,532); draw batches remained 21. In owned headless Chrome at 960×540 viewport and 720×405 internal buffer, with no enemies or recording, 249 samples yielded 60.001 FPS, 16.666 ms mean, 16.8 ms p95. This is a 60 Hz cap and does not verify the >120 FPS goal.

V3 is implemented and reviewed: see the [citadel and ridge plan, changes and evidence](citadel-ridge-plan-2026-09-23.md). [V4 atmosphere and lighting balance](world-atmosphere-v4-plan-2026-09-23.md) is also implemented and reviewed, with town and rim live MP4s delivered on Telegram (messages 733 and 734). [V5 readable play views](play-views-v5-plan-2026-09-23.md) are implemented and reviewed; desktop and touch clips were delivered on Telegram (messages 736 and 735). The V2 distant-cover follow-up is recorded below.

## V2 outer-moor follow-up — 2026-09-23

The sparse-slope gap received a focused live pass. `distantRelief` adds shallow crossing swells only beyond the playable rectangle, fading out before coarse far-earth cells. A separate foliage pool draws textured moor clumps to 185 m without extending the dense meadow pool or flower range. This adds two foliage draws; world batch triangles remain 175,005. Candidate foliage instances rose from 109,183 to 126,711, while the south-rim camera drew about 1,667 moor far instances. South/east matched views show cover up the slopes; the town-ground view retains its street and citadel framing. The cover still reads as stylized specks at distance, so this is a bounded improvement rather than final landscape art.

Reviewed live boundary motion was delivered on Telegram (message 738; replaces the initial 25 FPS encode in message 737). The first take intersected a tree trunk; the delivered cut passes the grove and preserves 800 captured frames at 60 FPS, 1280×720, over 13.3 seconds. Recording metadata and frames are in `ve-capture/ashen-reach/env-lighting/video-v6-outer-moor-v2-2026-09-23/` (ignored local evidence). No page errors occurred. `npm run build`, syntax checks and `git diff --check` passed.

Uncapped headless WebGPU measurements with seven enemies, 600 retained frame samples and no recording: 960×540 internal / 1280×720 viewport: 422 FPS average, p95 3.6 ms, p99 18.3 ms; 1280×720 internal / 1280×720 viewport: 394 FPS average, p95 4.1 ms, p99 18.8 ms. The elevated south rim with no enemies measured 606 FPS average at 960×540, p95 2.9 ms, p99 14.5 ms, drawing 1,667 moor far instances. These `requestAnimationFrame` intervals demonstrate headroom above 120 FPS on this machine; occasional stalls still exceed the 8.33 ms budget, and they are not GPU timing or native mobile measurements. See [uncapped setup](debug-view.md#measure-above-the-headless-chrome-60-fps-cap).
