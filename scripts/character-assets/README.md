# Character asset pipeline

Playable **Orc** is the print-sculpt collapse (not MakeHuman, not voxel remesh). See [orc sculpt pipeline](../../docs/orc-sculpt-pipeline.md).

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background \
    --python scripts/character-assets/inspect-orc-sculpt.py
/Applications/Blender.app/Contents/MacOS/Blender --background \
    --python scripts/character-assets/orc_from_sculpt.py
node scripts/character-assets/bind-source-orc.mjs
node scripts/ashen-reach/prepare-orc-equipment.mjs
```

`--recook` is paint-only and must keep the HP normal map. Do not voxel the print face.

Human v1 source-asset pipeline (provenance, not the active Ashen character): MakeHuman CC0 → isolated Blender background → `public/characters/bodies/human-v1.glb`. See [current direction](../../docs/CURRENT.md) and the source-compatible `scripts/ashen-reach/prepare-wanderer.mjs` derivation for gameplay.

Does **not** talk to MCP 9876, any interactive Blender scene, or a removed legacy export command.

## License

MakeHuman / MPFB **core graphical assets** are CC0. Application/addon **source code** is AGPL/GPL and is **not** copied here or into the browser runtime.

See `provenance.json` for pinned commit, URLs, and SHA256.

## Regenerate

```sh
cd /Users/antbly/dev/wow-clone
python3 scripts/character-assets/fetch-makehuman.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/character-assets/build_human_v1.py
node scripts/validate-character-body.mjs public/characters/bodies/human-v1.glb --out ve-capture/m2b-human/validation.json
```

Authoring stills land in `ve-capture/m2b-human/` (Blender EEVEE/Workbench, **not** game screenshots).

Labs Orc/Undead bodies (MakeHuman CC0, **not** the playable Ashen Orc):

```sh
python3 scripts/character-assets/fetch-makehuman.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/character-assets/build_orc_v1.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/character-assets/build_undead_v1.py
node scripts/validate-character-body.mjs public/characters/bodies/orc-v1.glb --profile orc-male-v1 --out ve-capture/m2d-races/orc/validation.json
node scripts/validate-character-body.mjs public/characters/bodies/undead-v1.glb --profile undead-male-v1 --out ve-capture/m2d-races/undead/validation.json
```
