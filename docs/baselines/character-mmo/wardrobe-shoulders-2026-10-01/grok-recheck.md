# Shoulder checkpoint recheck

Read current source, descriptor, provenance, pack manifests and `docs/plans/character-mmo/results/wardrobe-shoulders-2026-10-01.md`. No tests, renderers or live play. Open M6 exits (two more complete designs, remote armor, remaining fit defects, public host, physical phone) are named limitations, not findings. No milestone acceptance.

## Prior findings — verified in current files

**Compiler pin, descriptor, fit, material, provenance.** `blender/characters/wardrobe/warden-pauldrons.json` declares slot/layer/occupancy, `deformation: rigid-bone`, `blenderVersion: 5.2.1`, per-race source SHA-256 and fit interface, material revision, and `detail.compact: same-rigid-geometry`. `prepare-warden-pauldrons.mjs:21-27` rejects descriptor/catalogue mismatch and a Blender `--version` that does not start with `Blender ${descriptor.blenderVersion} `; `:31` uses `assertAssetFit`; `:57-60` checks exported metallic-roughness against the descriptor; `:71-74` writes hashed immutable GLBs before any manifest. Provenance records descriptor hash, compiler/helper SHA-256, material/detail/corrective, and the three advertised prefixes (`30914318b15c` / `0eeed07f0db4` / `48130ebf8564`).

**Compact rigid geometry.** `prepare-production-human-shapes.mjs:61` copies `manifest.items[id]` into `compactItems` when `deformation==='rigid-bone'`. `human-shape-v1/` contains `wardenPauldrons-3daf20061e0e.bin` and no `*-compact-*` plate file; cloth items still have separate compact bins.

**Legacy appearance migration.** `contract.js:22-25,40-43,133-142` freeze seven-slot v1/v2 registries and add only `shoulders:null`. `codec.js:25-34` retries solely `UNSUPPORTED_SCHEMA` / `UNSUPPORTED_CATALOG` after the bounded decoder. `protocol.js:21-41` requires `shoulders:null` on both presence fits.

**Preloaded validation before mutation.** `equipment.js:10` binds `LEGACY_EQUIPMENT_ITEMS`. `selected` includes `shoulders:null` (`:37`). `setLoadout` (`:42`) runs `validateEquipmentSelection(next, EQUIPMENT_ITEMS, EQUIPMENT_SLOTS)` before `Object.assign`. `wardenPauldrons` is absent from the legacy item map, so the call throws without mutating.

**Independent armor vs cloth builders.** `prepare-human-equipment.mjs:18`, `prepare-orc-equipment.mjs:16`, `prepare-undead-equipment.mjs:22` and `split-equipment.mjs` consume `LEGACY_EQUIPMENT_ITEMS`. Armor emission is `prepare-warden-pauldrons.mjs`.

**Orc deltoid regions.** `build_warden_pauldrons.py:56` joins `BodyExposed` and `BodyUnderTunic` when `BODY_MESH=='BodyExposed'`. Restricting the join to `BodyExposed` alone is not supported by this source.

Starter `wardenPauldrons` advertisement is present; that earlier missing-manifest claim is not restated.

## Consequential defects

None substantiated on this pass against the checkpoint claims above.

## Remaining limitations

Milestone 6 is still open per the result: two further complete designs, remote per-piece admission, remaining cloth/head fit defects, public hosting and physical-phone checks. `prepare-undead-provisional.mjs:147` still walks full `EQUIPMENT_ITEMS` (including `parts` on `wardenPauldrons`); live `UNDEAD_PACK_DIR` is `equipment-undead`, so this is an unused diagnostic footgun, not a play-path failure. Parent owns test and live verification.
