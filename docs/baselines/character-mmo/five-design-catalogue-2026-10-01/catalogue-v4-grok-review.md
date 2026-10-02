# Catalogue v4 Grok review (uncommitted after `5d65896`)

Independent read-only check of the M6 five-design catalogue/factory integration. No browser, tests, builders, or product edits. Parent owns implementation. Presence handshake is in tree; remote per-piece work remains pending and is not scored as a regression. Parent reports v1/v2/v3 tests and 156 character / 96 equipment checks pass; those runs were not repeated here.

## Verdict

No demonstrated invalid-legacy, hash, bind, core-alias, or mixed-plate defects on the inspected Human published artifacts. Frozen v3 stays thirteen IDs / eight slots. v4 migration rewrites only the catalogue header. Existing HEAD item SHA/bytes/URLs/meshes/fits and all three `bindSha256` values are unchanged. One provenance-selector weakness is real in `prepare-wardrobe-designs.mjs`. Live mixed review, Orc/Undead mesh internals, and factory re-execution were not done here.

## Issues

### Issue 1 — Severity: suggestion
- File: `scripts/character-assets/prepare-wardrobe-designs.mjs:40`
- Description: Lector source-row lookup is `report.rows.find(r=>r.race===race&&(r.id===id||id==='lectorCoat'))`. When `id==='lectorCoat'` the second clause is always true, so the first row for that race wins even if `r.id` is missing or belongs to another piece. Duskguard lookups still require `r.id===id`. Published Human/Orc/Undead `lectorCoat` SHA-256 values matched their manifests, so this did not produce a wrong advertised file in the current tree.
- Suggestion: Match `r.race===race && (r.id===id || (id==='lectorCoat' && (r.id==='lectorCoat' || r.id==null)))`, or set `id:'lectorCoat'` on every lector report row and require `r.id===id`.
- Status: open

## What was inspected

Source/docs: `docs/plans/character-mmo/five-design-catalogue-implementation.md`; `src/ashen-reach/equipment-catalog.js`; `src/character/appearance/{contract,codec}.js`; `scripts/test-production-appearance.mjs`; `scripts/character-assets/{prepare-wardrobe-designs,build-garment-shape-family,prepare-production-human-shapes,compile-coverage-manifest,startup-geometry-policy}.mjs`; `blender/characters/wardrobe/{lector-coat,duskguard-armor}.json`; `src/multiplayer/{protocol,client}.js`; `server/presence/room.js`.

Manifests vs HEAD `5d65896`: `public/ashen-reach/equipment{,-orc,-undead}/{manifest.json,manifest-coverage-v1.json}`; `public/ashen-reach/human-shape-v1/manifest.json`; `public/ashen-reach/startup/character/manifest.json`.

Independent SHA-256/size (Node `crypto`, working-tree bytes): fifteen new race/item hashed GLBs plus unhashed aliases; Human coverage `duskguardTassets-coverage-e813d3927fc0.glb`; Human full/compact bins for the five new IDs. All 26 checked entries matched declared `sha256`/`bytes`/`encodedBytes`. Every alias byte-equaled its hashed file.

Decoded with installed `NodeIO` + `meshoptimizer` `MeshoptDecoder` (not metadata alone):

| Artifact | SHA-256 prefix | Joints / IBM |
|---|---|---|
| `equipment/duskguardTassets-bd6b56f08764.glb` | `bd6b56f08764` | 65 / 1040 |
| `equipment/duskguardTassets-coverage-e813d3927fc0.glb` | `e813d3927fc0` | 65 / 1040 |
| `human-shape-v1/duskguardTassets-coverage-ee06988dee5f.bin` (gzip GLB; full==compact) | `252dfafe3765` | 65 / 1040 |
| `human-shape-v1/duskguardCuirass-87f33adb1a29.bin` (gzip GLB; full==compact) | `1b112f45fd3b` | 65 / 1040 |
| `equipment/lectorCoat-aa01a6300d3d.glb` | `aa01a6300d3d` | 65 / 1040 |
| `human-shape-v1/lectorCoat-aa746caae4d7.bin` (full) | `807dd672d3ea` | 65 / 1040 |
| `human-shape-v1/lectorCoat-compact-de8ccead1032.bin` | `c7cb75b4f44f` | 65 / 1040 |

Human rest/inverse-bind hash of the decoded skins was identical: `2d983bcc5e4a63570b930c73a9d4cc24ef9e2b1589a1f2b56410e28aa785a72b`.

