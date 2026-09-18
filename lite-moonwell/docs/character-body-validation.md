# Body GLB validation (M2a)

Offline, reusable acceptance report for authored Human/Orc/Undead body exports. This is validation infrastructure only. It does **not** complete M2, certify production art, or close performance gates.

## CLI

```sh
node scripts/validate-character-body.mjs <path.glb> [--profile <id>] [--out <report.json>]
```

- Exit `0`: no errors. Warnings are allowed and **do not** mean production acceptance.
- Exit `1`: invalid asset.
- Exit `2`: missing path, unknown flag, unreadable file, or unknown `--profile`.

Resolve current profile IDs/capabilities from `src/character/runtime/body-profile.js` and the CLI rather than a dated list. Structural profile status does not certify current art, fit compatibility or gameplay readiness. See [character contracts](character-system-north-star.md).

## Library

```js
import { validateBody, WEIGHT_NORMALIZATION_TOLERANCE } from '../src/character/runtime/validate-body.js';

const report = await validateBody(glbBytes, { profile: 'human-male-v1' });
```

`profile` may be a catalog id or an explicit metadata object (`morphs`, `requiresMaterials`, `units`). Unknown ids become `PROFILE_UNKNOWN` without crashing.

The validator reuses `parseGlb` / `readAccessor` and `inspectBindContract`. It copies input bytes and never rewrites weights, joint indices, or node transforms.

## Report

| Field | Meaning |
|---|---|
| `schemaVersion` | Currently `1` |
| `valid` | `errors.length === 0` |
| `errors` / `warnings` | `{ code, path, message }` with stable `code` values |
| `summary` | mesh/primitive/joint counts, animation names, morph names, bind signature if inspection succeeds, **source-mesh-local** bounds, import-root/mesh transforms, units, profile flags, `unsupportedChecks` |

Bounds are POSITION axis-aligned extents. They are **not** world dimensions. RootNode scale is not applied.

## Checks

- Skinned primitives: `POSITION` VEC3 float and finite; `JOINTS_0` and `WEIGHTS_0` both present; joint indices in the associated skin; weights finite, nonnegative, same vertex count, sum `1 ± 1e-4` (`WEIGHT_NORMALIZATION_TOLERANCE`). Zero total weight is an error. Source weights are not normalized in place.
- Additional `JOINTS_n` / `WEIGHTS_n` (`n>=1`) emit `SKIN_INFLUENCES_UNCHECKED` and are not treated as validated.
- Sparse, normalized, and MAT2/MAT3 accessors are rejected (`ACCESSOR_UNSUPPORTED_*`). They are not reinterpreted.
- Required semantic joints go through the existing Mixamo import map and bind contract. Failures are structured errors. Human/Orc/Undead bind hashes are **not** required to match each other.
- Material indices must reference `materials[]`. A missing primitive material is a warning unless the profile sets `requiresMaterials`. Presence is not a quality grade.
- Morph target names are reported only from actual `primitive.targets` slots with valid `POSITION`/`NORMAL`/`TANGENT` accessors (referenced accessor, VEC3 float, matching vertex count, finite deltas). `extras.targetNames` without those slots is `MORPH_TARGET_COUNT_MISMATCH` and never establishes morph support. Invalid or unreadable target accessors are `MORPH_TARGET_INVALID`. Declared profile morphs must exist on at least one mesh with real target data; other meshes are not required to carry the same morphs. Empty morph support is valid. `fullness` is synthesized by the diagnostic fixture and must not be advertised for raw `base.glb` unless that target is actually present.
- Top-level collections (`meshes`, `nodes`, `skins`, `materials`, `animations`, `accessors`, `scenes`) must be arrays. Null or non-object node/mesh/primitive entries are `GLTF_INVALID`. `validateBody` returns a structured invalid report for malformed JSON; it does not throw.
- Non-identity import-root / mesh-node transforms are warnings. Translation/scale must be length 3, rotation 4, matrix 16, all finite numbers. Wrong type or length is `TRANSFORM_MALFORMED` (not a non-identity warning). Non-finite values of the correct length are `TRANSFORM_NONFINITE`. Mixed matrix+TRS is an error. The Mixamo placeholder is not held to production export identity conventions.
- Units: unless the profile declares unit metadata, `UNITS_UNVERIFIED` is warned. Do not infer meters from local height or from Mixamo `RootNode` scale `0.01`.

## Profile readiness

- `productionProfiles()`: status `production` with a body asset. Query the registry for current membership; this validator does not designate the active Ashen character.
- `profilesReadyForFit()`: production-fit only. Placeholders excluded by default.
- `profilesReadyForFit({ includePlaceholders: true })`: diagnostic inspection of the Mixamo Human only. Not a race selector.

## This does not prove

The validator alone does not prove authored body quality, retargeting quality, garment fit, or full-game >120 FPS. Source assets and their gameplay readiness are separate concerns; see [CURRENT.md](CURRENT.md).
