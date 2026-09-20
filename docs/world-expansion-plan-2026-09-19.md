# World expansion toward an MVP — 2026-09-19

Status: **active**. Started 2026-09-19 from `main` at `6b7f18e`, with the production build and both
test suites green. The Orc character pipeline is complete enough to stop polishing; this plan moves
effort to the world, then to a combat loop.

## Why this plan

Ashen Reach has a credible character, eight fitted garments on two races, two spells and an armory.
It has one small churchyard and one static training dummy. The gap between this and a playable MVP
is world and encounter content, not character fidelity.

## Design: the settlement of Ashen Reach

The churchyard is preserved exactly as approved and the world grows north along the road that
already exists as `pathX(z)`.

| Zone | Extent (z) | Content |
|---|---|---|
| Approach | < 0 | Sparse dead ground, ravine edge as a soft boundary |
| **Churchyard** | 0–40 | Unchanged: spawn, tombs, chapel ruin, lanterns |
| Lych-gate and climb | 40–75 | Road rises out of the burial ground through a gate |
| **Hollowmere** | 75–140 | Walled town: gatehouse, main street, tavern, smithy, chapel, houses, market stalls, well square, watchtower |
| Ridge and vista | 140+ | Citadel of Vaelmark on a distant crag, curtain walls, five towers, lit windows, mountain ridgeline |

Traversable ground grows from roughly 180×240 m to roughly 400×600 m. The citadel is a backdrop and
is not traversable. Night atmosphere and the warm-lamp palette are unchanged.

## Architecture constraints found before starting

The world is generated in code, not imported. `geometry.js` accumulates triangles into a `Batch` per
material and `scene.js` commits nine batches. That produces 46 draws and 126,512 triangles at 144 FPS.

Two properties of that design bound the work:

- **Lighting does not scale.** `materials.js` hardcodes two lamp positions in the WGSL fragment
  shader plus three dynamic slots for fire, hand fire and lava. A town of lit windows and street
  lamps cannot be expressed in that shader as written. Milestone 1 addresses this first because
  every later milestone would otherwise be built on it and need redoing.
- **No culling or level of detail.** One mesh per material means the full triangle set is submitted
  every frame. This is acceptable now and is measured at each milestone rather than pre-optimized.

## Milestones

**M1 — Scalable lighting and the road north.** Replace the two hardcoded lamps with a light set the
shader can iterate, or bake static lamp contribution into vertex colour, whichever measures better.
Extend terrain and road to z=140 with flat building pads. Lych-gate and town walls.
*Gate: the churchyard renders unchanged; FPS measured before and after and reported.*

**M2 — Hollowmere.** A parameterised `building()` builder in `geometry.js` so buildings are composed
rather than hand-placed. Populate the town, add colliders, light interiors visible through windows.
*Gate: walk the full road from graveyard to town in a live capture.*

**M3 — The horizon.** Citadel, curtain walls, mountain ridgeline, sky and fog tuned for depth.
*Gate: reviewed clip of the vista from the town gate.*

**M4 — Enemies and a combat loop.** Roaming enemy with aggro, chase, attack, death and respawn.
Player damage, death and resurrect. `src/character/npc.js` is the starting point.

**M5 — Progression and interface.** Experience, levels, health and mana regeneration, nameplates,
experience bar, minimap.

**M6 — Performance.** Spatial chunking, frustum culling and level of detail, activated only if the
M1–M3 measurements show the >120 FPS goal is threatened.

## Parallel harness

A separate track builds a repeatable worktree harness so more than one agent can verify live at the
same time. Today CDP port 9337 is hardcoded in more than twenty scripts and Vite is pinned to 5173
with `strictPort`, so live verification is a single shared resource. The harness gives each worktree
its own Vite port, its own Chrome profile and CDP port, and one command to start and stop them.

## Invariants for every milestone

- The churchyard as approved on 2026-09-19 renders unchanged unless a milestone explicitly revises it.
- Orc and Human character, garment, spell and armory behaviour are untouched.
- Report actual render resolution and frame-time distribution with any FPS claim.
- Automated checks are not visual acceptance. Nothing is marked accepted while the user is away;
  completed work is staged for review.

## Status log

