# Orc v1 and Undead v1 source bodies (M2d)

Asset provenance for the original Orc/Undead source exports, not production-fit or the active Ashen gameplay character. These assets have not been migrated to the source-compatible Ashen Human bind. See [CURRENT.md](CURRENT.md); measurements below apply to these export versions.

## License

MakeHuman **core graphical assets** are CC0 1.0. Application/addon code is AGPL/GPL and is not copied into this repo or the browser runtime. Pinned commit `a8bc2d54ff0ac92e78ff71431b1023eda42bf482`. Extra targets + SHA256 in `scripts/character-assets/provenance-races.json`. Fetch verifies existing and downloaded bytes.

## What shipped

| Race | GLB | Blend | Evidence |
|---|---|---|---|
| Orc | `public/characters/bodies/orc-v1.glb` | `blender/characters/orc-v1.blend` | `ve-capture/m2d-races/orc/` |
| Undead | `public/characters/bodies/undead-v1.glb` | `blender/characters/undead-v1.blend` | `ve-capture/m2d-races/undead/` |

Lineup (Blender, same scale): `ve-capture/m2d-races/authoring-scale-lineup.png`.

Profiles `orc-male-v1` / `undead-male-v1` are `status=production-source`, `productionFit=false`, zero morphs, zero clips.

## Anatomy (Blender meters; named joints)

| | height | shoulder LeftArm.head–RightArm.head | hand L wrist–middle tip | palm L index–pinky MCP |
|---|---|---|---|---|
| Human v1 | 1.748 | 0.376 | 0.205 | 0.073 |
| Orc v1 | 2.10 | 0.457 (×1.21) | 0.278 (×1.36) | 0.099 |
| Undead v1 | 1.66 posed | 0.341 (×0.91) | 0.185 (×0.90) | 0.059 |

Orc: weighted (not 1.0-stacked) maxmuscle/maxweight/maxheight + measure/jaw/brow/ear/hand; then uniform scale 0.995 to 2.10 m with rebuilt rest rig.

Undead: weighted min macros + partial narrow measures + Spine2 rest hunch 16°; then scale 0.993 to 1.66 m posed.

Review shorts: hm08 pelvis/thigh weights, not a Human-sized Z box. Diagnostic only.

Skin 4-influence vs full: Orc max 4.90 cm raised-arm shoulder/arm (v1380); Undead 3.71 cm same verts. Global p95≈0 is not a deformation pass.

## Limits

Clay albedo, closed lids, no hair. Shorts still show small inner-thigh hem steps. Not AAA. No licensed orc/undead sculpt.

## Regenerate

```sh
python3 scripts/character-assets/fetch-makehuman.py --verify-only
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/character-assets/build_orc_v1.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/character-assets/build_undead_v1.py
node scripts/validate-character-body.mjs public/characters/bodies/orc-v1.glb --profile orc-male-v1 --out ve-capture/m2d-races/orc/validation.json
node scripts/validate-character-body.mjs public/characters/bodies/undead-v1.glb --profile undead-male-v1 --out ve-capture/m2d-races/undead/validation.json
```

Isolated Blender. Do not `npm run export`. Do not open the shrine.
