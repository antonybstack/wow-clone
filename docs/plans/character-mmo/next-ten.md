# Next ten milestones — customization and crowd proof

Status: **M001–M004 complete with inherited findings; M005 next**. Read the [100-milestone vision](vision-roadmap.md), [architecture](architecture.md) and [execution contract](execution-contract.md). Baseline evidence always identifies the actual HEAD and live assets.

## Sequence and risk ordering

M001 establishes truth; M002 establishes a small data boundary; M003 tests crowd cost before body/wardrobe production. M004–M008 prove the user's character and mixed-outfit examples. M009 integrates rendering/streaming lessons. M010 is the architecture acceptance gate before expanding to 30 sets.

M001 → M002 → M003 → M004 → M005 → M006 → M007 → M008 → M009 → M010.

This ordering intentionally puts a bounded crowd experiment before bulk customization art. It avoids discovering after 180+ pieces that the chosen rig/material/shape strategy cannot support the population target. There is no calendar estimate until the M003 findings and M004 authoring proof establish scope.

## M001 — Asset census and baseline

**Dependency:** current checkout and production evidence. **Brief:** [implementation steps](m001-baseline-and-asset-census.md).

Deliver a deterministic inventory of actual startup/full Human, Orc, Undead, garments, animation, binds and ownership; a fresh isolated baseline; reviewed current-character motion; and a reuse/gap map. Do not replace assets or fix unrelated character art. Record inherited fit issues rather than labelling existing content perfect. Output under `docs/baselines/character-mmo/m001/` plus a concise result report. Exit: every active asset traced, meaningful compatibility mismatches distinguished from harmless animation/hash differences, no contaminated benchmark accepted. A missing local source is an explicit blocker for rebuilding that asset, not permission to regenerate an unrelated substitute.

## M002 — Appearance recipe and compatibility contract

**Dependency:** accepted M001 census. **Brief:** [implementation steps](m002-appearance-contract.md).

Implement a small pure descriptor/validator/codec for existing appearances, with stable versions, explicit supported capability declarations, deterministic serialization/cache keys and a read-only adapter from current race/loadout state. Reuse equipment validation. No body sliders are advertised yet, no save-server backend, and no parallel equipment loader. Exit: current loadouts round-trip, invalid/unknown data fails predictably, semantic keys do not change when object property order changes, and the gameplay/startup path has no added appearance-system dependency. A pure fixture claiming an unsupported Human morph is not completion.

## M003 — Native crowd feasibility prototype

**Dependency:** M001 measurement protocol and M002 recipes. **Brief:** [implementation steps](m003-crowd-feasibility.md).

Build a separately imported developer probe using existing assets. Measure identical and varied populations at 100/300/1,000; compare independent animation with a compatible native baked/instanced path. Check full body + actual visible equipment, attachments, shadows, teardown and asynchronous churn. Execute M003a (one/ten dressed actors and ownership/shadow proof), M003b (repeated-outfit population curves), then M003c (bounded mixed-outfit proof or concrete blocker), using the gates in its brief. Exit is an evidence-backed architecture decision, including a negative result where appropriate. Do not hide failed high counts, substitute 1,000 invisible actors, or require production deployment. M004 can proceed after a negative M003 only when the report states a feasible alternative and revises the assumptions/budgets.

## M004 — Canonical Human template

Status: **complete**. Brief: [implementation steps](m004-human-template.md). Result: [M004](results/m004.md).

**Dependency:** M003 fit/animation constraints. **Inputs:** M001 real source inventory, approved Human references in `docs/references/human/`, current source-65 animation and equipment.

Compare reuse of the current authored Human source against a template derived from it; identify topology, deformation, license and editability constraints. Select a source with a recorded rationale. Produce neutral, slender and stout body shapes, a tested minimum/maximum uniform height, stable vertex correspondence within the family, source rig compatibility, and a reproducible export. Use an isolated Blender process/file. Do not revive rejected arbitrary ellipsoid muscle warps or call independently generated meshes morph targets.

The M001 source-readiness table is an entry gate: name the exact editable source/license, or complete a bounded source-authoring task before any slider implementation.

Deliver an explicit fit-profile version and source project, provenance, candidate GLB, capability metadata, and three-body motion evidence. Test shape endpoints and combined height extremes through idle, walk, run, jump/land and spells. Define safe visual height limits under the existing gameplay capsule; reject unsafe extremes or record a separate future physics decision. Camera and sockets must follow visual height while collision authority remains coherent. Exit: anatomy/silhouette and motion accepted, exact neutral compatibility established, supported ranges documented. A failed source comparison produces a source-art dependency report, not fake placeholder anatomy.

## M005 — Body and garment deformation proof

**Dependency:** M004. Select two structurally contrasting outfits from available licensed sources; include a soft garment and a rigid-armor element. If the catalogue lacks a suitable rigid element, author one bounded prototype rather than claiming a textured tunic proves plate articulation.

Map the body controls to each garment's shape deltas/reference fits, preserve inverse binds and mesh frame, implement minimum coverage semantics needed by this slice, and keep hard plates from bending like cloth. Compare live morphing while editing with cached shape preparation after commit, using M003 constraints. Candidate uploads must be scheduled and cancellations safe. Review minimum/default/maximum shapes plus combined height/body extremes in motion, front/side/back and normal camera. Exit: consistent body/garment changes, no known penetration in the tested matrix, honest exceptions, and measured preparation/runtime memory. Do not build the full production fitter or cloth simulator.

