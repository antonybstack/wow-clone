# Explorable Gothic world — 2026-09-25

## Direction and supplied references

The user rejects invisible boundaries, distant primitive trees and castles that are only scenery. Visible landmarks should become destinations with continuous approaches and interiors. The four supplied images establish: (1) the current blocked meadow, (2) a monumental cliff cathedral and elevated bridge, (3) a deep fortified entrance with readable human scale, (4) a dark arch framing Gothic spires. These are visual references, not assets to extract or redistribute.

Original attachments: `/var/folders/l5/6pks4y5j1kz2mt4fw5gxxz380000gn/T/codex-clipboard-{pcL5aR,QwR7OK,ULT8x3,L2puYw}.png`. Preserve copies under `ve-capture/ashen-reach/gothic-world/references/` before implementation.

## Audit

- `main.js` clamps the player to x −88…88 / z −93…143. Removing this alone is unsafe: only the near terrain is registered with Havok.
- `scene.js` builds a much larger far terrain, but it is visual only and coarse near the castle. Distant trees are cones and coarse crowns in the bark batch.
- `horizon.js` builds solid tower and wall boxes on closed rock platforms, without connected access or usable interiors. These require replacement, not just additional ornament.
- Player movement already supports Havok mesh contacts, slopes and elevated surfaces. Keep that system and verify real input across every new threshold.

## Research and asset policy

