# M004 — Canonical Human template

Status: **implemented and reviewed, with the garment consequence measured and handed to M005**. Read the [M004 result](results/m004.md) before using these implementation instructions. Parent: [next ten](next-ten.md). Mandatory: [execution contract](execution-contract.md).

## Objective and scope

Establish the Human body that every later customization milestone builds on: one named source with recorded rationale, a shape family of neutral, slender and stout that keeps exact vertex correspondence, a uniform height range that the existing gameplay capsule already accepts, a reproducible export, and reviewed motion at every endpoint.

Out of scope: garment refitting, face or age variation, hair, dyes, crowd representation, per-instance arbitrary sliders, and any change to the shipped character or the Pages payload. The deliverable is a developer candidate behind an explicit query, not a production body swap.

## Entry gate: name the source

The [M001 source-readiness table](results/m001.md) is the gate. Either name the exact editable source and its licence, or complete a bounded source-authoring task first. Do not begin shape work against an unnamed source, and do not treat an independently generated mesh as a morph target of the current body.

## Read first and reuse

Read the M001 census, the M002 contract, `src/character/body.js`, `src/character/runtime/body-visual.js`, `src/character/sockets.js`, `src/player.js` (`resolveCapsule`, `setHeightScale`), `src/camera-rig.js`, and `src/ashen-reach/main.js`'s body and equipment wiring. Use the installed `@babylonjs/lite/index.d.ts` and the matching `lib/` source for exact native APIs, and glTF Transform for asset work.

Verified native capabilities in Lite 1.31.1:

- `createMorphTargets` / `setMorphTargetWeights`: morph deltas as a read-only storage buffer plus a weights buffer.
- The glTF loader's `_morph` feature reads POSITION and NORMAL targets only. TANGENT targets are dropped.
- `MORPH_PRE_SKINNING` writes `morphedPos`/`morphedNorm` in the vertex `VR` slot, *before* skinning, so a morphed body still deforms with the existing palette and clips.
- `player.setHeightScale` already reshapes the Havok capsule through `controller.setShapeOptions` and clamps to [0.9, 1.15].

Verify each of these in source before relying on it. Availability is not composition: M003 found that a native path every one of whose APIs existed still failed to compose with the town's custom cascaded-shadow caster.

## Implementation slices

- **M004a — source decision.** Compare reusing the current authored Human source against a template derived from it. Record topology, deformation behaviour, licence and editability for each, and choose one with the rationale written down. A failed comparison produces a source-art dependency report, not placeholder anatomy.
- **M004b — shape family.** Produce neutral, slender and stout with identical vertex count and order, identical joint centres, identical inverse binds and identical clips. Prove neutral identity by hashing the base attributes and the bind against the shipped body, never by file hash. Export reproducibly from a committed script.
- **M004c — height.** Establish the safe uniform height range under the existing gameplay capsule. The capsule keeps collision authority; the visual follows it. Camera pivot and sockets must follow visual height. Reject or record unsafe extremes rather than widening the clamp.
- **M004d — live proof.** Run every shape and both height endpoints through the real route: morph weights reaching the GPU mesh, Havok driving the character, movement under real input, and no shader-composition failure in the town's caster path. Review actual motion for idle, walk, run, jump and land, and both spells.
- **M004e — consequences.** Measure, do not describe, what the shape family does to the existing garments, and hand the number to M005.

## Hard rules

The default route must be unchanged. `resolveHumanShape` answers `null` for any URL that does not name a shape control, the candidate module stays out of the startup import graph, and the candidate GLB lives under `.cache/`, never `public/`.

Joint centres do not move. Scaling only the components perpendicular to each bone axis keeps every joint position, every inverse bind and the existing animation valid. A shape that moves a joint is a retarget, and needs new inverse binds and contact validation — out of scope here.

Do not extend the M002 appearance recipe. Its `shape` object stays empty until M006 ships the migration fixtures; a silent new field changes the meaning of every stored recipe.

No arbitrary ellipsoid muscle warp, no runtime wrap engine, and no MakeHuman bind data substituted for the current one.

## Exit

Anatomy and silhouette accepted from reviewed live motion, exact neutral compatibility established by hash, supported shape and height ranges documented with their measured limits, capability metadata that advertises only what was delivered, and the garment consequence measured. A reviewed live MP4 is delivered under the existing Telegram procedure.
