# Character asset provenance (M2a/b/d)

Asset provenance and validation infrastructure for the original authored Human/Orc/Undead
bodies (`human-v1.glb`, `orc-v1.glb`, `undead-v1.glb`) and the character-lab mannequin. None
of this is the active gameplay default: Ashen Reach uses the later source-compatible Human
described in [CURRENT.md](../CURRENT.md) and [source recovery](source-motion-recovery-implementation-2026-09-17.md).
These are closed milestone reports, retained for license/source lineage and for the
`character-lab.html` / `body-preview.html` dev tools that still load these assets.

## Character lab mannequin — verified 2026-09-17

The lab loads `public/characters/base.glb`. SHA256:
`2f9e45d0f7d9faeae4c20e18585173d62953df1a8f0272f270bedb200927604c`.
It contains the X-Bot mannequin, a 65-joint Mixamo rig, and 45 animation clips.
The lab's diagnostic garment shells, materials and fullness morph are local
fixture-composer additions, not features of the raw base GLB.

**Verified lineage evidence:**

- Both mannequin mesh POSITION arrays (`Alpha_Joints`, `Alpha_Surface`) exactly
  match `/Users/antbly/dev/ThirdPersonTemplate/src/assets/character.glb`:
  37,419 and 68,883 float values respectively, maximum difference zero.
  That template asset contains five clips; the local base contains 45.
- All 45 clip names and all 2,385 channel input/time arrays match
  `/Users/antbly/dev/BJS_Character_Controller_V2/assets/animations.glb` exactly.
  Channel matching used joint name/path with the Mixamo prefix normalized.
  Output values differ, consistent with conversion/retargeting; the files are
  not byte-identical. The original merge command/history has not been located.
- That reference repository's README credits a customized Mixamo skeletal rig
  and **Quaternius Universal Animation Library** animations:
  https://quaternius.com/packs/universalanimationlibrary.html
- Therefore earlier blanket descriptions of the entire animation set as
  "Mixamo animations" were imprecise: distinguish mannequin/rig origin from
  animation-library attribution.

The original gameplay and M1 lab did build on the imported base. The M2b source
handoff then preferred MakeHuman/MPFB for a credible anatomical Human with a
face, fingers and reusable body assets. The resulting 163-joint MakeHuman body
required a separate retargeting stage (below). Later mage passes added procedural
pose/stride replacements on top of that retarget. User review preferred the original
lab motion; it was kept as the fidelity baseline before further replacement work.

One additional comparison to investigate: source idle/walk/sprint durations are
2.5 / 1.333333 / .666667 seconds; the Human retarget's idle/walk/run durations
are 3.166667 / 1.7 / .866667 seconds. Do not assume the retarget preserved timing.
This records the difference, not a proven explanation of how it arose.

The lab plays clips directly and has no physics controller. Gameplay Havok
support/jump fixes remain independent of the chosen visual skeleton.

## License

MakeHuman **core graphical assets** are CC0 1.0. MakeHuman application code is AGPL;
the MPFB addon code is GPL. Neither is copied into the repo or the browser runtime.

- https://static.makehumancommunity.org/about/license.html
- https://static.makehumancommunity.org/mpfb/faq/is_it_really_free.html
- https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.ASSETS.md

Pinned commit `a8bc2d54ff0ac92e78ff71431b1023eda42bf482`. SHA256s in
`scripts/character-assets/provenance.json` (Human) and `provenance-races.json` (Orc/Undead).
Fetch verifies existing downloaded bytes rather than re-downloading.

## Human v1 source body (M2b)

- `public/characters/bodies/human-v1.glb` — skinned hm08 male, ~1.75 m, clay skin + review
  shorts overlay
- `blender/characters/human-v1.blend` — authoring file
- `blender/characters/sources/` — pinned MakeHuman CC0 inputs
- Pipeline: `scripts/character-assets/`

Conventions: units are meters (MH Y-up decimeters → Blender +Z up, −Y forward → glTF +Y up,
+Z forward). Semantic Mixamo aliases sit on the core bones; remaining joints keep MakeHuman
names. Zero morphs, zero runtime clips; stress poses are authoring-only and not exported.
The shorts are a review overlay, not coverage architecture. Body polygons use `use_smooth`
(no subdivision). Zero-weight body verts: 0; 16,951 helper weight entries omitted, folded
onto the kept ancestor at normalize depth 4.

```sh
python3 scripts/character-assets/fetch-makehuman.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/character-assets/build_human_v1.py
node scripts/validate-character-body.mjs public/characters/bodies/human-v1.glb --out ve-capture/m2b-human/validation.json
```

Isolated Blender process. Do not `npm run export`. Do not open the live shrine.

**Known problems:** closed eyelids / clay / no hair — unfinished art, not final face
lookdev. Review shorts still have a small waist gap. 2,460 verts lose some influence (max
discarded weight 0.3, p95 fraction 0.06); head-region pose error up to 3.8 cm is unresolved.
Genital body geo is still under the shorts. For current gameplay integration priorities, use
[CURRENT.md](../CURRENT.md); this section records the original source asset only.

## Orc v1 / Undead v1 source bodies (M2d)

Not production-fit or active Ashen gameplay characters, and not migrated to the
source-compatible Ashen Human bind. See [CURRENT.md](../CURRENT.md); measurements below apply
to these export versions only.

| Race | GLB | Blend | Evidence |
|---|---|---|---|
| Orc | `public/characters/bodies/orc-v1.glb` | `blender/characters/orc-v1.blend` | `ve-capture/m2d-races/orc/` |
| Undead | `public/characters/bodies/undead-v1.glb` | `blender/characters/undead-v1.blend` | `ve-capture/m2d-races/undead/` |

