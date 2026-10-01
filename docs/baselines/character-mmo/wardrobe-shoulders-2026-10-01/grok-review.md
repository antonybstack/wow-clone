# M6 shoulder factory / catalogue v3 — read-only review

Inspected uncommitted runtime, factory scripts, manifests and provenance only. No tests, processes, browser or live play. Parent later fixed TRS exactness, presence `shoulders:null` admission, and coverage tests; those are not re-raised. Native plate shape correction for live Orc/Undead shells is in progress and is not treated as closed. No visual or milestone acceptance.

## Summary

Catalogue v3 plus an independently streamed `wardenPauldrons` slot is wired through appearance v1/v2 freeze, explicit `shoulders:null` migration, and per-race equipment manifests. Historical seven-slot registries look exact. Default boot gear includes `shoulders:null` and the compact starter fetch list still names only body + Wayfarer cloth. Remaining defects are load-path mismatches around the new optional item, compact simplification of a rigid plate, and factory provenance that cannot reproduce the claimed Blender pin.

## Issues

### 1 — Severity: bug
- File: src/ashen-reach/equipment.js:10
- Description: The preloaded pack aliases `LEGACY_EQUIPMENT_ITEMS` internally, starts `selected` with seven slots (line 37), and `apply()` resolves visibility through those legacy items (line 40). `validateLoadout` is still the catalogue helper over full `EQUIPMENT_ITEMS` + eight `EQUIPMENT_SLOTS` (catalog.js:89). `setLoadout` assigns `selected` before `apply()` (line 42). Equipping `wardenPauldrons` therefore validates, mutates state, then throws `Item does not fit this slot`. `createEquipment` also ignores `bootAppearance.equipment` (main.js:363). `getState()` omits `shoulders`; `appearanceFromEquipment` fills it with `null` (from-equipment.js:13). The first Armory save from `?preloadedEquipment` can persist `shoulders:null` over a restored v3 recipe that had pauldrons.
- Suggestion: Validate and apply with `LEGACY_EQUIPMENT_ITEMS` and `LEGACY_EQUIPMENT_SLOTS` only. Keep `selected` on eight keys with `shoulders:null`. Reject `wardenPauldrons` before mutating state. Do not call `rememberAppearance()` from a seven-slot `getState()` while `committedAppearance` still holds pauldrons.

### 2 — Severity: bug
- File: src/ashen-reach/equipment-stream.js:180
- Description: `prepare` requires `manifest.items[id]`. Fast-start boots `public/ashen-reach/startup/character/manifest.json` (main.js:342, 354). That file is unmodified in this work and has no `wardenPauldrons` entry. Armory lists the item from the live catalogue (armory.js:42, catalog.js:29) as soon as the streamed impl exists. Equip before the later full-pack swap (main.js:533) fails with `No human fit for Warden steel pauldrons` even though the optional GLB exists under `equipment/`.
- Suggestion: Either add a content-addressed `wardenPauldrons` row to the starter manifest without putting it on the default fetch list (startup-fetch.js:45), or hide/disable the shoulders option until the full/shape pack is the active manifest.

### 3 — Severity: bug
- File: scripts/character-assets/prepare-production-human-shapes.mjs:61
- Description: Every non-body catalogue item, including the new rigid plate, is meshopt-simplified at `ratio:.4` into `compactItems`. `human-shape-v1/manifest.json` records `wardenPauldrons` compact with that policy. Saved pauldrons take this compact family (`usesHumanShapeStarter` + `preloadHumanShapePack`, startup-appearance.js:8, startup-fetch.js:60). Simplify can merge vertices across the joined left/right shells and rewrite `JOINTS_0`/`WEIGHTS_0`, which is the opposite of “one full-weight upper-arm bone per plate” (prepare-warden-pauldrons.mjs:41, provenance rigidity line). Byte delta is tiny (31932 → 31180), so the pass is not buying startup cost.
- Suggestion: Skip `simplify` when `deformation==='rigid-bone'` (or for `wardenPauldrons`); store the full plate as its own compact artifact.

### 4 — Severity: bug
- File: scripts/character-assets/build_warden_pauldrons.py:59
- Description: For `BODY_MESH=='BodyExposed'`, every mesh whose name starts with `Body` is joined before the deltoid cap. That is torso, waist, legs, boots and hands, not the accepted Orc shoulder surface. Provenance then reports Human 236 verts / 464 tris vs Orc 1694 / 3228 vs Undead 670 / 1120. The rigidity checker only proves each vertex is weight-1 to *some* upper-arm bone (prepare-warden-pauldrons.mjs:41); it does not prove the shell is that race’s shoulder. This matches the open native Orc/Undead appearance failure; it is not live acceptance.
- Suggestion: Restrict the Orc join to `BodyExposed` (and any mesh that actually carries `arm.upper`). Re-emit, re-hash, and re-check rest palette after the parent TRS copy.

### 5 — Severity: suggestion
- File: scripts/character-assets/prepare-warden-pauldrons.mjs:53
- Description: `tooling.blender` is the literal `'5.2.1'`. Node is `process.versions.node`. A different Blender still writes provenance that claims 5.2.1, so artifact hashes are not pinned to the tool that produced them.
- Suggestion: Read the actual Blender version from the child process (`bpy.app.version_string` into the env or a sidecar) and refuse to write provenance if it does not match the pin.

## Checked and not raised as defects

- v1/v2 registries use `LEGACY_EQUIPMENT_ITEMS` / `LEGACY_EQUIPMENT_SLOTS`; v1 contract tests alias those; fixture recipe bodies were not rewritten, only generation notes and source hashes.
- `decodeMigratingAppearance` only retries `UNSUPPORTED_SCHEMA` / `UNSUPPORTED_CATALOG` after the bounded decoder; unknown catalogues stay on disk; `saveAppearance` still copies those bytes to the recovery key.
- `DEFAULT_BOOT_GEAR.shoulders` is `null`; `preloadStarterCharacter` does not fetch `wardenPauldrons`; default compact startup does not request the shape family.
- Streamed Human/Orc/Undead manifests declare per-race `wardenPauldrons` fits; `assertAssetFit` still guards prepare.
- Coverage seam names (`shoulder` vs catalogue `shoulders`) follow the existing wrist/wrists split; parent coverage tests are treated as already corrected.
- Presence allowlist `shoulders:null` is treated as already corrected.
- Exact IBM/TRS/mesh-frame copy after `normalizeHumanBind` is treated as already corrected.

## Pending (not evidenced here)

Live Armory/gameplay review, FPS, remote shoulder swaps, and the five-design factory. Orc/Undead native plate appearance remains an open factory defect, not a pass.
