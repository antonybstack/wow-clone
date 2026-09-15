# Character — Lite VE

Player body is Mixamo `public/characters/base.glb`. Not procedural `hero-a` / `public/hero.glb`. One skeleton + sockets + items.

## Lite docs

- https://doc.babylonjs.com/lite/architecture/13-skeleton/
  - `enableBoneControl()` before `loadGltf`
  - After load: `container.skeletons[0]`, `getBoneByName`
  - `setBoneVisible`, `setBoneScaling` (Mixamo clips bake scale; scaling overrides are ignored while Idle/Walking play)
- https://doc.babylonjs.com/lite/architecture/07-animation/
  - `animationGroups`, `playAnimation`, `setAnimationWeight`, `enableAnimationBlending`
  - `group.loopAnimation`
  - Never `scene.beginAnimation` / `ImportMeshAsync` (core)

## Playground / sample mapping

- https://playground.babylonjs.com/#92Y727#463
  - Core `beginAnimation` → Lite `playAnimation` on animation groups
- `~/dev/ThirdPersonTemplate/src/ts/character.ts`
  - `:49` `SceneLoader.ImportMeshAsync` → Lite `loadGltf`
  - `:69-76` capsule parent, `model.position.y = -1` on a 2 m capsule → Lite `setParent` + `y = -capsuleHeight/2`
  - `:80-88` Idle.weight = 1, Walking.weight = 0 → Lite `setAnimationWeight`
  - `:182-194` `moveTowards` blend, `play(true)` when weight > 0, pause when 0 → Lite `playAnimation` / `stopAnimation` + `enableAnimationBlending`

## Runtime

| Piece | File |
| --- | --- |
| Bone opt-in | `src/main.js` `enableBoneControl()` then `attachBody` |
| Skinned body | `src/character/body.js` |
| WASD clip blend | `body.update` ← `onBeforeRender` |
| Joint sockets | `src/character/sockets.js` matrix-copy (joints are `excludedNodeIndices`; `setParent` to the bone SceneNode stays at rest) |
| Item catalog | `src/character/catalog.js` `{ id, slot, bone, glb, local }` |
| Items | `src/character/equipment.js` — Lite `loadGltf` + `addToScene` + `setParent` onto a socket (https://doc.babylonjs.com/lite/architecture/13-skeleton/ ). Not a second skeleton. 404/fail → `build*` primitive (`createRibbon` fallback only). |
| Look | `src/character/appearance.js` height / skin; `?h=1.1&skin=1` |

Default spawn: cowl, back cape, torso robe, staff on Mixamo RightHand. `mainHand` follow is **grip** (palm + wrist rotation). Item aim is `catalog.local`, not a world-up lamp-post.

GLB (`public/characters/items/`): `staff.glb`, `cowl.glb`, `cape.glb`, `robe.glb`, `sleeve.glb`, `sleeve-fore.glb`, `boot.glb`. Primitive fallback only on 404. Robe hides Mixamo `UpLeg` bones so dummy legs are not the silhouette; cape stays the back slot.

W is **sprint** (`Sprint_Loop` ~7 m/s). Shift+W is **walk** (`Walk_Loop` ~2.5 m/s).

`base.glb` has **no** `WalkingBackwards` and **no** `Strafe_*` clips. S and Q/E play slowed `Walk_Loop` — they do **not** fake `Sprint_Loop`. HUD stance prints the live clip name. `Spell_Simple_*` is additive + upper-body mask (Lite `setAnimationAdditive` + `createAnimationGroupMask`) so legs keep locomoting.

Height `[` `]` scales the visual **and** the Havok capsule (`setShapeOptions`, preserve foot). Skin `P` tints `Alpha_Surface` only. Weight is a no-op (Mixamo bakes scale).

Greeter is a second Mixamo Idle instance (`src/character/npc.js`). `?crowd=8` spawns eight more (each `loadGltf` — Lite does not share animation groups across containers). Measured ~33 FPS with 8 crowd + player + greeter in DevTools Chrome — not a 60 FPS pass.

Plate look is Mixamo dummy + item GLBs on sockets, not `poc-a-plate.jpg`.

## Public stills

`npm run ve -- ve-capture/<file>.png <name>.png` → https://ve.sparkify.dev/wow-clone/<name>.png

Lead-reviewed (2026-09-14):

| | |
| --- | --- |
| Walk GIF | https://ve.sparkify.dev/wow-clone/l4-walk-v2.gif |
| Sprint GIF | https://ve.sparkify.dev/wow-clone/l4-sprint-v2.gif |
| Jump GIF | https://ve.sparkify.dev/wow-clone/l4-jump-v2.gif |
| Walk labeled | https://ve.sparkify.dev/wow-clone/l4-walk-label.png |
| Sprint labeled | https://ve.sparkify.dev/wow-clone/l4-sprint-label.png |
| Jump labeled | https://ve.sparkify.dev/wow-clone/l4-jump-label.png |
| Height 1.15 / skin 3 | https://ve.sparkify.dev/wow-clone/l5-tall.png |
| Height 0.90 / skin 0 | https://ve.sparkify.dev/wow-clone/l5-short.png |
| Paper-doll | https://ve.sparkify.dev/wow-clone/l6-paper.png |
| Helm off | https://ve.sparkify.dev/wow-clone/l6-helmoff.png |
| Crowd `?crowd=8` | https://ve.sparkify.dev/wow-clone/l8-crowd.png |
| Robe silhouette (rear) | https://ve.sparkify.dev/wow-clone/l3-robe.png |
| Clothes front (void cowl) | https://ve.sparkify.dev/wow-clone/clothes-front.png |
| Clothes 3/4 | https://ve.sparkify.dev/wow-clone/clothes-34.png |
| Clothes sprint | https://ve.sparkify.dev/wow-clone/clothes-sprint.png |
| Polish front | https://ve.sparkify.dev/wow-clone/clothes-p-front.png |
| Polish 3/4 | https://ve.sparkify.dev/wow-clone/clothes-p-34.png |
| Polish sprint | https://ve.sparkify.dev/wow-clone/clothes-p-sprint.png |
| L9 mage rest (`Spell_Simple_Idle_Loop`) | https://ve.sparkify.dev/wow-clone/l9-rest.png |
| L9 Emberstaff + Ash Cowl | https://ve.sparkify.dev/wow-clone/l9-ember.png |
| Sleeve-fit idle | https://ve.sparkify.dev/wow-clone/sleeve-fit-idle.png |
| Sleeve-fit 3/4 | https://ve.sparkify.dev/wow-clone/sleeve-fit-34.png |
| Sleeve-fit sprint | https://ve.sparkify.dev/wow-clone/sleeve-fit-sprint.png |

Ruins start look plate: `blender/ref/ruins-start.jpg`. Blockout: `scripts/build_ruins_start.py` (collection `RuinsStart`). Hamlet cottages still in the yard.

Older N1–N4 / G1–G5 URLs may show a **world-up lamp-post staff** and a nude dummy. Do not treat those as “staff in palm.”