## M006 — Human creator vertical slice

**Dependency:** M005 and named editable Human, age and long-hair source assets. If those sources are absent, first author the minimal licensed variants and record their provenance; a JSON capability flag is not a visual substitute. Add a lazily loaded creator surface reusing the armory/camera infrastructure where suitable. Implement only proven controls: height, body shape, adult age appearance, skin/hair color and at least long hair versus bald. Add a small authored face/age variant if needed to make the two user examples visibly distinct; skin tint alone does not prove aging.

Persist a versioned local recipe with undo/reset, visible loading/errors and race capability filtering. Extend M002 via explicit migration only when actual assets exist. Keep exact default starter appearance and cold-play behavior; creator entry is a separate payload. Show both user example characters entering gameplay, equipping both outfits and returning to the creator with state retained. Exit: saved/restored visual equivalence and input/device usability, not merely working sliders. Long hair must have a helmet/cape interaction policy; no requirement for expensive hair simulation.

## M007 — Mixed equipment fit proof

**Dependency:** M005/M006. Introduce semantic coverage and seam IDs with adapters for legacy meshes; migrate the proof outfits before broad catalogue changes. Verify cross-set torso/legs/boots/gloves/head combinations and both one/two-handed occupancy. Include no-helmet/no-gloves states, short versus tall cuffs where assets exist, and hair under headwear. Use exhaustive rule tests plus pairwise boundary/body extremes and selected three-way conflicts. Record each exception as data with a reason.

Exit: independently mixed pieces stay coherent through all accepted body settings and reviewed gameplay motion; failed requests and rapid swaps preserve the last committed appearance. This is a bounded representative proof, not acceptance of 30 sets or every theoretical combination.

## M008 — Race extensibility proof

**Dependency:** M007. Create explicit family/capability adapters for current Undead and a minimal licensed Elf candidate; retain current Orc. Missing Elf source is an explicit asset dependency, not permission to advertise an unsupported race. The Elf has an authored approved silhouette and ears rather than merely relabelling Human. Verify whether Human/Elf can share selected garment assets by actual topology/frame/bind/fit evidence. Refit both proof outfits where needed and expose only verified race controls; Human aging/hair controls need not apply to skull Undead.

Exit: one logical outfit recipe resolves to correct family-specific assets; race switches survive failure/cancellation; Human/Orc/Undead regressions pass; Elf/Undead mixed outfits and movement are reviewed. No silent fallback to Human fits. Production anatomy/hair libraries remain M011–M020.

## M009 — Representation and streaming proof

**Dependency:** M003 costs and M008 real shape/race variation. Implement the smallest measured combination of exact/standard/crowd detail, resource pooling, prioritization and coarse shape approximation. Choose batching keys from real bind/material/layout compatibility. Support per-character outfit composition without baking every full combination. Promote local/target actors, maintain animation phase/identity through transitions, apply hysteresis and cap simultaneous promotions/uploads.

Measure 100/300/1,000 seeded varied actors in a diagnostic scene and the actual hub, including cold appearance arrivals, mass swaps and repeated teardown. Separate presence, visible, animated and detailed counts. Disable/cap shadows/effects only as a declared quality tier. Exit: capacity and memory curves show a bounded working tier on each tested device, and normal solo/startup gates remain green. Population or quality limits are a valid result; reporting a fully detailed 1,000-player guarantee without evidence is not.

## M010 — Architecture acceptance and release gate

**Dependency:** M001–M009 reports. Produce an end-to-end demo of both Human examples, race switches, mixed equipment, creator persistence and a varied crowd. Review live motion, clipping matrix, actual fit limitations, CPU/GPU/memory/network data, and physical-device results or explicit pending status.

Choose the production schema/fit/material/animation/detail contracts; list deferred decisions and ownership. Revise milestones M011–M100 from measured constraints. Require 144+ mean FPS on the established solo desktop profile and the cold-start percentile gate; define a separate crowd count/quality/device acceptance table from measured results. Do not set a population promise by extrapolating the solo benchmark. Run all touched gameplay/mobile/resource checks, commit and push. Release accepted runtime behavior only through the existing deployment/rollback verification procedure; diagnostic probes remain optional/lazy. Exit: a measured production foundation and an actionable content budget, not a finished MMORPG.

## Results ledger

| Milestone | Status | Evidence |
| --- | --- | --- |
| M001 | Complete; active Undead bind mismatch documented | [Result and baseline](results/m001.md) |
| M002 | Complete; no startup import change | [Result and seeded recipes](results/m002.md) |
| M003 | Complete feasibility probe; native VAT promising in isolation, actual-town shadow integration blocked | [Result, capacity curves and reviewed motion](results/m003.md) |
| M004 | Complete; shape family and height range proven, garment fit measured and handed to M005 | [Result, shape family and reviewed motion](results/m004.md) |
| M005 | Planned | — |
| M006 | Planned | — |
| M007 | Planned | — |
| M008 | Planned | — |
| M009 | Planned | — |
| M010 | Planned | — |
