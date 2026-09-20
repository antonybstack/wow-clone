# Ashen Reach — direct reference implementation, 2026-09-17

Status: initial live reference implementation. On 2026-09-17 the user explicitly endorsed this visual direction and the subsequent workflow/output. Implemented directly by the parent, without Grok or other implementation/judge subagents, as explicitly requested. This is not a claim of an identical match or completion of the MMORPG.

## Run and review

`npm run dev`, then open **http://127.0.0.1:5173/ashen-reach.html**.

- Initial view is the fixed graveyard comparison camera. The player is hidden in this view.
- W/S move, A/D turn, Q/E strafe, RMB look, Shift walk, Space jump. Movement automatically selects third person.
- V toggles the third-person and reference cameras. R resets position, facing, and reference camera. H hides the help line.
- `?clean` hides the help line. `?play` starts in third person. Both may be combined.
- The former Moonwell route and its old Vite entry were removed after Ashen Reach became the accepted playable direction. Character lab/body preview remain separate development-tool entries.

The original runtime screenshots were working review evidence and were removed during the 2026-09-17 cleanup. This report records the accepted scene decisions; the current playable result is the Ashen Reach route.

Parent opened both final reference/third-person PNGs and sent the originals to Telegram as messages **528** and **529**. Inbox checked after delivery: no new messages. No persistent inbox monitor is running after this turn.

## Exact target and interpretation

The user rejected the first five retro POCs and the subsequent grounded Blender waystation. The latter reused the old game’s body, wardrobe, trees, and materials, producing the same broad appearance despite different presentation. The correction was to reject existing art/design where needed and closely reproduce the supplied Sword Hero screenshots.

This pass concentrates on the first supplied image, the nighttime churchyard. Its critical composition is a low eye line, dark bare woodland, a broken sun-wheel memorial at the end of an overgrown stone path, a large left foreground tomb, tilted right foreground markers, scattered yellow-green lamps, and a massive black tower on the right. The green-fog fortress and fire/dragon screenshots are additional style references; their scenes were **not** implemented in this pass.

The target is copied locally to `.dream-loop/sword-reference/target.png` (ignored working reference). The three linked screenshots were downloaded and visually inspected as `demo4.jpg`, `demo10.jpg`, and `demo2.jpg` in the same directory:

- https://i0.wp.com/tomsgaming.com/wp-content/uploads/2025/09/swordherodemo4.jpg?resize=863%2C391&ssl=1
- https://i0.wp.com/tomsgaming.com/wp-content/uploads/2025/09/swordherodemo10.jpg?resize=863%2C576&ssl=1
- https://i0.wp.com/tomsgaming.com/wp-content/uploads/2025/09/swordherodemo2.jpg?resize=727%2C930&ssl=1

Reference screenshots are reference only. Their pixels and game assets are not shipped as textures.

## Implementation map

| File | Responsibility |
| --- | --- |
| `ashen-reach.html` | Full-window pixel-scaled canvas, small optional controls hint, loading/error state |
| `src/ashen-reach/main.js` | Lite/WebGPU boot, camera modes, existing Havok controller and source animation integration, metrics/debug surface |
| `src/ashen-reach/scene.js` | New churchyard composition, terrain, grave silhouettes, memorial, bare trees, towers, fences, lamps, grass/fern placement and collision descriptors |
| `src/ashen-reach/geometry.js` | Packed static triangle geometry, boxes/tapered branch segments, deterministic random generator, terrain height function |
| `src/ashen-reach/materials.js` | Textured diffuse WGSL surfaces, point-sampled texture presentation, distance fog, analytic local lamp contribution, wind, cloud sky |
| `scripts/ashen-reach/prepare-wanderer.mjs` | Reproducible POC trousers/belt/boot/cuff material assignment while preserving the source rig and animations |
| `scripts/ashen-reach/capture.mjs` | Open the owned Chrome CDP9337 tab, wait for real readiness, capture browser evidence and errors |
| `scripts/ashen-reach/playtest.mjs` | Actual keyboard movement/turn/jump/landing checks, screenshots, 600-frame performance summary |
| `public/ashen-reach/` | New foliage atlas, grave-face texture, isolated derived character GLB |

The former Moonwell world builders, architecture, meadow shader and old composition were removed. Existing input, Havok locomotion and source-rig character animation remain useful infrastructure and are reused. No Classic Babylon API or dependency was added. No live Blender MCP shrine was altered.

## Rendering and assets

