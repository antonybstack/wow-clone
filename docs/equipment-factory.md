# Equipment factory

The factory compiles one descriptor into each supported race fit. Schema 1 remains the rigid
Bastion plate contract; schema 2 adds a skinned cloth contract. Fieldcoat is the first local
schema-2 integration: local fit/motion checks pass; performance and release acceptance remain
open. It reuses the existing steps:

- `normalizeHumanBind`
- `verifyFactoryEquipmentBind`
- `retainFullStartupGeometry`
- `trackBodyRigid` for plates; `trackBodyShape` and `recomputeNormals` for cloth
- the existing shape, identity, coverage and remote-piece compilers

| File | Role |
| --- | --- |
| `scripts/character-assets/equipment-factory-contract.mjs` | Pure checks: the descriptor, pins, frame restoration, rigid/soft policies, GLB framing, Human shape targets, the publication plan. |
| `scripts/character-assets/equipment-factory.mjs` | The per-item compiler: pinned Blender, independent read-back, repeat build, optional local race-pack publication. |
| `scripts/character-assets/prepare-factory-content.mjs` | The single content entry point (`npm run prepare:factory`). It runs the factory and then every downstream pack compiler. |
| `scripts/character-assets/refresh-human-identity-equipment.mjs` | An equipment-only refresh of the Human identity descriptors. |
| `blender/characters/wardrobe/<item>.json` | The item descriptor (examples: `bastion-shoulders.json`, `fieldcoat.json`). |
| `scripts/character-assets/build_<item>.py` | The item's Blender builder (examples: `build_bastion_shoulders.py`, `build_fieldcoat.py`). |

An equipment-only identity refresh must copy the current `garmentLayerCoverage` as well as
`items` and `compactItems`, while retaining the identity-specific body partition. Fieldcoat's
first neutral check passed but a saved Prime body exposed upper trousers because its descriptor
still carried the previous shared rules. The production-identity verifier now refuses that
stale metadata; compiler/resolver tests also check upper-trouser hiding and removal restoration.

## Commands

```sh
# Proof only: an isolated build plus a byte-identical repeat. Nothing outside --out is written.
npm run prepare:factory -- blender/characters/wardrobe/bastion-shoulders.json --out .cache/<new-run>

# Local pack integration. It needs an owned, audited dev harness: one Chrome with remote
# debugging on ASHEN_CDP_PORT, idle (about:blank only), and the game served at ASHEN_TEST_URL.
ASHEN_CDP_PORT=<port> ASHEN_TEST_URL=<owned dev URL> \
  npm run prepare:factory -- blender/characters/wardrobe/bastion-shoulders.json --out .cache/<new-run> --publish

# Compiler only, for iterating on one race (never publishable):
node scripts/character-assets/equipment-factory.mjs <descriptor> --out .cache/<new-run> --races human
node --test scripts/test-equipment-factory.mjs scripts/test-equipment-factory-soft.mjs
node --test scripts/test-appearance-catalog-v7.mjs scripts/test-appearance-catalog-v8.mjs
```

- **Fresh output directory every run:** `--out` must be a subdirectory of `.cache`, and each
  `build-1` and `build-2` inside it is created **exclusively**. Because the directory must be new,
  a builder that exits 0 without exporting can't reuse an earlier raw GLB, and can't make the
  repeat check pass on stale bytes.
- **Race arguments:** duplicate `--races` are refused, and `--publish` requires exactly the full
  `FITS_BY_RACE` set.
- **Blender:** `ASHEN_BLENDER` selects the binary. It must report `Blender 5.2.1`.
- **Logs:** `prepare:factory` writes one log per step plus `content-report.json` into `--out`.

## Descriptor (schema 1)

