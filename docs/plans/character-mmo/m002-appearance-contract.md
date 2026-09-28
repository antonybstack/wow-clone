# M002 — Versioned appearance recipe and compatibility contract

Status: **complete**. [Implementation and verification result](results/m002.md). Parent: [next ten](next-ten.md). Mandatory: [execution contract](execution-contract.md).

## Objective

Represent an existing playable appearance as small, deterministic, validated data that future creator, networking and crowd paths can share. Ship a pure contract and read-only adapter; keep current gameplay rendering and persistence behavior unchanged. This milestone does not implement new body shapes, creator UI, outfit transaction orchestration or a backend.

## Inputs and source boundary

Read the M001 census/result, `equipment-contract.js`, `equipment-catalog.js`, main-route `packs` and race state, `equipment-stream.js`'s getState/getStatus behavior, and existing equipment tests. Current older `src/character/runtime/body-profile.js` entries include diagnostic placeholders; do not mistake their declared morph keys for shipped asset capabilities. Preserve existing fit IDs and slot semantics.

Proposed new files:

- `src/character/appearance/contract.js`: schema validation/normalization and supported profiles.
- `src/character/appearance/codec.js`: deterministic encode/decode/key construction.
- `src/character/appearance/from-equipment.js`: pure adapter taking explicit current state; no global ASHEN imports.
- `scripts/test-appearance-contract.mjs` and small fixtures under `scripts/fixtures/appearance/`.
- `docs/plans/character-mmo/results/m002.md` and machine-readable fixture manifest if useful.

Add exports only where used by tests or explicit developer probes; keep these modules out of default gameplay imports until a later milestone needs them. Do not add a schema library or a new global manager for this small contract.

## Concrete version-1 shape

This is a proposed contract to implement after reconciling M001 findings. Use actual existing item/profile identities in fixtures.

```json
{
  "schemaVersion": 1,
  "catalogVersion": "appearance-catalog-v1",
  "race": "human",
  "fitFamily": "ashen-human",
  "fit": {"rig": "source-65", "bind": 1, "shape": 1},
  "shape": {},
  "components": {},
  "dyes": {},
  "equipment": {
    "helmet": null,
    "torso": "wayfarerTunic",
    "legs": "wayfarerTrousers",
    "boots": "wayfarerBoots",
    "gloves": null,
    "mainHand": "ironSword",
    "offHand": null
  }
}
```

`shape`, `components` and `dyes` are empty in the current v1 production capability set unless M001 proves an existing supported setting. Their presence reserves structure, not feature support. The future creator adds supported values with documented versioning. Do not silently accept height/fullness/age/hair that the current meshes cannot honor.

For v1, `fitFamily` deliberately means the equipment fit-family ID: `FITS_BY_RACE[race].body` (`ashen-human`, `ashen-orc`, `ashen-undead`). It does **not** mean `BODY_PROFILES` diagnostic IDs or the manifest source-asset `profileId` such as `human-tripo-v1`. M001 records that source profile separately. Do not make these namespaces interchangeable. The name `fitFamily` is fixed here before v1 implementation to avoid conflating it with existing diagnostic/source profile namespaces.

`catalogVersion` versions the published identity/parameter vocabulary. Asset byte revisions remain manifest metadata; animation-only byte changes must not invalidate a fit. Cosmetic item IDs describe appearance; server entitlement and gameplay stats are out of scope. Race/fitFamily/fit must agree with actual registered capabilities.

## Proposed API and behavior

- `validateAppearance(input, registry)` returns a normalized deeply immutable recipe or throws a typed error with stable `code` and field `path`.
- `encodeAppearance(recipe, registry)` returns deterministic UTF-8 JSON text; decode validates before use.
- `decodeAppearance(text, registry)` validates a string length/byte bound before parsing and rejects invalid JSON or unsupported schema versions.
- `appearanceKey(recipe, registry)` returns deterministic canonical semantic content or a collision-resistant hash of it. Cache users must include relevant asset/detail revisions in their own derived-resource keys; a recipe key alone cannot identify changed GPU assets.
- `appearanceFromEquipment({race, loadout}, registry)` constructs and validates a recipe from committed state. Pending selections are excluded. It must not apply anything to a live actor or fetch resources.