- 2026-09-19: plan created. `main` pushed to origin at `6b7f18e`. Build and both suites green.
- 2026-09-20: **M1 landed** (`74bedf0`, `6bb1844`). Static lamp irradiance is now baked per vertex
  into a `uv2` attribute by `Batch.commit(engine,scene,material,lights)`, so the fragment shader adds
  one flat term regardless of lamp count; the three dynamic spell-light slots are unchanged. The two
  original churchyard lamps are reproduced exactly, and `climb(z)`, the building pads and the road
  paving all evaluate to zero effect for z<=40, so the churchyard is unchanged by construction.
  Terrain and road now reach z=140 with nine exported `buildingPads`, a lych-gate at z=44, and a
  walled gatehouse at z=75. Measured at 960x540 viewport / 720x405 internal, 600 samples:
  144.0 FPS before and after, mean 6.944 ms vs 6.944 ms, p95 7.70 ms both, 33 draws, 9 batches,
  126,512 to 127,772 triangles. Build, 75 character tests and 27 equipment tests pass.
  Captures in `ve-capture/ashen-reach/world-expansion-m1/`.
  **Open defects found in review, carried into M2:** the player cannot reach most of the town
  (`boundsRadius:85` in `main.js` clips a circle at radius 85 while the pads run to z=136);
  ground cover stops around z=84 so the town sits on bare terrain; the 2 m terrain grid reads as
  coarse facets at town scale; and the emissive lantern boxes read as flat acid-green rectangles
  when seen close up rather than as lantern glass.
- 2026-09-20: **parallel harness landed** (`d8ffbeb`, merged to `main`). `ASHEN_VITE_PORT` and
  `ASHEN_CDP_PORT` now sit behind unchanged defaults of 5173/9337; `scripts/lib/cdp.mjs` is the
  single CDP target and `scripts/harness/{up,down}.mjs` bring a numbered slot up and down
  (slot N = Vite 5173+N*100, CDP 9337+N*100; 5173/9337/9222 are refused). Two slots were proven
  running `check-armory.mjs` concurrently, 27/27 each, with the protected ports untouched.
  Note one real behaviour change: `vite.config.js` now pins `server.host` to `127.0.0.1` (it was
  unset and resolving to IPv6-only `::1`), so the dev server is no longer reachable over the LAN.
  The four `capture-m1-*`/`capture-m2-*` scripts were converted to the shared helper afterwards.
- 2026-09-20: **M2 landed** (`e4fce2b`, `817db95`, `d3fda86`, `d7214f4`, `9b85b63`). New
  `src/ashen-reach/buildings.js` exposes a parameterised `building()` plus `windowGlow`,
  `marketStall`, `well`, `forgeGlow` and `crossFinial`; all nine pads are populated with houses,
  tavern, smithy, chapel, watchtower and a well square, each pushing colliders. A separate
  "Hollowmere lantern" material keeps the churchyard's original `Candlelight` batch untouched.
  `geometry.js` gained `terrainNormal()` (analytic normals, zero added triangles) and
  `lanternGlow()` (two-layer warm tube replacing the flat emissive quad).
  All four M1 defects were addressed: `boundsRadius:85` became
  `boundsRect:{minX:-88,maxX:88,minZ:-93,maxZ:143}`, with `player.js` keeping the original
  circular clamp verbatim in an `else` branch so any caller passing only `boundsRadius` is
  byte-identical; ground cover now runs to z~141 and is skipped inside building footprints;
  northern terrain uses smooth normals; lanterns are shaped and warm.
  Verified independently: a real `KeyW` walk reached z=134.79 with y climbing 1.39 to 8.79 (the
  old radius-85 clamp would have stopped it at ~85), build green, 75 character and 27 equipment
  tests pass, and the churchyard pixel diff (0.87% changed) resolves under inspection to
  wind-animated foliage plus one horizon patch of new town geometry beyond z=40 — no churchyard
  geometry moved. Measured at 960x540 viewport / 720x405 internal, 600 samples: 144.02 to 144.00
  FPS, mean 6.944 ms both, p95 7.70 to 8.30 ms, 33 to 34 draws, 9 to 10 batches,
  127,772 to 186,056 triangles. Captures in `ve-capture/ashen-reach/world-expansion-m2/`.
  **Open defects found in review, carried into M2b.** The town is structurally right but does not
  yet read as an inhabited night town:
  1. Ground north of the lych-gate reads as bright daytime green rather than night grass, which
     flattens the whole settlement. The smooth `terrainNormal()` normals are the likely cause —
     they give the northern ground a more uniform, brighter directional term than the flat
     per-face normals it replaced.
  2. The town is overgrown: tall grass and bracken grow right up to the walls and swallow the
     street, so Hollowmere reads as an abandoned meadow with sheds rather than a lived-in town.
  3. The forge glow is a hard-edged flat orange rectangle, the same defect class as M1's
     acid-green boxes and arguably more obvious because it is brighter.
  4. Buildings are near-black masses at any distance; window glow only registers close up, so
     there is no lit-settlement read from the approach or the overlook.
  5. Every building is the same gabled box. The tavern, chapel and houses are not
     distinguishable by silhouette, and there is no signage or upper storey.