| Field | Rule |
| --- | --- |
| `id`, `mesh` | Logical item id (`camelCase`) and the single authored mesh (`PascalCase`). No item id is hardcoded anywhere in the factory. |
| `slot`, `layer`, `occupies` | Known catalogue slots; `occupies` includes `slot`. |
| `deformation`, `rigidBones` | `rigid-bone` only. Every vertex is `[1,0,0,0]` on one `mixamorig:<bone>`, and every declared bone carries geometry. |
| `blenderVersion` | `5.2.1`. |
| `builder` | `{path, sha256, dependencies:[{path, sha256}]}`. Declare and pin every builder dependency (Bastion `exec`s the Warden cap builder). The factory hashes the declared files; it does not discover Python imports or sandbox the builder. |
| `fits.<race>` | Required for **every** race: `{directory, bodyMesh, source, sha256, interface}`, and `interface` must equal `FITS_BY_RACE[race]`. A missing race is refused, never substituted. |
| `material` | `{revision ≥ 1, baseColor[4], metallic, roughness}`, all within 0..1. |
| `detail` | `full: authored-shell` and `compact: same-rigid-geometry`. Compact never simplifies a rigid plate. |
| `humanShape` | Optional. `{family: ashen-human-shape-v1, mode: trackBodyRigid, body:{source, sha256, decodedSha256, compression: gzip, bodyMesh}}`. The source is the **tracked** published gzip coverage-source body (both the encoded and the decoded hash are pinned), never a `.cache` candidate. |
| `structure` | Optional `{partsPerBone}`. The builder's `<race>-raw.structure.json` must report exactly that many non-empty parts for each declared bone. |
| `sourceRights` | Required provenance and licence statement. |

## Descriptor (schema 2)

Schema 2 shares the id/slot/occupancy, pinned builder, body fit, licence and Blender requirements
above. It rejects `rigidBones` and `structure`; schema-1 rules are unchanged.

| Field | Rule |
| --- | --- |
| `deformation` | `soft-skin`; four normalized influences per vertex, at least some blended vertices, the accepted 65-joint interface, no item animation clips. |
| `fits.<race>.garment` | Separately pinned `{source, sha256, mesh}` from a tracked neutral garment master. Body/rig pins do not substitute for garment provenance. |
| `materials` | Unique names; each declares revision, base colour, metallic, roughness, `OPAQUE`, `doubleSided` and exact base-colour image SHA-256 or null. Every declared material is used; extra textures and emission are refused. |
| `detail` | `full: authored-cloth`, `compact: native-simplified-soft-skin`. The downstream compact compiler uses its existing simplification and normal packing policy. |
| `humanShape` | Optional pinned body as above; `mode: trackBodyShape`. Derive positional offsets and recompute normal deltas offline; runtime uses existing Lite morphs. |

`design`, `corrective` and `status` are builder-specific or descriptive fields; the generic
factory does not interpret them. Fieldcoat's pinned builder interprets its `design` fields.
Changing them changes the descriptor hash and requires a new build/provenance.


## What one compiler run proves

1. **Before anything is written:**
   - the descriptor is valid
   - the builder, its dependencies, each race's source body, each declared garment master and the gzip shape body (encoded and
     decoded) all match their hashes
   - Blender reports `5.2.1`
2. **Authoring:** each race runs in its own
   `blender --background --factory-startup --python-exit-code 1` process. That process gets a
   **minimal environment** (`PATH`, `HOME`, `TMPDIR`, the four `ASHEN_PLATE_*` paths,
   `ASHEN_GARMENT_SOURCE`, serialized `ASHEN_FACTORY_DESCRIPTOR` and `ASHEN_FACTORY_RACE`)
   and a 120 s timeout. Native glTF Transform decodes a schema-2 master to a disposable
   uncompressed input; Blender does not need to implement meshopt decoding.
3. **Bind restoration:** the export is restored to **that** race's joint order, inverse binds,
   rest TRS and body frame. `normalizeHumanBind` first checks the exported rest palette against
   the body to 0.002, so a wrong frame is refused rather than snapped.
4. **Policy check:** no animation clips, no morph targets, exact single-bone weights on the
   declared bones, the descriptor material factors, and full-geometry retention for compact
   detail on schema 1. Schema 2 independently checks normalized blended weights, named
   materials, image hashes, culling and opacity.
