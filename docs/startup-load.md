# Progressive startup — current lifecycle

Current release evidence: [2026-09-27 implementation and production verification](complete/2026-09/one-second-startup-implementation-2026-09-27.md). Read [CURRENT](CURRENT.md) before assuming a source asset or ordering from an older report remains active.

## Playable boundary

The normal fast-start route presents a compact dressed Human and nearby terrain/collision first. Havok, grounded state, the dressed player, a completed GPU frame, overlay removal and enabled input define playable readiness. Remaining finite-region geometry/details and character textures arrive in bounded background work behind a physical loading frontier. Full-region completion is a separate metric.

Primary code: `src/ashen-reach/main.js`, `starter-world.js`, `startup-assets.js`, `startup-trace.js`, and the equipment loader/stream. The main-route packs select actual Human/Orc/Undead manifests. Do not infer active source meshes from old profile labels.

## Reproducible assets and measurements

`scripts/ashen-reach/prepare-starter-character.mjs` derives compact assets from the current Human equipment body and selected starter clothes. It preserves geometry/bind/animation and prepares smaller initial textures with deferred full texture URLs. `prepare-starter-world.mjs` builds deterministic nearby/region payloads. Existing provenance/hash validation guards stale prepared assets.

Use `npm run prepare:startup` only when an intended source/preparation change requires rebuilding; it is not a routine prerequisite for a documentation or contract change. Read each script's current imports and source files before running it.

Use `probe-playable-startup.mjs` with the compressed production-build preview for cold timing, and `measure-region-fps.mjs` on an isolated uncapped browser for settled throughput. These are different experiments. Follow [browser ownership and capture](debug-view.md) and the [new milestone execution contract](plans/character-mmo/execution-contract.md).

The accepted 50 Mbit/s / 40 ms production batch achieved p95 979.4 ms, 19/20 <=1 second, maximum 1,054.5 ms. Physical iPhone startup/memory and crowded-city appearance convergence remain unmeasured. The new character initiative must keep creator/probe/full-wardrobe imports off the initial play path.

## Historical notes

The [previous startup document](archive/state/startup-load-before-character-vision-2026-09-27.md) preserves older texture optimization and whole-world overlay assumptions. It is useful lineage, not the current readiness contract.
