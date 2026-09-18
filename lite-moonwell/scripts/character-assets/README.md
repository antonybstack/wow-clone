# Character asset pipeline (Human v1)

Source-asset pipeline: MakeHuman CC0 → isolated Blender background → `public/characters/bodies/human-v1.glb`. These original race exports are provenance inputs, not the active Ashen character. See [current direction](../../docs/CURRENT.md) and the source-compatible `scripts/ashen-reach/prepare-wanderer.mjs` derivation for gameplay.

Does **not** talk to MCP 9876, any interactive Blender scene, or a removed legacy export command.

## License

MakeHuman / MPFB **core graphical assets** are CC0. Application/addon **source code** is AGPL/GPL and is **not** copied here or into the browser runtime.

See `provenance.json` for pinned commit, URLs, and SHA256.

## Regenerate

```sh
cd lite-moonwell
python3 scripts/character-assets/fetch-makehuman.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/character-assets/build_human_v1.py
node scripts/validate-character-body.mjs public/characters/bodies/human-v1.glb --out ve-capture/m2b-human/validation.json
```

Authoring stills land in `ve-capture/m2b-human/` (Blender EEVEE/Workbench, **not** game screenshots).

Orc/Undead (same CC0 pipeline, extra macros in `provenance-races.json`):

```sh
python3 scripts/character-assets/fetch-makehuman.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/character-assets/build_orc_v1.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/character-assets/build_undead_v1.py
node scripts/validate-character-body.mjs public/characters/bodies/orc-v1.glb --profile orc-male-v1 --out ve-capture/m2d-races/orc/validation.json
node scripts/validate-character-body.mjs public/characters/bodies/undead-v1.glb --profile undead-male-v1 --out ve-capture/m2d-races/undead/validation.json
```
