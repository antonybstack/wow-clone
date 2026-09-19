# Orc character pipeline

Updated 2026-09-19. This is how the playable Orc is made. Do not warp a MakeHuman body with ellipsoid muscle tables. Do not voxel-remesh the print face.

## Visual sources

| Role | Source | License |
| --- | --- | --- |
| **Form** | Original FBX `blender/characters/sources/orc-print/Orc_22.fbx` — Sketchfab [Male Orc for Print](https://sketchfab.com/3d-models/male-orc-for-print-2362b5e5d94f4303a06faa17d1e7e611) by **Crayon** | **CC-BY 4.0** |
| **Look (palette / scene)** | Sword Hero night-churchyard stills; peat-olive not lime | User reference |
| **Look (heroic green concept)** | `.agents/skills/blender-lite/references/orc-concept-art.png` | Form only — not churchyard albedo |

The Sketchfab GLB is a stacked-copy soup. Use the FBX. Join **legs (`腳掌3`) + torso (`orc_11_copy4`)** as the body; loincloth is `Orc_22`; tusks/teeth are separate shells. Print eyelids stay on the body — do not remesh `orc_9_copy1` into forehead blobs or park dummy spheres on the brow. Never ship the high-poly file; keep it as a bake cage.

## What worked (2026-09-19 print-head pass)

Live VE of hooded slits vs gold marbles is the proof. Keep this sequence:

1. **Dream Loop stays.** Inspect the live churchyard, change one consequential defect, play, capture, correct. Parent implements. Nested DeepSeek vision is a comparative spot check, not a score loop. Generic “3k-tri AI remesh / Classic AssetContainer / shared-skeleton MMO” notes are not this character.
2. **Form and paint are different jobs.** Recooking peat-olive cannot restore eyelids a voxel remesh already deleted. If the face is a blob, rebuild topology from the FBX; do not `--recook`.
3. **Collapse the print mesh. Do not voxel it.** Split the head at ~80% height, `Decimate COLLAPSE` the print head (~12k tris) and the remaining body (~16k). Voxel remesh at 7 mm erases slits; voxel after a head split shreds the open neck; `mesh.fill()` on the loincloth becomes a cone.
4. **Keep the high poly as a bake cage.** Shrinkwrap, smart-UV, Cycles selected-to-active **tangent normal + AO**, then delete HP. Multiply AO into albedo. Export tangents. `bind-source-orc.mjs` already copies `normalTexture`.
5. **Do not recook on bind.** `bind_retopo` must keep the retopo albedo/normal. `--recook` is paint-only and must preserve the normal map if it runs later.
6. **Eyes.** `OrcV1Eyes` is a 3 mm placeholder inside the skull so the five mesh names exist. The sculpted lids *are* the eyes. Print `orc_9_copy1` remeshes into forehead blobs — skip it.
7. **Contracts unchanged.** Isolated Blender 5.2.1 LTS (not MCP 9876), 65 `mixamorig:*` joints, 55 clips, heat weights, pelvis-only loincloth, Lite `loadGltf`, live `ashen-reach.html` as visual authority. Telegram + VE (`video/mp4`) for reviewed evidence.
8. **Palette.** Churchyard hemi/moon already add green. Albedo stays ashen peat-olive. Lime SKIN `(0.16, 0.33, 0.12)` is retired.

## Game contracts

- `@babylonjs/lite` + WebGPU, `loadGltf` of a self-contained GLB
- 65-joint `mixamorig:*` source bind, 55 clips from `base.glb`
- Meshes: `OrcV1Body`, `OrcV1Brows`, `OrcV1Eyes`, `OrcV1Hair`, `OrcV1Shorts`
- Height 2.10 m
- Isolated Blender 5.2.1 LTS, not MCP 9876
- Catalogue clothes do not fit this topology yet; the pack is body-only plus factory hand props

## Commands

```sh
# inspect the print FBX vs the current bind
/Applications/Blender.app/Contents/MacOS/Blender --background \
    --python scripts/character-assets/inspect-orc-sculpt.py

# retopo + Mixamo T-pose + pelvis-only loincloth weights
/Applications/Blender.app/Contents/MacOS/Blender --background \
    --python scripts/character-assets/orc_from_sculpt.py

# repaint gothic albedo + rebuild eyes on the existing T-pose rest
/Applications/Blender.app/Contents/MacOS/Blender --background \
    --python scripts/character-assets/orc_from_sculpt.py -- --recook

# assemble clips, then the playable pack
node scripts/character-assets/bind-source-orc.mjs
node scripts/ashen-reach/prepare-orc-equipment.mjs

node scripts/test-source-motion.mjs
node scripts/ashen-reach/check-orc-equipment.mjs
```

`--from-retopo` skips the high-poly remesh (T-pose + skin only). `--recook` repaints albedo on the existing T-pose rest and must not strip the HP normal map. `--no-tpose` keeps the print's hanging arms (do not ship). Defaults: body collapse `--target-faces 16000`, head `--head-faces 12000`. Voxel flags are leftover; do not voxel the print face.

Skin is packed cavity albedo × AO, plus a tangent normal map from the high poly. Lite ignores COLOR_0. Bind after a form rebuild must **not** recook. Do not use 1.5–3k tri AI remesh, MakeHuman ellipsoid warps, or dummy brow eyeballs.

## Runtime

Armory Race **Orc** swaps `public/ashen-reach/equipment-orc/body.glb`. Human stays parked. Closing the armory must keep the Orc in the churchyard camera (`body.hideParked`).

Credit if this surface ships: This work is based on "Male Orc for Print" by Crayon (https://sketchfab.com/miao850520) licensed under CC-BY-4.0.