- 2026-09-20: **M2b landed** (`e3d099e`, `0e67d67`, `f96db05`). The visual pass on Hollowmere.
  Worth recording: the hypothesis I handed the agent for defect 1 was **wrong**, and it disproved
  it numerically before acting — smooth vs flat `terrainNormal()` normals move the shader's
  `directional` term by <0.02%, nowhere near enough to explain the bright ground. The real driver
  was ground-cover density and colour. Fix is a `nightGrade` shader term gated by
  `smoothstep(40,55,z)`, algebraically zero at z<=40, so the churchyard is unchanged by
  construction. It also ran a control for the pixel diff: two reloads of unmodified code give a
  0.83% noise floor, and two captures 2 s apart give 31.9%, which explains its 5.44% spawn diff as
  wind-phase decorrelation rather than geometry change.
  Defect verdicts: overgrowth **fixed** (graded `clearance(x,z)` replaced the boolean footprint
  test; real paved street and well plaza); forge card **fixed** (shaped ember bed, gradient flame
  licks, anvil); silhouette variety **fixed** (upper storeys, lean-tos, tavern sign, chapel
  steeple, chimneys with smoke); ground palette and distance lighting **improved, not solved**.
  Triangles *fell* 186,056 -> 166,508 because the cover thinning removed more than the detail
  added. 143.99 FPS, 34 draws, p95 8.10 ms.
  **New defect found in my review, not in the agent's self-review:** the `radialGlow` ground
  washes render as dark brown ellipses at the base of every lamp post, reading as craters or mud
  puddles rather than pools of light. Most obvious in the overlook. The agent reported these as
  "glowing lamp pools from range"; the images contradict that.
- 2026-09-20: **M4 landed** (`9a0fcec`, `113e4c5`, merged). Four roaming churchyard grave shades
  on an idle/patrol/chase/attack/death/respawn state machine, plus player health, death and
  resurrect, built by a Grok 4.6 worker in a harness worktree on slot 1 — the first real use of
  the parallel harness, running its own Vite 5273 / CDP 9437 alongside the Sonnet track on
  5173/9337. Reuses the existing target shape, so Tab targeting, Fire Blast, Lava Ball and the HUD
  work unchanged and the dummy stays at 2000 HP. `src/player.js` was not touched.
  Merged only up to `113e4c5`: the worker's two later commits edited a Telegram hook path and
  added a repo-root shim, both outside its allowed paths, and were deliberately left behind.
  Verified by me on the merged tree, live, after integration: 13/13 enemy-loop checks, 8/8
  death/resurrect checks, and the full road still walkable to z=134.79 with hostile enemies
  active. The merge correctly kept M2's `boundsRect` over M4's older `boundsRadius:85`.
  The worker's own FPS numbers were worthless (headless Chrome vsync-capped at 60, so before and
  after both sat on 16.67 ms). Re-measured on real hardware at 960x540 viewport / 720x405
  internal, 600 samples, 4 enemies active: **144.04 FPS**, mean 6.942 ms, p95 8.10 ms, 36 draws,
  166,508 triangles. The >120 FPS gate is met.
  **Open defects carried into M4b:** enemies are blocky hooded scarecrows with square green eyes
  and no walk cycle (partly a scoping error of mine — `npc.js` and `body.js` were not in its
  allowed paths, so it had no route to a skinned character); the player walks through enemies,
  since `player.js` was frozen and colliders are registered only at setup; Lava Ball can miss a
  moving shade for the same reason; and tall grass overlaps the player health bar.
