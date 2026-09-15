---
name: blender-lite
description: Blender MCP → GLB → Babylon Lite moonwell iteration. Use when exporting the shrine/hamlet (`npm run export`), exporting the separate hero (`hero.blend` → `hero.glb`), or the user says /blender-lite, /export-glb, moonwell GLB, Dummy, NpcGreeter, or wants a tighter Blender-to-Lite loop. Never wipe the shrine with read_homefile.
---

# Blender → Lite (moonwell)

`lite-moonwell/` is a **Babylon Lite** app (`@babylonjs/lite`, WebGPU, port **5180**). It is not the wow-clone custom-WGSL engine; do not apply the `babylon` skill's "no PBR / no glTF" rules here.

Blender (MCP **9876**) authors the shrine. Lite is the ground-truth renderer.

## Ownership

| Change | Where |
|---|---|
| Mesh, UV, textures, Principled metal/rough/emission | Blender, then `npm run export` |
| Point/sun positions and colors | Blender lights → `public/moonwell-runtime.json` on export |
| Point/sun **intensity** | `src/blender-runtime.js` `LIGHT_INTENSITY` (Blender energy is not 1:1 with Lite) |
| Hemisphere fill, exposure, IBL, shadows, motion | `src/main.js` |
| Area lights | Blender AREA → Lite point at the same glTF position (`liteType: point`) |

Z-up Blender → Y-up glTF is `(x, y, z) → (x, z, -y)`. Export already writes `locationGltf` / `directionGltf`.

## Commands (cwd `lite-moonwell/`)

```bash
npm run export                 # GLB + runtime sidecar + src/glb-meta.js cache-bust
npm run export -- --save-blend
npm run export:safe            # temp-zero transmission, restore after write
npm run save
npm run status
npm run shot                   # .cache/blender-view.png
npm run dev                    # http://localhost:5180
```

Scripts talk to Blender over TCP 9876 (`scripts/blender-mcp.mjs`). If `ECONNREFUSED`, tell the user to click **Connect** on the MCP for Blender panel.

After export, Vite full-reloads on GLB / runtime / `glb-meta.js` changes. Do not wait on a hard refresh unless the plugin is missing (restart `npm run dev` after `vite.config.js` edits).

## Agent loop

1. `npm run status` if Blender connectivity is in doubt.
2. Edit the live Blender scene (MCP `execute_blender_code` / `execute_code`, or the user in the UI). Keep object names stable (`Firefly*`, `WellGlow`, `LanternA_L`, `Aim`, `Dummy`, `DummyYard`, `NpcGreeter`).
3. Confirm the live file is the shrine (`Ground` / `Dummy` present), then `npm run export` from `lite-moonwell`. Never `bpy.ops.wm.read_homefile()` — that wipes the hamlet.
4. Confirm in the **Lite tab**, not only the Blender viewport. EEVEE stills are not the game look.
5. If register/load throws a empty `Error` in `topoSort` / `composePbr`, the GLB likely has `KHR_materials_transmission`. Runtime already deletes `material.subsurface.refraction` before `registerScene`. If that is not enough: `npm run export:safe`.
6. Tune `LIGHT_INTENSITY` when a new light appears or a named light is too hot/dark. Positions come from the sidecar — do not hardcode glTF locations in `main.js`.

## Export contract

`scripts/blender_export.py` (via `export-glb.mjs`):

- object mode, apply mesh rotation+scale
- `pack_all` so textures embed in the GLB
- `export_lights=False`, `export_cameras=False`, `export_yup=True`, `export_image_format=AUTO`
- `export_skins=False`, `export_animations=False` — shrine/hamlet only. Hero skins+clips are a different file.
- write `public/moonwell-runtime.json` (lights, camera from `Camera`+`Aim`, firefly prefix)
- stamp `src/glb-meta.js` `glbUrl` / `runtimeUrl`; **keep** the existing `heroUrl` line
- optional `--strip-transmission` restores Principled sockets after export
- optional `--save-blend` copies to `blender/moonwell.blend` (`save_as_mainfile`, `copy=True`)

## Fidelity order

Textures + UVs, then Lite IBL/shadows, then hero geo, then transmission/volume. Do not add more untextured primitives and call it realism.

Poly Haven in the Blender MCP panel is often **unchecked**; do not wait on `download_polyhaven_asset`. Pull CC0 2K maps into `lite-moonwell/public/tex/<id>/` (`diff.jpg`, `nor.jpg`, `rough.jpg`, `ao.jpg`) and a night HDRI into `public/env/`. `scripts/apply_pbr.py` wires Principled graphs, smart-UV, bevels, and ground displace. Then `npm run export`.