5. **Independent read-back:** a GLB container/chunk framing check, then a fresh parse, then the
   policy again, then the native palette/bounds gate (`verifyFactoryEquipmentBind`). The framing
   check exists because a truncated BIN chunk otherwise parses silently.
6. **Structure:** when the descriptor declares `structure`, the builder's per-race report must
   match it.
7. **Human shape proof:** `slender`/`stout` are derived with `trackBodyRigid` as one rigid
   similarity per arm group, with zero normal deltas on schema 1. Schema 2 uses the existing
   body-shape transfer and normal recomputation. The shaped file then passes the policy
   (exactly two targets) and, projected to neutral, the same native bind gate.
8. **Repeat:** `build-2` must be byte-identical to `build-1` for every artifact, including the
   shape proof. Schema-2 oriented triangle indices are canonicalized by cyclic rotation
   and sorting, reusing the Lector preparation pattern; winding, duplicates and vertex
   streams are preserved. This removes Blender serialization-order variance, not geometry.
9. **Re-check after the build:** the pins are hashed again, so nothing changed while Blender ran.
10. **Report:** `report.json` records:
    - the descriptor and tool hashes
    - the **full `blender --version` output**, `process.platform` and `process.arch`
    - the per-race verification and structure
    - the shape proof

**Reproducibility scope.** "Byte-identical" means byte-identical *on this host, with this Blender
build*. Cross-platform or cross-build reproducibility is not claimed. The recorded version string
and platform are there so that a difference elsewhere can be explained.

## The shipped Human shape vs the isolated proof

The factory's `<id>-human-shape.glb` stays in `--out`. It only proves that the pinned item
accepts its declared slender/stout transfer against the pinned body. It is never published, and
`report.humanShape.sha256` is not a shipped asset hash.

The **shipped** shaped item comes from `prepare:human-shapes`:
- `build-garment-shape-family.mjs` selects every catalogued, non-procedural item present in the
  shipped Human manifest.
- New factory items are appended after the released rows, which keep their exact order.
- That step rebuilds the body, applies `trackBodyRigid` or `trackBodyShape` according to deformation, meshopt-compresses
  and gzips the result into `human-shape-v1`.

Expect different bytes from the proof.

## Bastion's geometry (`build_bastion_shoulders.py`)

- **Base cap:** the Warden cap builder supplies each race's native deltoid cap, upper-arm
  selection and rigid groups.
- **Layers:** the Bastion builder copies native outer-cap patches and closes each with Blender's
  **Solidify** modifier, giving a raised crest and two curved lames per arm.
- **Clearance diagnostics:** it records the BVH signed nearest-surface distance and the number of
  crossing edges for every pair of operands (`operandClearances` in the structure report). These
  are art-review evidence, not a gate.
- **Welded exact union:** seam-duplicate points in each operand are welded (`remove_doubles`, 10 µm)
  and its normals recalculated. The six operands are then merged into the cap with an **EXACT
  Boolean UNION** (`use_self`), so buried and intersecting faces don't survive into the render
  surface. Earlier candidates that only joined the layers left their lames and crests
  intersecting each other and the cap; they were rejected for that.
- **Rigid weights after the union:** every vertex, including ones the Boolean created, goes
  whole-weight to the nearer of the two shoulder heads.
- **Scale:** the builder refuses a non-uniform cap scale.

## Fieldcoat's geometry (`build_fieldcoat.py`)

- Reuse each race's immutable licensed Lector master, collar, sleeves, underarm lining,
  UVs, skin and three material batches. The garment is structurally tailored rather than
  being renamed or recoloured alone.
- Shorten the hem at a declared fraction along that race's upper leg, cut front/back V vents,
  and extrude two shallow front reinforcement seams into the existing trim batch.
- Native BMesh bisect/extrude operations interpolate source UV and deform layers. Limit cuts
  to the intended panels so they do not introduce extra skin influences in sleeves/lining.
- Measure the fraction discarded by four-influence reduction before invoking Blender's
  native limiter and normalizer; refuse loss above 3%. The actual build loss is recorded in
  each `*.tailoring.json`; this is not evidence of good live fit by itself.