- 2026-09-20: **M3 landed** (`15b1e66`, `a0190c1`, `1796087`). New `src/ashen-reach/horizon.js`
  builds the Citadel of Vaelmark at z=260 — a crag, a crenellated curtain wall, five towers with
  lit windows, and two ridgeline layers — reusing the existing `Distant black stone` and
  `Hollowmere lantern` batches, so it costs **988 triangles and zero extra draw calls**. Backdrop
  only, entirely beyond `boundsRect.maxZ:143`. The agent's first attempt put it at z=185 with a
  76-unit keep that subtended ~90 degrees and read as a black wall filling the sky; it caught that
  itself by looking at its captures and moved the complex back. 143.97-144.01 FPS, 36 draws,
  167,816 triangles. Build, 75/27 tests and the 13 enemy-loop checks all still pass.
  It also diagnosed the M2b ground-wash regression correctly: `radialGlow` built a single-vertex
  triangle fan from a bright centre to a `colorRim` of pure black, and since the material system
  is `texture * vertexColor * (light+emission)` with no alpha blending, almost the entire decal
  interpolated toward black. It replaced the four ground-plane call sites with a `groundGlow()`
  core disc plus a tapering ring.
  **Open defects found in my review, carried into M3b:**
  1. The ground washes are no longer dark, but they are now over-bright hard-edged orange
     polygons that read as spilled lava rather than lamplight — an octagonal silhouette is plainly
     visible around the well and at every lamp. This is the third attempt at this element and the
     decal approach is the problem: with no alpha blending an opaque decal will always have a hard
     edge. The mechanism that already exists is the M1 baked per-vertex lamp irradiance
     (`Batch.commit(engine,scene,material,lights)` -> `uv2`), which lights the ground smoothly with
     no decal at all; its limitation is that the 2 m ground grid is too coarse to resolve a lamp
     pool. Subdividing the ground under the town and deleting the decals is the recommended fix.
  2. The ridgeline reads as a flat dark slab floating above the horizon, with a hard straight
     lower edge and sky visible beneath it. It looks like suspended cardboard, not mountains. The
     agent did not report this.
  3. **M3's own gate is not met.** The plan's gate is "a reviewed clip of the vista from the town
     gate", and the citadel is not visible from the gate at all — only from open sightlines like
     the well square and the overlook. The agent disclosed this honestly.
- 2026-09-20: **M3b landed** (`b356adc`, `595760b`, `baf7fa9`), then **M4b landed and both merged
  into `main`** (`fc75c17`). Their file sets did not overlap and the merge was clean.
  **M3b defect 1 — fixed.** `groundGlow` is deleted. Ground-level lamp pools now come entirely
  from the M1 baked per-vertex lamp irradiance path, applied to a ground mesh subdivided under the
  lamp/gate/well/stall corridors (`CORRIDOR_SUB=4`), with each fixture keeping its original
  ambient light and gaining a separate tightly-falling-off near-ground light. Verified against the
  M2b captures side by side: M2b's hard-edged octagonal craters are gone and the lamp close-ups
  show a genuine soft warm gradient with no silhouette. Cost **167,816 -> 191,846 triangles
  (+24,030, +14.3%)**, draws unchanged at 34. Its first attempt inflated the single ambient light
  and washed the whole town; it caught that with a temporary shader debug visualisation and
  reverted it.
  **M3b defect 2 — fixed.** `ridgeline()`'s base Y went from `groundY-14` to `groundY-320`, a pure
  vertex-Y change costing zero triangles. The ridge now reads as a continuous mass meeting the
  terrain instead of suspended cardboard.
  **M3b defect 3 — NOT fixed.** It changed the gate camera pitch to .25 and called the vista
  found. I opened `town-gate-vista-fixed.png` and the whole 7-frame pan: the citadel is a
  barely-discernible dark sliver with a few window dots above the lintel, not a vista that reads.
  M3's gate remains unmet.
  **M4b landed.** Enemies are now skinned, animated Mixamo humans loaded via the `npc.js`
  `loadGltf` pattern (clips `Walk_Loop`, `Jog_Fwd_Loop`, `Idle_Loop`, `Punch_Cross`, `Death01`),
  with a moving Havok collision proxy the player cannot walk through, reliable spell hits on
  moving targets, and the health plate lifted clear of the grass. `player.js` gained an additive
  `addAnimatedCollider`/`moveAnimatedCollider`/`setAnimatedColliderEnabled` API; enemy bodies are
  Havok STATIC because the character controller is itself kinematic and Havok skips
  kinematic-vs-kinematic contacts. The XZ resolve runs after `integrate` and before the
  `boundsRect` clamp, so bounds still wins.
  **Verified on the merged tree, by me, not from agent reports:** build clean, 75/75 character,
  27/27 equipment, and all 34 live checks green (enemy-loop 13, player-death 8, enemy-collision 7,
  lava-moving 6). Live walk still reaches z=134.74.
  **Merged-tree hardware FPS: 144.04 -> 143.99** (600 samples each), p95 8.1 -> 8.0 ms, draws
  34 -> 42, at 720x405 internal / 960x540 viewport. The >120 FPS gate holds with the citadel, the
  subdivided ground and four skinned shades all active.

  **Measurement-integrity defects found while verifying — these weaken every FPS number above:**
  1. `ASHEN.metrics.summary().triangles` spreads `...world.stats`, built at `scene.js` as
     `B.reduce((a,b)=>a+b.idx.length/3,0)` — the sum over committed procedural batches ONLY. Every
     GLB mesh is excluded by construction: the Orc, the dummy, and all four skinned enemies. It
     reads an identical 191,846 with and without enemies. The field is named `triangles` but means
     "world batch triangles", and M4b's self-reported 137,920 skinned triangles appear nowhere in
     it. `drawCalls` (`engine.drawCallCount`) IS live and correct — 34 -> 42, two per shade.
     Trust `drawCalls`; do not cite `triangles` as total scene cost. Fix is ~5 lines: report a
     live count over `scene.meshes` alongside the batch count.
  2. **144 FPS is this machine's vsync ceiling, not headroom.** `meanMs` 6.9427 is exactly
     1000/144. Every "144 FPS" result in this log, including the ones above, proves only that the
     change did not fall OFF the cap — it cannot quantify remaining budget, and at 720x405
     internal the GPU is lightly loaded. Headless Chrome is capped the same way at 60. To measure
     real headroom the renderer must be run uncapped or at a much higher internal resolution.

  **Open defects carried into M4c / a later lighting pass:**
  1. The shades are bare Mixamo Alpha mannequins — visible ball joints, no clothing, face, hood or
     weapon. Passable at mid range, poor in melee. Disclosed honestly by the agent.
  2. The near shade renders pale teal while the distant one is a muddy olive blob; the two
     instances do not read as the same creature. The agent did not report this.
  3. `Punch_Cross` is a short oneshot, so melee stills almost always land on idle-in-range.
  4. No death still was delivered; required capture #5 was incomplete.
  5. The shades are fully opaque. Unlike world geometry, these are PBR GLB meshes on a separate
     path, so alpha IS available to them.
  6. **New lighting regression from M3b's near-ground lights:** at eye level in fixture-dense
     spots the warm lamp light multiplies against the green ground into a bright yellow-green wash
     — the well square floor and, worse, the lych-gate stone, which now reads lime green rather
     than stone. Wide and overhead shots still read as a proper night town; this is a close-range
     problem.
