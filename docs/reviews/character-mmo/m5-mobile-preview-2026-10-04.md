# M5 mobile Armory preview — source review

**Verdict: no consequential current finding.**

Scope: uncommitted diffs of `src/ashen-reach/armory.js`, `armory.css`, `contact-occlusion.js`, `volumetric-fog.js`, against installed `@babylonjs/lite@1.31.1` (`viewport.js`, `camera.js` `_applyCameraViewport` / `getEffectiveAspectRatio`, `arc-rotate-controls.js` `attachControl` / `setCameraLimits`). Pinned camera doc: Lite `02-camera.md` at `npm-lite-v1.31.1`. Parent owns live verification (15 layout/shape/orbit+pinch/race/resize cases). Those cases are not visual-quality or performance acceptance.

Source-only limits: no browser, no captures, no FPS. Native bloom / contact-shadow task bodies were not fully re-read; parent states native viewport is forwarded. This review checks that custom AO/fog consume the same public viewport/aspect helpers as the scene task.

## Native stage viewport

`armory.js:87-91` writes Babylon normalized viewport, y from the bottom:

`y: 1-(r.bottom-c.top)/c.height`

That matches Lite 1.31.1 `_applyCameraViewport` (`camera.js:129-134`) and `resolveCameraViewport` (`viewport.js:16-19`), which convert that form to top-origin WebGPU scissor/viewport pixels. Zero CSS size bails (`armory.js:90`) so a 0-height stage does not write a degenerate `width/height` into `getEffectiveAspectRatio` (`camera.js:121-124`, `v.width/v.height`). `ResizeObserver` is connected only while open (`170`, disconnected `155` / `230`).

## Phone grid

Portrait `@media (max-width:600px)` (`armory.css:30-47`) puts heading / stage / tools / panel on a 4-row grid. `#armory[hidden]{display:none}` (`31-32`) is required: author `display:grid` would otherwise show a closed dialog. Stage stays `pointer-events:auto` with `touch-action:none`. Landscape short-height only tightens absolute insets (`48-54`); stage size still flows through the same observer.

## Shape framing

Live path uses `frameScale = raceScale * (human ? player.heightScale : 1)` (`armory.js:82`). `show` / `chooseRace` / `face` / per-frame rescale (`168`, `125`, `140`, `204-205`) all share it. Radius/focus track live Human height changes while open. Capture `setFocus` (`222-227`) still multiplies height/radius by `raceScale()` only; it is off the Armory UI path this change ships.

## Controls lifetime

`attachControl(camera, stage, scene, {keyboard:false, pointerMappings:{secondaryButton:'rotate'}})` (`174`) matches 1.31.1: listeners live on the passed element, deltas are `clientX/Y`, pinch is touch, inertia is `scene._beforeRender`, cleanup is caller-owned and idempotent (`arc-rotate-controls.js:106-129, 317-324`). Attach on `show`, detach on `close` and `onSceneDispose` (`155`, `229-230`). `setCameraLimits` (`97`) self-clamps on setters; disposer runs on scene dispose. `clearInertia` on face/close (`141`, `155`).

## Custom AO / fog reconstruction

Both passes now take `getEffectiveAspectRatio(scene.camera, width, height)` and `resolveCameraViewport(scene.camera, width, height)` (`contact-occlusion.js:120-126`, `volumetric-fog.js:188-202`). `resolveCameraViewport` is top-origin integer pixels; `@builtin(position)` is the same origin. `world` / `worldAt` convert `(pixel - viewport.xy) / viewport.zw` then `ndc.y = 1 - local.y*2` (`contact-occlusion.js:17-20`, `volumetric-fog.js:46-50`). Half-res AO/fog map `pixel / ceil(screen*0.5)` back to full-res pixels before the viewport test (`contact-occlusion.js:36`, `volumetric-fog.js:100-101`). AO radius uses `u.viewport.w` (`contact-occlusion.js:42`), i.e. the same vertical extent as the projection.

Fog uniform: `LOCAL_LIGHT_UNIFORMS` is 64 floats; CPU offset 128+64=192; `viewport` is 4 floats; `UNIFORM_BYTES=784` (`volumetric-fog.js:11, 200-202`). AO `BYTES=208` with viewport at float 48 (`contact-occlusion.js:10, 126`).

## Depth / ordinary-camera / bloom fallback

No `camera.viewport` → `FULL_VIEWPORT` `{0,0,1,1}` (`viewport.js:3-8, 15`) and raw `targetWidth/targetHeight` aspect (`camera.js:123-124`). Play-camera frames reconstruct as they did before this change. Missing/cleared reverse-Z depth still early-outs (`textureLoad(...)<=0.0`, `contact-occlusion.js:37, 68`). Contact-shadow task is constructed with a Proxy onto `scene.camera` (`contact-occlusion.js:94-98`) so a later camera swap still forwards `viewport`. Bloom remains the native task in `post.js`; this review does not re-verify that task’s internals.

## Performance (source implication, not a measurement)

AO/fog targets stay full (half) resolution; `inViewport` is a fragment early-out. Armory sub-viewport does not shrink the dispatch. Cost relative to play is unmeasured here.

## Issues

None supported at bug priority in the current named diff.

## Parent disposition after the review

Grok 4.6 / high, session `01a109f5-e85a-7770-a139-e01d7f2550ea`, seven bounded
source turns followed by two report-only turns. Both processes exited and neither
had permission to launch a game/browser, change product source or message anyone.
The quoted source review describes the earlier diff; it explicitly did not read
all native contact/bloom internals and is not live visual acceptance.

The parent closed that gap by reading installed `render-task-base.js` and
`screen-space-contact-shadows.js`. The scene task applies the viewport on every
execution and adjusts projection aspect. Native contacts, however, call
`ssWorldFromDepth` with full-texture UVs and no viewport transform. That is a real
compatibility limit, so the final product disables only native contacts for a
partial viewport. Correct custom AO and world shadows remain; native contacts
resume on closing the Armory. A unit guard and the final built live check exercise
both states. The source-only “no consequential finding” does not claim this later
engine limitation was independently verified by the worker.

The final parent checks pass: 15 built preview cases, native touch orbit/pinch,
six resize sizes, height endpoints, identity undo, three races, three repeated
open/close cycles with exact hook counts, disposal while open, and three desktop
mobile/WebKit/depth-fallback cases. Character 200/200 and focused lighting/projection
10/10 pass. Live stills, twenty decoded MP4 samples, actual VE playback/seek and
Telegram inline/expanded motion were reviewed. User WoW remained active: no FPS,
cold-start, physical iPhone, native fullscreen or Telegram Desktop acceptance.
See [the final result](../../plans/character-mmo/results/m5-mobile-preview-2026-10-04.md).
