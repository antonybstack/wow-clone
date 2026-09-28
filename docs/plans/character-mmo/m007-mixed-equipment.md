# M007 — Mixed equipment fit proof

Status: **semantic coverage slice verified; fit acceptance open**. Read the [M007 result](results/m007.md) before using these instructions. Parent: [next ten](next-ten.md). Mandatory: [execution contract](execution-contract.md).

## Objective and scope

Replace coverage-by-mesh-name with a semantic vocabulary about the body, adapt each race's actual meshes onto it, and prove that independently mixed pieces stay coherent across every catalogue combination and through gameplay motion.

Out of scope: a wardrobe expansion, acceptance of 30 sets, any change to the shipped garments or body assets, and the body-source work M006 is blocked on.

## Read first

The M001 census — particularly its observation that coverage is authored in Human region names while the shipped Human body is one mesh. `equipment-catalog.js` for the current `coverage`/`parts` declarations, `equipment-contract.js` for the catalogue validator, and `equipment-stream.js` for how visibility is applied at runtime.

## Implementation slices

- **M007a — vocabulary.** Body segments and seams that name the body, not one race's mesh split. A legacy adapter so items may declare either while the migration runs.
- **M007b — race adapters.** What each race's body meshes carry, read out of the shipped `body.glb` rather than taken from the catalogue's own constants. A mesh may be hidden only when every segment it carries is covered.
- **M007c — migrate the proof outfits.** Wayfarer and Graveweaver declare both vocabularies, and a test asserts they mean the same thing. Do not migrate the whole catalogue in one step: a migration bug and a coverage bug would be indistinguishable.
- **M007d — exhaustive rules.** Every slot takes every item it accepts or nothing, resolved against every race. Occupancy checked independently of the validator so the two must agree.
- **M007e — live.** Predictions checked against what the engine actually draws, not against the model itself. Failed requests and rapid swaps must preserve the committed appearance.

## Hard rules

Exceptions are data. A declaration that cannot take effect is recorded with the reason it cannot, never dropped and never logged as a warning.

A mesh's `visible` flag is not proof it renders — an evicted mesh keeps it — so live checks require membership of `scene.meshes` too.

The adapter describes the shipped asset. If it disagrees with a catalogue constant, the asset wins and the disagreement is reported.

## Exit

Every catalogue combination resolves on every race without throwing, occupancy agrees with the validator on all of them, the live engine hides exactly what the resolver predicts, failed and superseded requests preserve the last committed appearance, and reviewed gameplay motion shows mixed pieces holding together.