Lineup (Blender, same scale): `ve-capture/m2d-races/authoring-scale-lineup.png`. Profiles
`orc-male-v1` / `undead-male-v1` are `status=production-source`, `productionFit=false`, zero
morphs, zero clips.

Anatomy (Blender meters, named joints — Human / Orc / Undead):

| | height | shoulder (LeftArm.head–RightArm.head) | hand (L wrist–middle tip) | palm (L index–pinky MCP) |
|---|---|---|---|---|
| Human | 1.748 | 0.376 | 0.205 | 0.073 |
| Orc | 2.10 | 0.457 (×1.21) | 0.278 (×1.36) | 0.099 |
| Undead | 1.66 | 0.341 (×0.91) | 0.185 (×0.90) | 0.059 |

```sh
python3 scripts/character-assets/fetch-makehuman.py --verify-only
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/character-assets/build_orc_v1.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/character-assets/build_undead_v1.py
node scripts/validate-character-body.mjs public/characters/bodies/orc-v1.glb --profile orc-male-v1 --out ve-capture/m2d-races/orc/validation.json
node scripts/validate-character-body.mjs public/characters/bodies/undead-v1.glb --profile undead-male-v1 --out ve-capture/m2d-races/undead/validation.json
```

Isolated Blender. Do not `npm run export`. Do not open the live shrine.

## Body GLB validation (M2a)

Offline, reusable acceptance report for authored Human/Orc/Undead body exports. This is
validation infrastructure only. It does **not** complete M2, certify production art, or
close performance gates.

```sh
node scripts/validate-character-body.mjs <path.glb> [--profile <id>] [--out <report.json>]
```

- Exit `0`: no errors. Warnings are allowed and **do not** mean production acceptance.
- Exit `1`: invalid asset.
- Exit `2`: missing path, unknown flag, unreadable file, or unknown `--profile`.

Resolve current profile IDs/capabilities from `src/character/runtime/body-profile.js` and the
CLI rather than a dated list. Structural profile status does not certify current art, fit
compatibility or gameplay readiness. See [character contracts](../character-system-north-star.md).

```js
import { validateBody, WEIGHT_NORMALIZATION_TOLERANCE } from '../src/character/runtime/validate-body.js';

const report = await validateBody(glbBytes, { profile: 'human-male-v1' });
```

`profile` may be a catalog id or an explicit metadata object (`morphs`, `requiresMaterials`,
`units`). Unknown ids become `PROFILE_UNKNOWN` without crashing.

The validator reuses `parseGlb` / `readAccessor` and `inspectBindContract`. It copies input
bytes and never rewrites weights, joint indices, or node transforms.

**Report fields:** `schemaVersion` (currently `1`); `valid` (`errors.length === 0`);
`errors`/`warnings` as `{ code, path, message }` with stable `code` values; `summary` with
mesh/primitive/joint counts, animation names, morph names, bind signature (if inspection
succeeds), source-mesh-local bounds, import-root/mesh transforms, units, profile flags and
`unsupportedChecks`. Bounds are POSITION axis-aligned extents, not world dimensions;
`RootNode` scale is not applied.

**Checks:** skinned primitives need finite `POSITION` VEC3 float plus `JOINTS_0`/`WEIGHTS_0`,
joint indices within the skin, finite nonnegative weights of matching vertex count summing to
`1 ± 1e-4` (`WEIGHT_NORMALIZATION_TOLERANCE`); zero total weight is an error and source
weights are never normalized in place. Additional `JOINTS_n`/`WEIGHTS_n` (`n>=1`) emit
`SKIN_INFLUENCES_UNCHECKED` and are not validated. Sparse, normalized and MAT2/MAT3 accessors
are rejected (`ACCESSOR_UNSUPPORTED_*`). Required semantic joints go through the Mixamo
import map and bind contract; Human/Orc/Undead bind hashes are not required to match each
other. Material indices must reference `materials[]`; a missing primitive material is a
warning unless the profile sets `requiresMaterials`. Morph target names are reported only
from `primitive.targets` slots with valid `POSITION`/`NORMAL`/`TANGENT` accessors of matching
vertex count and finite deltas — `extras.targetNames` without those slots is
`MORPH_TARGET_COUNT_MISMATCH`; invalid/unreadable target accessors are `MORPH_TARGET_INVALID`.
Declared profile morphs must exist on at least one mesh with real target data. Top-level
collections must be arrays; null/non-object node/mesh/primitive entries are `GLTF_INVALID`;
malformed JSON returns a structured invalid report rather than throwing. Non-identity
import-root/mesh-node transforms are warnings unless malformed (`TRANSFORM_MALFORMED`) or
non-finite (`TRANSFORM_NONFINITE`); mixed matrix+TRS is an error. Units: unless the profile
declares unit metadata, `UNITS_UNVERIFIED` is warned — do not infer meters from local height
or from the Mixamo `RootNode` scale of `0.01`.

**Profile readiness:** `productionProfiles()` returns status `production` with a body asset
(query the registry for current membership; this validator does not designate the active
Ashen character). `profilesReadyForFit()` is production-fit only, placeholders excluded by
default; `profilesReadyForFit({ includePlaceholders: true })` adds the diagnostic Mixamo
Human only, not a race selector.

**This does not prove** authored body quality, retargeting quality, garment fit, or full-game
>120 FPS. Source assets and their gameplay readiness are separate concerns; see
[CURRENT.md](../CURRENT.md).