These are project API proposals, not Babylon Lite APIs. Keep functions pure and dependency direction one-way toward existing contracts. If catalog imports are necessary for the default registry, never import body.js/main.js or initialize the game from a contract test.

## Implementation steps

1. Freeze supported v1 profiles from M001 findings. Register only actual Human/Orc/Undead capabilities; Elf is unsupported until M008. Document unknown/missing versus supported-zero distinctions.
2. Reuse `validateEquipmentSelection` and `declaredFitForRace` rather than reproducing occupancy/fit logic. Validate complete loadouts: all current slots exactly once; explicit null for empty slots. The adapter can fill known empty slots from committed current state; the external descriptor validator rejects missing slots.
3. Reject unknown top-level/nested fields, unknown profiles/items/parameters, non-finite numbers, arrays in object positions, unexpected prototypes and forbidden keys (`__proto__`, `constructor`, `prototype`). Use own-property checks; do not merge untrusted objects into registries. A descriptor cannot contain URLs, file paths or executable data.
4. Define a v1 encoded size bound of **16 KiB UTF-8**, depth/field limits derived from the fixed schema, and controlled error messages that do not dump the whole input. This is a defensive parser bound, not a target network packet size. Measure actual fixture bytes in the report.
5. Canonicalize keys with fixed schema/slot order and sorted parameter IDs. No locale-dependent sorting or rounding of unsupported float controls. Because v1 lacks sliders, do not invent quantization; M004/M006 will define units, range, quantization and migrations for actual parameters.
6. Keep `catalogVersion` compatibility explicit. Unknown versions fail with a recoverable error; do not silently rewrite them to current. Add an empty version-dispatch structure only if needed for a clear unsupported-version error, not a speculative migration framework. An actual v2 migration gets real old/new fixtures later.
7. Build read-only state extraction without exposing a new always-loaded runtime feature. A developer probe may dynamically import the adapter after the game is ready and pass `ASHEN.equipment`'s verified race/state interface. Confirm the exact ASHEN property names in main.js. The probe must use the active game's module graph and not instantiate another Lite copy.
8. Test normalized equivalence and meaningful differences: each current race/preset; explicit empty slots; two-handed conflicts; mismatched race/bind; unknown fields/versions; extra unsupported morph; malformed JSON; oversize input; prototype keys; source-object mutation; different property order; same recipe with differing gear. Verify two different semantic recipes cannot share a tested cache key.
9. Run regression tests/build. Compare default gameplay import output: no new appearance module/payload is eagerly loaded. Spot-check live committed race/loadout extraction with existing armory actions and ensure animation, pending requests and selections are unchanged. No new visual acceptance is claimed from JSON round-trip alone.
10. Produce results and follow-up constraints for M003/M006. Close owned browser instances, commit/push and update milestone status. No deploy.

## Verification commands

```bash
node --test scripts/test-appearance-contract.mjs
npm run test:equipment
npm run test:character
npm run build
```

The first command names a new test to create. Inspect built default-route imports/resource requests rather than relying on hashed bundle filenames alone. If default runtime dependencies remain unchanged, do not repeat all twenty cold-start runs; if the implementation accidentally adds eager imports, remove them or run the full gate and explain why.

## Acceptance checklist

- [x] Exact current appearances serialize/deserialize deterministically through one schema.
- [x] Validation reuses equipment occupancy/fit rules and advertises no unimplemented body controls.
- [x] Complete normalized recipes are immutable; malformed/oversized/unsupported inputs fail with field-level errors.
- [x] Semantic identity is separate from asset bytes/detail tier; key scope is documented.
- [x] Read-only live adapter describes committed state and cannot mutate or fetch.
- [x] Character/equipment regressions and build pass; default startup import graph is unchanged.
- [x] M003 can use seeded recipes without knowing runtime equipment internals.
- [x] Results and owned-process cleanup recorded; task changes committed and pushed.

## Copyable handoff

Implement M002 only using `docs/plans/character-mmo/m002-appearance-contract.md` and its execution contract, after reading M001 results. Build the pure versioned recipe/validator/codec/read-only adapter with meaningful negative tests. Preserve current rendering, fit IDs, loader and startup import graph; do not add unsupported customization controls, apply recipes to actors or implement a server. Inspect live committed state, run the specified checks, record limitations, close owned renderers, commit and push. Stop with a precise dependency report if M001 compatibility evidence is missing.
