# M005 — Body and garment deformation proof

Status: **implemented and measured, with the rigid element authored and the residual exceptions recorded**. Read the [M005 result](results/m005.md) before using these implementation instructions. Parent: [next ten](next-ten.md). Mandatory: [execution contract](execution-contract.md).

## Objective and scope

Make the garments follow the M004 shape family, prove a rigid element keeps its shape while cloth drapes, and measure what live shape editing costs against a committed cached shape.

Out of scope: a production fitter, a cloth simulator, a wardrobe expansion, the semantic coverage standard (M007), and any change to the shipped character or the Pages payload.

## Read first and reuse

Read the [M004 result](results/m004.md) and `scripts/character-assets/girth-field.mjs`, the equipment catalogue and contract, `equipment-stream.js`'s manifest verification and ownership rules, and `compose-loadout.js`'s rejection of morph targets on an offline composed fit.

Every Human garment is skinned to the same 65-joint rest skeleton in the same metre space as the body, verified by the M001 census. That is the fact the whole milestone rests on: one field defined in bone space applies to all of them.

## Implementation slices

- **M005a — refit the cloth.** Give each garment the same two targets the body has, in the same order, so one weight vector drives the whole outfit. Prove neutral identity per piece against the shipped garment. Compare candidate fitting rules on the same measurement rather than asserting one is right.
- **M005b — author the rigid element.** The catalogue has none. Author one bounded prototype on the same rig, weighted so it is carried rigidly, and keep it out of `public/` and out of the production catalogue.
- **M005c — measure, do not eyeball.** A plate has two ways to bend: under animation, and under the fit. Test both exactly. Use a cloth garment as the control; a measurement that says cloth is rigid is broken.
- **M005d — live.** Serve the refitted pack to the real streamed equipment path, with its byte-length and SHA-256 checks intact. Assert that a piece equipped *after* the shape was applied is shaped too, and that a failed or cancelled request leaves the committed appearance alone.
- **M005e — cost.** Measure resident morph payload, the frame cost of sweeping weights every frame, and the CPU and upload cost of baking a committed shape.

## Hard rules

The default route stays unchanged: no shape control in the query means `resolveHumanShape` answers `null`, and the refitted pack is requested only when a target is actually driven.

Hard plates must not bend like cloth. A uniform scale is not bending — it is the same object at a different size, which is what armour sizing is — but any non-uniform deformation of a plate is a failure.

Do not add the prototype to the production catalogue or ship its asset in `public/`.

Neutral identity is per piece and is proved by hashing geometry and bind, never by file hash.

## Exit

Consistent body and garment change across the tested matrix, the remaining penetration measured and named rather than described, the plate proved rigid on both axes with a cloth control, preparation and runtime cost measured, and reviewed live motion delivered under the existing Telegram procedure.