Do **not** port the Babylon.js [SPS Tree Generator](https://doc.babylonjs.com/communityExtensions/treeGenerators/spsTreeGenerator/) into Lite. It is a `@babylonjs/core` community extension on `SolidParticleSystem` + ribbon meshes. Lite has no SPS; `@babylonjs/lite-compat` also excludes classic particle systems.

Blender 5.2 does **not** ship Sapling Tree Gen (it left bundled add-ons). Generate or import trees in Blender, then `npm run export`.

This project plants CC0 Poly Haven photogrammetry trees (`island_tree_01` / `island_tree_02`, leaf-card meshes with alpha) via `scripts/plant_trees.py`:

```bash
npm run trees    # plant + export
```

Never collapse-decimate leaf cards (it turns foliage into shards). Split by material, collapse-decimate bark only, `select_random` + delete faces to thin leaves. After `select_all`, `select_random` will not deselect — start from a deselect. IBL: `loadHdrEnvironment` with `skipGround: true`. Use `registerSceneWithShadowSupport` when the moon directional has a PCF generator.

## Player body (Mixamo)

The **player visual** is Mixamo `lite-moonwell/public/characters/base.glb` (Idle / Walking / WalkingBackwards), loaded by `src/character/body.js`.

- Call `enableBoneControl()` **once in `src/main.js` before** the character `loadGltf`. After load: `container.skeletons[0]`, `getBoneByName`.
- Parent the glTF root to the Havok capsule (`player.body`). Offset Y so feet sit on the ground (`-capsuleHeight/2`). Hide the capsule.
- Drive clips with Lite `playAnimation` / `setAnimationWeight` / `enableAnimationBlending`. Never `scene.beginAnimation` / `ImportMeshAsync` (`@babylonjs/core`). Playground `#92Y727#463` `beginAnimation` maps to `playAnimation` on groups.
- **Never auto-weight a lathe / cloak cone / A_\* mesh as the body.** Do not `npm run export` a shrine hero as the player. Do not open `hero-a.blend` as the body. `public/hero.glb` stays on disk but is not attached.
- Gear is **not** a second skeleton. Sockets (`src/character/sockets.js`) copy Mixamo joint worlds onto helper TransformNodes. Items (`src/character/equipment.js`) parent to those sockets (`head`, `chest`, `mainHand`, `offHand`).

Default loadout: helm on, staff on, skin 1, height 1.0.

## Walkable character

Lite physics is **Havok V2 only** (feature comparison, Scene 40). There is no `moveWithCollisions` mesh API and no FollowCamera.

Feel is the parent wow-clone WoW scheme, reimplemented in Lite — not custom WGSL.

| File | Owns |
|---|---|
| `src/input.js` | Pointer-lock mouselook, WASD/QE, RMB/LMB, jump held, Shift = walk |
| `src/camera-rig.js` | ArcRotate driven by us. `inertia = 0`. No `attachControl`. Pivot glued to the body. Zoom may ease; look/orbit must not. RMB is look, never pan. |
| `src/player.js` | Facing-relative instant wish. Havok `checkSupport` + `setVelocity` + `integrate`. Do **not** use default `calculateMovement` (acceleration 0.05 coasts). |

Numbers (from parent `controller.js` / `camera.js`): walk 2.5, run 7.0, turn 2.55 rad/s, jump 6.6, gravity 20.8. RMB facing closes with `angleDamp(facing, yaw, 9)` — do not snap `facing = yaw` on RMB-down.

Pattern:

1. `HavokPhysics({ locateFile: () => "/HavokPhysics.wasm" })` — wasm lives in `public/`
2. `createHavokWorld(scene, hknp, gravity)`
3. Colliders from **geometry**, not Blender names (glTF export becomes `Cylinder` / `Cube`). Wide thin meshes (`xz ≥ 1.5`, `dy < 0.5`) get `MESH` so a torus AABB does not fill the courtyard. Upright stones get `BOX`. Skip trees / leaf cards (`island_tree*`, `mesh.*`), `FenceWall*` / `FencePost*` / `HamletKerb*` (baked fence sits at local origin). Runtime-only: hidden `WalkSlab` BOX (56×0.4×56 at y=−0.2) is the fall-through net; hidden `HamletRing` BOX posts (48 around r=10.6) are the yard wall — Havok MESH on the character controller walks *on* triangles, so a vertical ring in the GLB does not block. Do not author `WalkSlab` / `HamletRing` in Blender.
4. `createPhysicsCharacterController(world, spawn, { capsuleHeight, capsuleRadius })`
5. Frame: `pollInput` → `rig.applyLook()` → wish from **facing** → `checkSupport` → `setVelocity` → `integrate` → `rig.update`
6. Keep `ArcRotateCamera`; write `alpha`/`beta`/`radius`/`target` from the rig. Convert yaw ↔ alpha with `yawFromAlpha` / `alphaFromYaw` (parent forward is `(sin(yaw),0,cos(yaw))`).

If Havok fails to load, `kinematicStep` uses the same input/facing/jump and clamps to the disc. Do not port wow-clone's custom WGSL controller here.

## Hamlet (starter zone)

The town is already in the live moonwell scene. Do **not** re-run `scripts/build_hamlet.py` unless the user asked to rebuild the town.

Export hamlet the same way as the shrine — whatever Blender has **open**:

```bash
npm run export                 # live scene → public/moonwell.glb + moonwell-runtime.json
```

Before that, `npm run status` and confirm shrine markers (`Ground`, `WellGlow`, `Dummy`, `NpcGreeter`). If `hero.blend` is the live file, `npm run export` overwrites `moonwell.glb` with the mage.

### Names Lite reads

| Blender object | Lite |
|---|---|
| `Dummy` (`Dummy.` / `Dummy_` after glTF split) | Hostile training dummy (`src/dummy.js`). Tab / click target. |
| `DummyYard` | Pad only — not a unit. |
| `NpcGreeter` | Static greeter. Not collected, not hostile. |

Keep those names. Do not rename `Dummy` to `TrainingDummy`. Dummy mesh still gets a BOX collider (it is not in the skip list).

### Colliders (runtime, not Blender)

`src/player.js` adds hidden Havok boxes after the GLB loads:

- `WalkSlab` — 56×0.4×56 BOX at y=−0.2, fall-through net.
- `HamletRing` — 48 BOX posts, radius 10.6, height 1.7. GLB fence (`FenceWall*`, `FencePost*`, `HamletKerb*`) is skipped: baked fence sits at local origin, and a vertical MESH ring does not block the capsule.

Do not author `WalkSlab` / `HamletRing` in Blender. Do not pack them into the GLB.

## Do not smash the shrine

Never `bpy.ops.wm.read_homefile()` (factory startup / “new file”) while iterating moonwell. That replaces the live scene with an empty default; the next `npm run export` writes an empty island over `moonwell.glb`.

- Save first: `npm run save` → `blender/moonwell.blend` (`copy=True`).
- Hero work is a **different file**: `blender/hero.blend`. `build_hero.py` / `rig_hero.py` refuse if shrine markers are present (`MoonSun`, `Ground`, `LanternA_L`, `WellGlow`, `Basin`).
- After hero export, `bpy.ops.wm.open_mainfile` back to `blender/moonwell.blend` so shrine export still works. Do not `read_homefile` as a way to “clear” the mage.
- Do not delete `Ground` / `WellGlow` / `Dummy` as cleanup.

## Hero-a (not the player body)

`blender/hero-a.blend` / `public/hero.glb` is a leftover hooded-mage mesh. It is **not** the player body. Do not attach it in `main.js`. Do not auto-weight a lathe cloak as the character.

Separate from the shrine GLB. Do not pack it into `moonwell.glb`.

| | |
|---|---|
| Look plates | `lite-moonwell/blender/ref/` (`look.png`, `front.jpg`, `side.jpg`, `back.jpg`) |
| Blend | Source of truth: `lite-moonwell/blender/hero-a.blend` (POC A). Older `hero.blend` is the previous M1 mesh. |
| Mesh export | `scripts/export_hero_a.py` → `public/hero.glb` (yup, visible meshes only, stamps `heroUrl` only). Refuses shrine markers. Hide `HeroStudio*` / `HeroLookPlate`. |
| Rig + clips | `scripts/rig_hero.py` still targets the old `Hero*` M1 mesh. Re-skin on `hero-a.blend` before clips return; until then the capsule yaws the mesh with no animation groups. |
| GLB | `public/hero.glb` + `src/glb-meta.js` `heroUrl` |
| Runtime | `src/hero.js` — `loadGltf`, parent to capsule, hide `Player`/`PlayerHead`, staff point light + small ember |

Cloth albedo is grey-blue wool (`public/tex/wool_grey`). Chroma belongs on the staff flame only. Hyper3D is optional blockout; it is often disabled in the Blender MCP panel — do not wait on it.

Known debt (do not “fix” unless asked): cloak crumple vs `look.png`; run skate (`step=0.30` vs 7 m/s).

```bash
# moonwell.blend already saved. Live file must be hero-a.blend (no Ground / Dummy).
#   exec(open("lite-moonwell/scripts/export_hero_a.py").read())
# writes public/hero.glb (mesh), stamps src/glb-meta.js heroUrl only
```

Then `bpy.ops.wm.open_mainfile` back to `blender/moonwell.blend`. Do **not** `read_homefile`. Do **not** `npm run export` until the shrine is live again.