[Babylon SPS tree documentation](https://doc.babylonjs.com/communityExtensions/treeGenerators/spsTreeGenerator/) describes Classic Babylon SolidParticleSystem construction. Its [source](https://github.com/BabylonJS/Extensions/blob/master/TreeGenerators/SPSTreeGenerator/TreeGenerator.js) depends on BABYLON objects; it cannot be imported directly into Lite. A translated algorithm or exported mesh is required.

[EZ-Tree](https://github.com/dgreenheck/ez-tree) is MIT licensed and supports GLB export. Prefer generating a small authored library offline, with matching reduced-detail meshes, instead of adding Three.js to the game runtime. Candidate species: sparse ash, dead oak, wind-shaped conifer. Retain branch structure at distance, use consistent silhouettes and trunk colliders. Audit texture licenses separately before shipping.

[Poly Haven Modular Fort 01](https://polyhaven.com/a/modular_fort_01) is a candidate masonry kit; [Tree Small 02](https://polyhaven.com/a/tree_small_02) is already present locally. Poly Haven models can be reused under its [CC0 asset license](https://polyhaven.com/license). Fort modules alone do not provide the tall Gothic architecture in the reference. Use an original architectural layout with modular pointed arches, piers, buttresses, tracery, steep roofs and a bell tower; reuse licensed stone and wood materials already present.

## Sequential milestones

1. **V23 — traversable basin and first cathedral destination.** Replace the rectangular clamp with real terrain collision across the rendered basin. Build a continuous approach from Hollowmere, a bridge/gate threshold, courtyard and enterable Vaelmark nave. Replace the hero castle's solid mass with architectural structure at human scale. Tests must cross the former boundary, reach the entrance and walk into/out of the nave without flight or teleporting between thresholds. Side landmarks and the finite terrain edge remain explicit follow-up work until physically implemented.
2. **V24 — convincing woodland.** Audition licensed/generated ash and conifer variants in the live meadow; replace primitive crowns, add trunk collision, distance management and matching silhouettes. Preserve sightline openings and benchmark the forest independently.
3. **V25 — connected landmark network.** Convert side keeps and churches into accessible destinations with routes, doors, interiors and real collision. Add natural, readable limits wherever the finite world ends; no silent position clamps. Verify every mapped destination with a route test.
4. **V26 — architectural depth and exploration.** Add walkable galleries, stairs, ramparts, chapels, side chambers and environmental storytelling. Match the reference's recessed doors, layered buttresses and arch-framed vistas through live near/interior/approach review. Add interior occlusion/lighting only where the new structure demonstrates a need.

Implement and review one playable slice at a time. Do not call an entire Elden Ring-scale environment finished after a blockout. Preserve Havok, source animation, touch controls, shadow/fog compatibility and the four-frame submission limit. Target >120 FPS under stated conditions, record motion separately, publish reviewed MP4 to Telegram, and commit/push completed work. Production deployment is not part of this request.

## First implementation and retrospective

V23 is the first playable destination. V24 has its initial tree library integrated; distance-based tree LOD and further species/art refinement remain follow-up work.

- Removed the player rectangle and default circular clamp. Registered the outer terrain as Havok mesh collision, with a denser 4 m grid around the basin. Actual wall and trunk collision remain.
- Replaced the old solid central castle with original Vaelmark architecture: a 125 m sloping bridge, courtyard, recessed portal, asymmetric bell towers, buttresses, clerestory openings, a 50 m nave, ribs, altar and pointed traceried end window. Highest spire is 56 m above the terrace. Dedicated collision geometry has 8,516 triangles; visible architecture has 35,318.
- Preserved the supplied references locally before work. Used their scale, layered entrances and tall masonry as design direction; no Elden Ring assets were extracted.
- Audited local tree assets before reuse: tree_small_02 has about 2.06 million triangles and island_tree_01 about 1.6 million. Neither is suitable for scattering unchanged. Generated three deterministic branch-only ash/oak variants with MIT EZ-Tree, 1,240 triangles each, appended to the existing bark batch. The offline generator and Three.js are development dependencies; neither is imported by game runtime. License and generator provenance ship with the geometry.
- The npm 1.1.0 generator differs from current GitHub examples: its newer createGeometry/LOD API is absent. Used the installed package's supported branch sections/segments options instead. Verify installed APIs before implementing against current documentation.
- First interior review showed a blank altar wall; replaced it with a real recessed opening and stone tracery. Continuous motion then exposed the old fixed sky dome clipping behind the camera at the cathedral. Centered the dome on the active camera and sized it within that camera's far plane; added a runtime assertion. This defect was not visible from the original corridor.

### Verification

- 139 unit tests pass, including finite/indexed tree geometry, outward cathedral winding, continuous bridge floor, open doorways, real window voids and solid masonry/roof collision.
- check-exploration.mjs --baseline reproduced the old north clamp. The final real keyboard route crosses z=143, reaches z>344 in the nave and returns to z<298 in the courtyard. Havok stays active, recovery count stays unchanged, runtime/GPU errors are empty. Only initial placement and camera review angles are scripted; movement across thresholds uses input.
- check-basin-boundaries.mjs crosses the old west, east and south limits (approximately x=-102.55, x=102.49 and z=-98.77), then confirms the nave wall stops real movement at x=10.95. Q/E are the game's strafe keys; A/D without RMB turn the character.
- Mobile viewport/native touch with injected iPhone depth-bundle failure passes (36.97 m travel, rendered-image change). Desktop WebKit passes (19.05 m travel). Neither is a physical iPhone performance measurement.
- Reviewed the recorded approach/interior/return through extracted frames, including correction of the sky gap. [Live traversal MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/gothic-world/2026-09-25-cathedral-traversal.mp4), Telegram **761**. Verified HTTP 200/video MP4 and range support before delivery.

### Performance

Separate uncapped Chrome 153 WebGPU runs on M1 Max, 1280×720 internal resolution, DPR 1, seven enemies, 12 seconds of actual rendered intervals per route. No recording, build or second active game during measurement.

| Route | Actual intervals | FPS | Mean | p99 | Worst | Frames over 16.67 ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Town, starting z=80 | 2,177 | 181.32 | 5.52 ms | 12.20 ms | 20.60 ms | 3 |
| Cathedral, starting z=265 | 2,428 | 202.33 | 4.94 ms | 10.70 ms | 11.50 ms | 0 |

Both exceed the 120 FPS target, but town is slower than V22's 252.34 FPS. Total procedural geometry is about 1.07 million triangles; visible scene geometry in town about 1.38 million. The new trees remain in a static shared bark batch, so spatial culling and matching lower-detail variants are the next performance work. Do not describe frame pacing as unchanged or zero-spike.

### Remaining scope

The old side keeps and outer mountain shells are still scenery, with no matching collision on those shells. Wider exploration can expose their backs/intersections: V25 must replace those silhouettes with real traversable landforms. The basin terrain is finite; its outer edge also needs authored, readable treatment. The cathedral has an enterable nave and tower bases, but upper towers, stairs, galleries, ramparts and side chapels are V26. The first foundation still reads as a broad retaining wall; an irregular cliff base, stone detail, furnishing, occlusion and landmark-specific lighting need further visual passes. Do not describe all visible buildings or the entire world as finished or enterable. Production remains unchanged.

## Release and follow-through — 2026-09-25

The implementation request now authorizes deployment and sequential completion of V24–V26. V23 `c67765b` is released as Pages `ac99e4c7`; previous production is `8585b672`. Release assets (330), cathedral entry/exit, WebKit and exact-bundle mobile fallback pass. The first mobile loading timeout triggered a rollback, followed by two isolated passes and a verified restoration; its cause remains unconfirmed. See CURRENT.md for identifiers, measurement limits and evidence location.

V24 must preserve the seeded full tree variants and collisions, derive reduced meshes from their existing branches, use 128 m tiles and 100/140 m hysteresis, and measure town/bridge/cathedral/forest separately. V25 retains the finite terrain footprint, replaces decorative mountain shells with matching surface/collision, connects all existing keeps/towers/chapel through routes at least 4 m wide and sustained grade at most 20 degrees, and adds a physical visible perimeter and landmark registry. V26 adds the irregular cathedral cliff foundation, two chapels, gallery, tower stairs and exterior parapet with collision, headroom, railings and reference-led architectural detail. These are remaining work, not completed features.
