# Camera API audit — 2026-09-25

The game uses native Babylon Lite `ArcRotateCamera` for orbit transforms, projection, dirty tracking and rendering. The V26 terrain-only camera sampler unnecessarily duplicated work available in the existing Havok world. It has been replaced with Lite's native `shapeCast`.

## Sources and version boundary

Reviewed the official [camera architecture](https://github.com/BabylonJS/Babylon-Lite/blob/master/docs/lite/architecture/02-camera.md), [porting guide](https://github.com/BabylonJS/Babylon-Lite/blob/master/docs/lite/03-porting-guide.md#4-camera-controls-are-separate), and [physics architecture](https://github.com/BabylonJS/Babylon-Lite/blob/master/docs/lite/architecture/42-physics.md). Confirmed every adopted API against installed **`@babylonjs/lite` 1.28.0** declarations and implementation, including `lib/physics/havok-queries.js`. The skill's Babylon documentation MCP was unavailable in this session, so official upstream files supplied the documentation.

Upstream documentation includes newer pointer-button mappings absent from the installed `AttachControlOptions`. No package upgrade or Classic Babylon camera collision API is needed for this fix.

| Responsibility | Implementation |
| --- | --- |
| Orbit, view/projection matrices and camera world position | Native `createArcRotateCamera` / `getCameraPosition` |
| Pitch and physical radius bounds | Native `setCameraLimits` |
| Frame-rate-independent zoom and outward recovery | Native `expDampFactor`; existing zoom response preserved by converting 14/s to a half-life |
| Terrain, walls, stair ramps and other authored colliders | Native Havok `shapeCast` in the player's existing world |
| Self-collision exclusion | Public `controller.getBody()` passed as `ignoreBody` |
| Query shape lifetime | One sphere allocated at physics setup, released through `releasePhysicsShape` on scene disposal; callback detached |
| Game behavior | Small rig adapter: following the character, LMB free orbit, RMB character facing, requested zoom, view punch and collision recovery policy |

`attachControl` is a general orbit/pan input handler. Its installed default right-drag pans the target, while the game requires pointer-lock mouselook, character facing/strafe coordination, both buttons to run, click selection and a touch movement stick. Adding it beside `src/input.js` would create two owners of the same events and per-frame camera state. The game retains its input adapter; Lite owns camera math and Havok owns collision queries. `interpolateArcRotateCamera` schedules pose transitions; it is unnecessary for a continuously followed character whose target and yaw must agree with locomotion in the same frame.

## Collision behavior

A query-only sphere of radius 0.22 m sweeps from the player's camera pivot to Lite's desired camera position. It excludes the player's own capsule and trigger volumes. That radius covers the game's 0.1 m near plane at the current field of view and tested landscape/mobile aspect ratios. It shares the authored movement colliders, including terrain and masonry, with no secondary geometry or physics world.

The camera retracts immediately to just before contact, then recovers outward with an 80 ms half-life. Requested zoom remains unchanged when obstructed. The physical radius may fall below the 2.2 m scroll minimum; otherwise tight tower corridors cannot be protected. A zero-time placement resolves the arm immediately. Decorative surfaces without movement colliders remain outside this query.

## Verification

- Four camera tests and sixteen touch lifecycle tests pass; Vite build passes.
- Real Lite/Havok checks cover open space (own capsule ignored), low terrain angle, nave wall, 24 directions at a tower stair turn, LMB orbit, RMB facing and query cleanup on scene disposal. All pass with zero runtime/GPU errors or movement recoveries.
- The tower-turn sweep produced camera radii of approximately 0.97–5.60 m at an 8 m requested distance. Ground and masonry blocked the arm; open space retained the requested distance. Re-sweeping the actual camera segment found no lens penetration.
- Reviewed live before/after route captures and the dense sequence around the tower turn: the former masonry-filled view now shows the character and stairs. Tight interiors still produce close framing.
- Full west bell-tower ascent and return pass with normal keyboard movement, Havok active and no recovery teleports (54 waypoint samples).
- Native touch with the depth-bundle fallback and desktop WebKit pass. Physical iPhone acceptance remains separate.

Evidence: `ve-capture/ashen-reach/camera-native/`. The [26.037-second live MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/camera-native/2026-09-25-camera.mp4) is 1280×720 with square pixels. Its opening architectural view is labelled as a raised camera; the remaining excerpts use gameplay framing.

Telegram **766** returned matching dimensions and duration. VE returns `video/mp4` and byte-range status 206; direct WebKit playback confirms 1280×720 and an advancing playback clock without a media error.

The initial nave-wall test aimed through a real chapel doorway; its fixture was moved to solid masonry. One traversal run was interrupted by a development hot reload and was rerun after edits stopped. Neither attempt is counted as a passing check.

For future camera work, search the native camera **and physics query** APIs before implementing spatial sampling or collision geometry. Check the installed version before adopting examples from newer upstream docs.

## Performance

M1 Max, uncapped Chromium 153 WebGPU, 1280×720, seven enemies; three 12-second walking runs per route, separate from recording. Every run exceeds 120 FPS, none is vsync-capped and all have zero recovery teleports.

| Route | Mean FPS across runs | Worst p99 (ms) | Worst frame (ms) | Frames >16.67 ms |
| --- | ---: | ---: | ---: | ---: |
| Town | 180.15 | 12.3 | 13.3 | 0 |
| Bridge | 219.01 | 10.5 | 58.6 | 2 |
| Cathedral | 225.74 | 10.1 | 13.8 | 0 |
| Forest | 191.06 | 6.8 | 8.9 | 0 |

Previous V26 means were 177.04 / 219.00 / 225.65 / 191.63 FPS. Throughput is comparable; the bridge's isolated 58.6 ms frame remains a limitation, not a zero-stall result. Raw runs: `ve-capture/ashen-reach/camera-native/performance.json`.
