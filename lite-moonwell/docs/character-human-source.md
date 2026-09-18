# Human v1 source body (M2b)

Asset provenance for the original authored Human source/export. This source is not production art approval or the active gameplay default. Ashen Reach uses the later source-compatible Human described in [CURRENT.md](CURRENT.md) and [source recovery](source-motion-recovery-implementation-2026-09-17.md). The source/export measurements below apply to this asset version.

## What shipped

- `public/characters/bodies/human-v1.glb` — skinned hm08 male, ~1.75 m, clay skin + review shorts overlay
- `blender/characters/human-v1.blend` — authoring file
- `blender/characters/sources/` — pinned MakeHuman CC0 inputs
- Pipeline: `scripts/character-assets/`

## License

MakeHuman **core graphical assets** are CC0 1.0. MakeHuman application code is AGPL; MPFB addon code is GPL. Neither is copied into this repo or the browser runtime.

Primary statements:

- https://static.makehumancommunity.org/about/license.html
- https://static.makehumancommunity.org/mpfb/faq/is_it_really_free.html
- https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.ASSETS.md

Pinned commit `a8bc2d54ff0ac92e78ff71431b1023eda42bf482`. SHA256 in `scripts/character-assets/provenance.json`.

## Conventions

- Units: meters. MH Y-up decimeters → Blender +Z up, −Y forward → glTF +Y up, +Z forward.
- Semantic Mixamo aliases on core bones; remaining joints keep MakeHuman names.
- Zero morphs. Zero runtime clips. Stress poses are authoring-only and not exported.
- Shorts are a review overlay, not coverage architecture.
- Body polygons `use_smooth=True` (no subdivision). Zero-weight body verts: **0**; 16951 helper weight entries omitted. Dropped influences fold onto a kept ancestor then normalize to 4.
- Same-pose full vs 4-influence stress: **max 0.0381 m**, **p95 ~6.7e-8 m**, worst verts head (ids 1380, 1520, …). Visual acceptance is parent-owned. Not AAA.

## Regenerate

```sh
python3 scripts/character-assets/fetch-makehuman.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/character-assets/build_human_v1.py
node scripts/validate-character-body.mjs public/characters/bodies/human-v1.glb --out ve-capture/m2b-human/validation.json
```

Isolated Blender process. Do not `npm run export`. Do not open the live shrine.

## Known problems

Closed eyelids / clay / no hair — unfinished art, not final face lookdev. Review shorts still have a small waist gap. 2460 verts lose some influence (max discarded 0.3, p95 frac 0.06); head-region pose error up to 3.8 cm is unresolved. Genital body geo still under shorts.

For current gameplay integration and priorities, use [CURRENT.md](CURRENT.md). This document records the original source asset only.