Orc/Undead new GLBs were hashed against their manifests only. Native fifteen-source factory scripts were not re-run.

## Evidence (not inference)

**Legacy freeze / v4 header.** `EQUIPMENT_V3_ITEMS` is the twelve legacy IDs plus `wardenPauldrons`. `APPEARANCE_CATALOG_VERSION` is `appearance-catalog-v4`. `migrateAppearance` for v3 returns `validateAppearance({...old,catalogVersion:v4})` with equipment/shape/race untouched. v1/v2 paths still add `shoulders:null`. `decodeMigratingAppearance` includes `APPEARANCE_V3_REGISTRY`. `scripts/test-production-appearance.mjs` asserts the exact thirteen v3 IDs, preserves stored v3 bytes, and throws `UNSUPPORTED_ITEM` for the five new IDs on a v3 document.

**Old published items.** Every pre-existing key in the three race equipment manifests kept HEAD `sha256`, `bytes`, `url`, `meshes`, and `fit`. Human/Orc/Undead `bindSha256` unchanged (`96bc48fe…`, `5bdfea1b…`, `6a7f392c…`). Every pre-existing `human-shape-v1` and `startup/character` item kept HEAD `sha256`/`url`/`bytes`.

**Catalogue meshes vs binaries (Human duskguard tassets).** Catalog parts: `DuskguardTrousers`, `DuskguardTrouserCuffs` (`hideWhenSlots:['boots']`), `DuskguardTassets`. Source GLB meshes match. Cuffs present (1380 verts / 284 tris, `soft-skin`). Trousers 1380 verts / **2260** tris, `soft-skin`, multi-bone (1177/1380). Tasset primitives `deformation:'rigid-bone'`, `maxBones:1`, `oneBoneFull` equals vertex count, `multi:0` (steel 110, brass 68). Materials: `WayfarerTrousers`, `Duskguard blackened steel` (metallic 0.9), `Duskguard hammered brass rim` (metallic 0.8).

**Coverage core is Duskguard trousers, not Graveweaver.** Coverage GLB adds `DuskguardTrousersUnderTorso`. Remaining trousers tris **1937** (2260 − 323). Primitive extras: `coveragePartition.sourceMesh === 'DuskguardTrousers'`. `compile-coverage-manifest.mjs` calls `deriveUpperTrousers(...,'DuskguardTrousers','DuskguardTrousersUnderTorso')`. Layer table names that core, not `WayfarerTrousersUnderTorso` / Graveweaver inner trousers. Human-shape coverage bin carries the same four mesh names.

**Mixed plate vs cloth (Human cuirass).** Undercoat and gussets `soft-skin` and multi-bone. Cuirass steel/brass primitives `rigid-bone`, one-bone full weight, four unique bones across the plate mesh. Full and compact share SHA `1b112f45fd3b…` (rigid extras keep exact startup geometry). Greaves/vambraces likewise full==compact in the shape manifest.

**Lector full vs compact.** Source and full keep three soft-skin primitives on `LectorCoat` (9926 + 338 + 262 tris) with `WayfarerTunic`, `Lector folded wool trim`, `Lector underarm wool`. Compact simplifies the main shell to 2450 verts / 3970 tris (`ratio:0.4`, `error:0.002`, `lockBorder:true`). Bind remains 65 / IBM 1040 / same rest hash. Compact is a silhouette stand-in, not a second source fit.

**Preloaded diagnostic / 2-fit path (code only).** `equipment.js` still imports `LEGACY_EQUIPMENT_ITEMS` / `LEGACY_EQUIPMENT_PRESETS`. `test-ashen-equipment.mjs` now walks only legacy meshes in `wanderer-equipment.glb`. Region crowd still decodes prepared recipes through `decodeMigratingAppearance`. Presence `validatePresenceAppearance` accepts only the two exact published fits; new IDs cannot join. Handshake `catalogVersion` must equal `appearance-catalog-v4`.

## Unverified limits

- Did not re-run tests, factories, or Pages/normal builds.
- Did not decode Orc/Undead GLBs or Human greaves/vambraces meshes (hashes only).
- Did not re-verify the fifteen cache factory binds against each race body.
- Did not play Armory mixes, restoration, or motion; TG 833/834 remain the inherited source-motion refs.
- Did not trace default-start network fetches (startup map is recipe-selected; not treated as a wholesale preload).
- Remote per-piece preparation, public deploy, and physical phone remain pending by plan.
- Did not inspect live GPU/ownership budgets or the retained forest-pacing flag.