- One-sample rendering, canvas `maxDevicePixelRatio: .75`; at the tested 1280×720 browser viewport the actual buffer is **960×540**, upscaled with CSS `image-rendering: pixelated`.
- Custom textured diffuse materials, with no shiny PBR treatment on the environment. Point sampling and intentional UV sampling densities give visible texture pixels.
- Existing licensed ground, stone, bark, wood and cloth albedo sources are reused as raw material sources, with different application, lighting and composition. The old vegetation artwork was specifically replaced because its dark outlines reproduced the wrong look.
- The sky uses the retained `public/ashen-reach/sky-generated.jpg`, mapped higher on the sky sphere and graded inside WGSL. The sphere is within the new 450m far plane. Earlier near clipping caused a visible dark arc and was fixed.
- New `foliage-atlas.png`: built-in image generation, four cells containing two grasses and two fern fronds; original RGBA asset retained. Alpha-cutout shader also rejects saturated red stray edge pixels from generation. Grass and bent fern cards have subtle shader wind.
- New `grave-face.png`: built-in image generation, a weathered limestone face with a shallow eroded sun-wheel and faded marks. Replaces the first iteration’s black cross/line primitives. Asset prompts are recorded in `scripts/ashen-reach/asset-prompts.md`.
- Static environment geometry is packed into nine surface batches. Distant trees have one fewer branching recursion level; distant grass placement is thinned beyond 38m. The reviewed world has approximately **126,512 environment triangles** (character and sky excluded from that count).
- The derived wanderer keeps the existing MakeHuman-derived anatomical body, 65-joint source bind and all **45 source clips**. The POC applies trouser/leather surface regions to the body, and removes the separate review shorts from the visible mesh. This is **not production clothing, race fitting, or the modular armor architecture**. The body and original source animation provenance remain those recorded in the existing character source pipeline.

## Verification

Build command: `npm run build` (Vite includes the new entry).

Browser verification: `node scripts/ashen-reach/playtest.mjs`. The script saves exact results in `ve-capture/ashen-reach/playtest.json`, including initial/moved/turned/airborne/landed states and the performance sampling window. Walking, turning, a real jump impulse, return to grounded support, Havok availability and clean captured console are checked independently.

The early reference view measured about 144 FPS; the initial third-person view measured approximately 98 FPS and was rejected against the >120 constraint. After reducing distant foliage and branches, the final 600-frame third-person playtest measured **143.995 FPS**, **6.945ms mean**, **7.90ms p95**, **18 draw calls**, at **960×540**. All six gameplay/console checks passed. These are local browser wall-frame measurements, not GPU timestamp results or a guarantee at other resolutions/devices. Final reproducible playtest evidence is authoritative if these numbers vary. Do not extrapolate this tiny art-study scene to a populated MMORPG.

## Remaining visible gaps

1. Trees remain procedurally branched, with straighter and more repetitive forms than the reference’s gnarled trunks and irregular crowns. The skyline and exact tree placement do not match pixel for pixel.
2. Cloud structure and illumination are different. The reference has deeper, more selective darkness and local light bloom. Current lamps contribute a cheap analytic color term without production shadowing/bloom.
3. The ground is rolling but lacks the reference’s carefully sculpted berms and broken surface variation. Path encroachment, debris, ivy and partly buried stones need further authoring.
4. Grave and tower silhouettes are original approximations. They are not extracted reference assets. Surface texture improved substantially, but repeated grave faces and simple tower massing remain visible.
5. The character is a motion-compatible stand-in with a surface-only outfit. Shoulder anatomy, skin finish, real clothing volume, equipment and the waist edge still need a separate art pass.
6. Subsequent accepted iterations added targeting, a training dummy, Fire Blast and Lava Ball. See [CURRENT.md](../CURRENT.md). Moving enemies/population remain open.
7. The green fortress/meadow and burning dragon scenes have not been built.

The user has endorsed the direction and output; this does not establish pixel identity, a finished MMORPG or completed art in every area. Keep reviewing live evidence against the supplied references.

## Learnings for the next iteration

- Directly preserve the reference’s spatial hierarchy before reusing an attractive existing asset; inherited asset silhouettes can overwhelm the requested change.
- Generated foliage with natural alpha silhouettes and a dedicated grave texture improved the result more than increasing geometric complexity.
- Use consistent world-space terrain material blending for paths; independent thin flagstone quads produced intersection artifacts on the uneven grid.
- Keep the render sky inside the camera far plane. A sphere whose radius exceeds far clipping can produce huge false bands mistaken for lighting problems.
- Readiness must be awaited with Playwright’s third `options` argument. Passing `{timeout}` as the predicate argument does not set its timeout.
- Performance samples need at least the four-second warm-up plus a real sampling interval. Zero samples / infinity is not an FPS result.
- Review third-person performance as well as the fixed reference frame. A static environmental screenshot alone did not reveal the first third-person performance failure.
- Keep this review loop direct for this request; the user explicitly asked for no Grok subagents.