- Published layer coverage hides the existing `trousers.upper` geoset beneath Fieldcoat,
  as it does for Lector. The body mask alone does not hide another garment. Lower trousers
  remain visible through the divided hem; verify the actual native parts on every race.
- Use the established frame restoration and bind checker. No runtime fitter, extra palette,
  animation clock, cloth simulation or material batch is introduced.

## Full content integration (`npm run prepare:factory -- … --publish`)

Each step runs only after the previous one succeeds:

1. **`factory` (`--publish`):**
   - repeat build
   - writes the immutable `<id>-<sha12>.glb` and the canonical `<id>.glb` into each race directory
   - writes `<id>-provenance.json`
   - adds `items[<id>]` to each race's `manifest.json`, by temp file then rename, one race at a
     time
2. **`shapes`:** `prepare-production-human-shapes.mjs` regenerates `human-shape-v1`, including
   the new item and its provenance.
3. **`startup-character`:** the starter character pack.
4. **`coverage`:** `prepare-coverage-release.mjs --publish` produces `manifest-coverage-v1.json`
   for all races. This is what the Orc, Undead and default Human runtime routes actually read.
5. **`identities`:** `refresh-human-identity-equipment.mjs` is an **equipment-only** refresh.
   - It keeps each identity preset's accepted **body and Graveweaver hood** bytes exactly and
     takes every other item from the new `human-shape-v1`.
   - It refuses if the shape body's coverage source differs from the descriptor's pinned
     decoded body. A body change needs full identity preparation and visual acceptance.
   - It runs the complete identity verifier on the staged descriptors before writing.
   - It writes addressed descriptors first and the stable index last, and keeps old
     descriptors for clients that are already running.
   - Coverage finishes first: pinning the shared manifest before that rewrite would leave
     stale identity provenance. The final command verifies the identity index again.
6. **`remote`, `native-bounds` and `remote-publication`:** these produce the remote pieces and
   the **native swept bounds** for every race. The bounds are measured in the owned game
   instance over CDP, offline and not as an FPS measurement. The publisher regenerates the
   presence piece catalogue.
7. **Final check:** for Human (`equipment` and `human-shape-v1`), Orc and Undead:
   - the complete production identity verifier must pass
   - the full and compact entries must pass `assertAssetFit` for that race
   - each entry must fit under the existing swap `pieceBytes` budget
   - each must have native swept bounds

   The result is `content-report.json` with `localPacksPublished: true` and
   `productionReleased: false`.

**Publication is local and not atomic across races.** Within one race, manifests change only
after every file is written, and through temp+rename. Across races, the manifests are renamed one
after another, so a failure between two renames can leave one race advertising the item while
another doesn't. Canonical `<id>.glb` files are also overwritten before the manifests.

Recovery is to fix the cause and rerun the whole command into a new `--out`, which rewrites every
step. Don't release a tree that came from a failed run.

## Catalogue requirement (v8 and frozen history)

`--publish` refuses unless the item is already registered in
`src/ashen-reach/equipment-catalog.js` with the descriptor's mesh. A new item also needs an
**explicit catalogue version**:

- **Current local version:** `APPEARANCE_CATALOG_VERSION` is `appearance-catalog-v8`, which adds
  `fieldcoat`. Production remains the version recorded in [CURRENT](CURRENT.md).
- **Frozen history:** v4–v6 are frozen to the 18 released items (`EQUIPMENT_V6_ITEMS`), and
  v1–v3 to their own sets. V7 is closed to `EQUIPMENT_V7_ITEMS` (v6 plus Bastion).
  A saved or networked older recipe cannot carry Fieldcoat.
  `migrateAppearance` upgrades v1–v7 explicitly while keeping identity, gear, shape and dyes.
- **Identity pack version:** `IDENTITY_CATALOG_VERSION` stays v6 because it stamps the
  identity pack index, which an equipment-only change doesn't regenerate.
- **Presence and remote pieces:** the handshake and the remote-piece catalogue compare against
  the current version, and refuse loudly until step 6 has republished them.

## Known limits

