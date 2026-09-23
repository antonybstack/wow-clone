---
name: create-new-game-asset
description: >
  Turn a Tripo 3D (studio.tripo3d.ai) generate-and-rig into a playable Ashen Reach
  body on the 65-joint Mixamo source bind. Use when the user generates a character
  in Tripo, asks how to export FBX/GLB/Mixamo, drops a Tripo zip/glb, or runs
  /create-new-game-asset.
---

# Create a new game asset from Tripo

Playable characters in this repo are **not** Tripo's own animations. Tripo supplies mesh, UVs, maps, and a Mixamo-named skin. Clips and the 65-joint hierarchy come from `public/characters/base.glb`. Runtime and bind rules live in [blender-lite](../../../.agents/skills/blender-lite/SKILL.md) and [character authoring](../../../.agents/skills/blender-lite/references/character-authoring.md). The Orc path is [orc sculpt pipeline](../../../docs/orc-sculpt-pipeline.md). Follow [dream-loop](../../../.agents/skills/dream-loop/SKILL.md) for visual delivery.

Worked example: Undead (`blender/characters/sources/undead-tripo/`, `scripts/character-assets/undead_from_tripo.py`, `bind-source-undead.mjs`, `prepare-undead-equipment.mjs`). Copy and rename those scripts for a new race; do not special-case only Undead.

## 1. In Tripo (studio.tripo3d.ai)

1. Import a **turnaround or concept still** (front/side/back if you have it).
2. Generate the mesh, then open **Rig**.
3. **Humanoid**, skeleton preset **Mixamo**, **Export Skeleton** on.
4. T-pose or A-pose in the viewport is fine; Mixamo rest in this repo is T-pose and is converted here.
5. Do **not** Send To Mixamo / Animate. Do not export Tripo clips.

## 2. Export

Download **both**:

| File | Role |
| --- | --- |
| **FBX, target Mixamo** | Authoritative: `mixamorig:*` bones and vertex groups |
| **GLB** of the same job | Mesh + maps for a quick look |

Also grab albedo / normal / roughness / metallic if they sit next to the FBX (`.fbm` folder inside the zip).

Skip USD, OBJ, STL, 3MF, and 3ds Max as the bind source.

## 3. Drop into the repo

```
blender/characters/sources/<id>/
  <id>.fbx
  <id>.glb
  textures/          # from the .fbm
  provenance.json    # job URL, prompt image, inspect notes
```

Gitignore the FBX/GLB/textures the same way as `undead-tripo` / `orc-print` (large binaries). Keep `provenance.json` tracked. Leave 2D concept sheets under `docs/references/`.

## 4. Inspect before binding

Open the **FBX** in isolated Blender 5.2.1 (`/Applications/Blender.app/Contents/MacOS/Blender --background`). Confirm:

- Armature ~**65** `mixamorig:*` bones, scale often **0.01** (Mixamo cm).
- Mesh vertex groups used **> 0**, verts without groups **= 0**.
- Height after applying the 0.01 root is often ~1 m; scale to the race target on rest export (Undead used **1.85 m**).

Inspect the **GLB** with glTF-Transform. If `JOINTS_0` is **100% joint 0 (Hips)** while names still say Mixamo, the GLB skin is dummy. **Bind from the FBX.** Leaf bones (`HeadTop_End`, `*4` finger tips, `Toe_End`) unused by weights is normal Mixamo.

## 5. Rest pose in isolated Blender

Not MCP 9876. Pattern: `scripts/character-assets/undead_from_tripo.py`.

1. Import FBX (`use_anim=False`, `use_image_search=False`).
2. Apply armature object scale.
3. If arms hang (A-pose), lift them to Mixamo T-pose. Aiming with `rotation_difference` can spin one arm the long way and stretch a wing. For the Undead FBX, **pose-bone Euler X +60° / −60°** (LeftArm / RightArm) put the bones on world ±X.
4. Bake **evaluated** mesh verts to that pose, remove the Armature modifier, `pose.armature_apply`, re-add the modifier. Applying the modifier and then `armature_apply` double-transforms.
5. Uniform-scale the armature to target height; apply scale.
6. Assign PBR from `textures/`. Scale maps to **1024** before GLB export so the rest file stays under the Cloudflare Pages **25 MB** file cap (raw 2k PNGs packed a 40 MB rest GLB).
7. Write joints JSON: world head of every `mixamorig:*` bone, Blender Z-up → glTF Y-up `(x, z, -y)`. Must be **65** names.
8. Export rest GLB (Y-up, skins on, no animation) to `.cache/source-motion/<id>-source-rest.glb`.

## 6. Bind clips

Pattern: `scripts/character-assets/bind-source-undead.mjs` / `bind-source-orc.mjs`.

- Read `public/characters/base.glb` with **MeshoptDecoder and MeshoptEncoder** registered. Encoder is required on write or `encodeGltfBuffer` throws.
- Fit joint **translations** from the joints JSON (metres → stored cm); keep base **rotation** frames (T-pose).
- Recompute inverse binds. Shift every Hips translation key by the rest offset.
- Attach the rest meshes (body, extras such as eyes). Drop the mannequin.
- Copy the runtime-only clips base.glb lacks so the pack has **55** clips / **65** joints.
- Write `public/characters/candidates/<id>-source-v1.glb` + provenance.

## 7. Equipment pack and clothes

- `prepare-*-equipment.mjs`: candidate → `public/ashen-reach/equipment-<race>/body.glb` + manifest with that race's fit id (`ashen-undead`, `ashen-orc`, …).
- Catalogue coverage names must exist on the body, or change `*_BASE_VISIBLE_MESHES` and `RACE_BODY_ALIASES` together. A single `*V1Body` mesh that stays visible under cloth is valid for a skeleton.
- **Do not copy unfitted Human garment GLBs into the pack.** They bind at Human rest and draw as a giant ghost in world space. Fit first:

  `node scripts/ashen-reach/fit-orc-garments.mjs --target=<race> --report`

  (`--target=undead` already switches body path and mesh name). Then pack the files under `.cache/armory-assets/<race>/`.
- Until clothes are fitted, boot that race with an empty (or race-specific) loadout, not the Human Wayfarer default.

## 8. Wire the game

- Pack table in `src/ashen-reach/main.js` (`bodyUrl`, `manifestUrl`, `fitId`, `baseMeshes`).
- Armory race option. `switchRace` must load this pack; `?preloadedEquipment` cannot fake it.
- Visibility alias in `equipment-stream.js` for every playable race.
- Fit contract in `equipment-contract.js` if this is a new race.

## 9. Verify

1. `body-preview.html`: load the candidate, Idle / Walk / Sprint, front and side. Confirm T-pose rest is not A-pose with exploding arms.
2. `ashen-reach.html?play&clean`: Armory → the new race. Walk, sprint, both spells.
3. Close-ups of the face if you added extra meshes (eyes must sit in orbits, not a jaw centroid).
4. Reviewed live GIF/MP4 via `tg file`, with a VE `video/mp4` URL in the caption. The clip must show the thing you just changed.