- 2026-09-20: **M5 landed and merged** (`90a9388`, six commits `c2eaa1d`..`9811834`). Note the
  plan's M5 scope was stale: health regen and nameplates already shipped in M4, so the actual new
  work was XP/levels, mana, the bars and the minimap.
  `src/ashen-reach/progression.js` holds the tuning; XP is awarded on the existing enemy death
  path in `enemies.js`, so there is no second death path. Shade 50 XP, dummy 0, `xpToNext =
  100 * level`, health and mana both `100 + 15/level`, Fire Blast 20 mana, Lava Ball 40, mana
  regen reusing the existing 4/sec-after-6s health pattern. Spells are refused through the
  existing `hud.message` plumbing rather than a new mechanism. The HUD gained LEVEL, a MANA track
  on the player plate and an EXPERIENCE bar, all in the established visual language.
  `src/ashen-reach/minimap.js` is a 168x196 **2D DOM canvas** painted from world XZ on the
  existing `afterAnimation` tick — no second camera, no second render loop, no extra
  `requestAnimationFrame`, and `main.js` was not touched at all.
  **Verified by me on the merged tree:** build clean, 75/75 and 27/27, and **61/61 live checks**
  (enemy-loop 13, player-death 8, enemy-collision 7, lava-moving 6, plus new progression 16 and
  mana 11). Hardware FPS **144.0**, draws **42** — the minimap adds no GPU draws, confirming the
  DOM-canvas claim. p95 moved 8.0 -> 8.4 ms, which is the minimap's per-tick CPU cost showing up
  where the vsync-pinned mean cannot.
  **Open defects (its own, and they are fair):**
  1. The minimap town is a schematic cross of grey blocks, not a street plan — no walls, no well,
     no building types. Legible as road/buildings/enemies, but crude.
  2. Its three terrain bands are near-black and easy to miss.
  3. The floating damage number overlaps the LEVEL UP banner moment.
  4. `level-up.png` is a poor frame (airborne, "Land before casting"); `level-up-live.png` is the
     intended evidence and is genuinely good.
  **Process note:** like M4 before it, this agent drifted toward the Telegram stop-hook and left an
  untracked `telegram-motion-stop.py` in its worktree. It did NOT commit it and correctly sent no
  message. I scanned it (0 token-shaped strings) and deleted it. Two agents have now independently
  wandered to that hook when blocked by frozen paths; briefs should keep naming it out of scope.