- **Schema-1 material policy covers factors only:** baseColor, metallic and roughness are
  compared to 1e-6. Schema 2 also gates textures, `alphaMode`, `doubleSided` and emission;
  these stricter rules do not silently change the old descriptor contract.
- **Operand clearances are recorded, not enforced:** the factory checks the structure counts.
  Whether the final union reads cleanly is a visual and native question.
- **Bind is proven against the unsplit body:** the bind proof uses each race's unsplit source
  body. Coverage-partitioned runtime bodies rely on the coverage verifiers, plus a live equip on
  that route.

## Not production acceptance

A successful `prepare:factory --publish` means only that the local packs are consistent. It is
**not** a release, and nothing here records final results. These gates are still outside the
factory and are recorded separately when they are run:

- actual Armory fit, equip and swap transactions and motion on all races and shaped Humans
- cold and resident swap budgets
- native cold-start and FPS gates
- reviewed motion delivery
- commit and push, then a sealed Pages upload and public checks

## Adding a second item

1. **Design:** write `scripts/character-assets/build_<item>.py`. Read `ASHEN_PLATE_SOURCE`,
   `ASHEN_PLATE_OUT`, `ASHEN_PLATE_BLEND` and `ASHEN_PLATE_BODY_MESH`. Export exactly one skinned
   mesh, named as the descriptor's `mesh`, with whole weights on the declared bones. Add no
   animation or morphs, and use one material whose factors match the descriptor. Optionally,
   write `<OUT minus .glb>.structure.json`.
2. **Descriptor:** copy `bastion-shoulders.json` and set a new `id` and `mesh`, plus `slot`,
   `layer`, `occupies`, `rigidBones` and `material`. Pin the builder and every dependency with
   `shasum -a 256`, and pin each race's current `body.glb` plus the current `human-shape-v1`
   coverage-source body (encoded and decoded).
3. **Iterate:** run `npm run prepare:factory -- <descriptor> --out .cache/<new-run>` until the
   repeat is byte-identical. Review the structure and clearance reports, and look at the race
   GLBs.
4. **Register:** append the item to `equipment-catalog.js`. Bump the appearance catalogue with a
   new `APPEARANCE_V<n>_REGISTRY`, freezing the previous item set, and extend the migration and
   presence tests.
5. **Publish locally:** run `--publish` with the owned harness, verify actual live fit/motion
   and commit/push the verified local work. Record any open startup/release hold explicitly;
   production promotion requires every gate in [Not production acceptance](#not-production-acceptance).

For a soft item, copy `fieldcoat.json` instead: pin the separate race garment masters, declare
material/image policies and `trackBodyShape`, then read the schema-2 rules above. Do not convert
cloth to whole-bone weights to fit the rigid contract.

## References

- Blender command-line arguments: https://docs.blender.org/manual/en/latest/advanced/command_line/arguments.html
- Blender Solidify modifier: https://docs.blender.org/manual/en/latest/modeling/modifiers/generate/solidify.html
- Blender Boolean modifier (Exact solver): https://docs.blender.org/manual/en/latest/modeling/modifiers/generate/booleans.html
- Blender glTF 2.0 exporter: https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html
- Blender BMesh operations: https://docs.blender.org/api/current/bmesh.ops.html
- Blender vertex-group limiter: https://docs.blender.org/api/current/bpy.ops.object.html#bpy.ops.object.vertex_group_limit_total
- Blender `mathutils.bvhtree`: https://docs.blender.org/api/current/mathutils.bvhtree.html
- glTF 2.0 skins: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#skins
- glTF 2.0 morph targets: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#morph-targets
- GLB binary layout: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#binary-gltf-layout
- glTF Transform `NodeIO`: https://gltf-transform.dev/modules/core/classes/NodeIO
- Node.js `child_process.spawn`: https://nodejs.org/api/child_process.html#child_processspawncommand-args-options
- Node.js `zlib.gunzipSync`: https://nodejs.org/api/zlib.html#zlibgunzipsyncbuffer-options
- Chrome DevTools Protocol: https://chromedevtools.github.io/devtools-protocol/
