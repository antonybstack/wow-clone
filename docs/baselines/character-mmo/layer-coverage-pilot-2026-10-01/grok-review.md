# Conservative layer coverage pilot — independent review

Reviewer: Grok 4.6. Scope: uncommitted partition/runtime/harness plus `.cache/character-mmo/coverage-pilot/report.json` and the three named capture reports. No product edits, browser, agents, or GLB re-parse in this pass. Parent later passed corrupt optional load, last-request wins, and restoration live. Visual stills were not opened here; different cameras/backgrounds/animations forbid pixelwise inference.

## Summary

The offline partition is a conservative index split: each source triangle is copied once with original winding, attributes stay shared, and a nonempty exposed/covered pair is required before mutation. Runtime garment hiding is an explicit region mask on top of the existing streamed visibility commit, fail-closed when a declared coverage mesh is absent. Production manifests, Pages assets, and the default startup graph do not advertise the `.cache` binaries. `garment-layer-coverage.js` is imported by `equipment-stream.js` but stays inert unless a caller passes rules; that caller is DEV-only.

No demonstrated consequential product bug turned up in the inspected code after the parent live checks. The remaining work is missing acceptance, not a broken union/restore/default path. Designs and M6 stay unaccepted.

## Demonstrated issues

None at bug severity. The items below are the actionable follow-ups, capped at five.

### 1 — Severity: suggestion (accepted as candidate-only)

- File: `src/ashen-reach/main.js:120-128` and `scripts/character-assets/check-wardrobe-design-audition.mjs:15-16,43,52`
- Description: `coveragePilot=layers-v1` remaps Human/Undead **bodies** to `/__coverage_pilot__/{human,undead}.glb` and attaches `garmentLayerCoverage`, but it does not point catalogue trousers/skirt URLs at the partitioned files. Those URLs are injected only by the wardrobe audition harness. A naked `?creator=1&coveragePilot=layers-v1` boots into `Missing garment coverage part` (`equipment-stream.js:229-230`) the first time legs load. That is fail-closed and matches “do not advertise these assets.” It is not a self-contained developer switch as plan item 3 described.
- Suggestion: Keep harness injection for the candidate, or remap `manifest.items` for the five partitioned garments inside the DEV branch the same way the body URL is remapped. Do not put the files in `public/`.
- Status: accepted as bounded developer-only / candidate-only

### 2 — Severity: suggestion

- File: `src/ashen-reach/main.js:352` and `365-366`
- Description: `HumanTorsoCore` / `UndeadTorsoCore` are registered as `['torso.lower']` only. The classifier (`prepare-coverage-pilot.mjs:21-24`) keeps triangles whose vertices sit between `hips.y - 0.15*unit` and `neck.y - 0.095*unit` with >0.98 mass on Hips/Spine/Spine1/Spine2/UpLegs — a hips-to-neck torso mass, including chest. Current tunics all cover `torso.lower` (semantic `covers` or legacy `BodyUnderTunic`), so the core hides for Wayfarer/Pilgrim/Graveweaver tops. A later cropped top that covers only `torso.upper` would leave this core drawn; a sash that covers only `torso.lower` would hide chest triangles. `HumanV1Body` / `UndeadV1Body` still list every original segment, so the exposed remainder never hides. That is the stated premise (“exposed boundary skin still carries the original segments”).
- Suggestion: If the mass is chest+abdomen, list `torso.upper` and `torso.lower` on the core, or shrink the classifier to abdomen. Do not change it for this catalogue if the current tunics are the only consumers.
- Status: accepted for catalogue v3 tunics; record before a cropped torso exists

### 3 — Severity: suggestion

- File: `scripts/test-coverage-partition.mjs:9-15` and `scripts/character-assets/prepare-coverage-pilot.mjs:26-29`
- Description: The unit fixture proves disjoint triples, original winding, shared POSITION, shared morph target object, and copied node TRS/weights. The prepare read-back proves that **after write**, covered primitives share base and morph accessors with some exposed primitive. Neither asserts, on the **written** seven GLBs: exact triangle-set union equals the source index list; JOINTS_0 / WEIGHTS_0 / UV / NORMAL identity; inverse-bind identity; sibling node parent + world TRS + skin pointer; animation channels still target joints only. `clips: 57` in `report.json` is a count, not channel-target ownership. The dressed Lector stills hide `*TorsoCore` (`torso.lower` covered by Pilgrim/Lector), so they cannot show a morph-weight miss on the body core.
- Suggestion: After `writeBinary`, compare sorted `(i,j,k)` triples and accessor identities against the source bytes for every row in `report.json`. Walk Lite/`body.root` and assert both coverage meshes receive creator weights.
- Status: open (missing proof, not a failing observation)

### 4 — Severity: suggestion

- File: `scripts/character-assets/prepare-coverage-pilot.mjs:36-38`
- Description: Body cores transform joint origins into **mesh-local** space (`prepare-coverage-pilot.mjs:16-17`). Garment cores compare garment `POSITION` y/z to **another document’s** hip world-matrix translation (`hips[13]`, `hips[14]`) from `public/ashen-reach/equipment[-race]/body.glb`, including Human landmarks from the unshaped pack while the trousers file is `human-shape-v1`. This is a different frame path, not automatic proof of a unit-scale error. Empty-or-full masks throw (`partition-coverage-mesh.mjs:28`). Written splits are proper subsets (`report.json`: Human trousers 323/2260, Orc 456/2260, Undead 306/2260; Human body 414/5325, Undead body 1352/8741), so the predicate is in range on these files. Per-race topology is real: counts differ, Human `graveweaverSkirt` is skipped (`prepare-coverage-pilot.mjs:35`, `coverage-pilot.js:12`).
- Suggestion: Classify garments with the same mesh-local joint origin as the body, using the same source file the garment was fitted on. Keep the nonempty-split guard.
- Status: open as a robustness change; not a demonstrated 100×-unit defect

### 5 — Severity: suggestion

- File: `src/ashen-reach/equipment-stream.js:27,51,84,229-230,309`
- Description: Production streamed equipment always contains the new resolver. Default `garmentLayerCoverage` is null, so `packVisibility` and `prepare` behave as before. Vite serves binaries only from `configureServer` (`vite.config.js:125`), not preview or `public/`. Dynamic `coverage-pilot.js` loads only when `import.meta.env.DEV` and `layers-v1`. That meets “no advertised assets.” The production JS graph is not byte-identical to pre-pilot equipment-stream. No FPS or load claim is made; none is reviewed.
- Suggestion: Leave the inert import if the next commit keeps the option off in production `main.js`. If publication is refused, a DEV-only dynamic import would keep the resolver out of the default chunk.
- Status: accepted as bounded while rules are never passed in production

## Accepted premises

- Candidate-only: `.cache` outputs, `visualAccepted: false`, `coverageRevision: body-v1-candidate`, temporary Lector aliases, M6/designs unpublished.
- Conservative triangle rule: hide iff every vertex is covered; mixed boundary triangles stay exposed (`partition-coverage-mesh.mjs:21-23`).
- Shared mesh-name union is OR of the **selected** item (`garment-layer-coverage.js:26-27`); inactive `graveweaverSkirt` / `wayfarerTrousers` cannot override. Tested in `scripts/test-garment-layer-coverage.mjs:16-18`.
- Missing coverage mesh rejects the item (`equipment-stream.js:229-230`) before skeleton borrow.
- Human robe trousers are not split; Orc body keeps existing physical geosets; Orc/Undead share the trousers-under-torso vocabulary.
- Morph-weight **node** animation is refused (`partition-coverage-mesh.mjs:12`); Mixamo motion stays on joints; sibling copies skin + TRS + weights (`partition-coverage-mesh.mjs:41-45`).
- Parent live checks: corrupt optional load, last-request wins, unequip/restore. Cancellation/disposal follow the existing `owned` / `stopped` / `releasePalette` path; the new throw sits with the old missing-part throw, before `addToScene`.
- `HumanV1Body` still carries all segments so a tunic cannot hide the fused remainder (`coverage-contract.js:176-194` + main.js spread).

## Missing acceptance (not demonstrated bugs)

- Native re-parse of the seven written GLBs for triangle union, winding, IBM/skin/UV/morph accessor identity, and sibling parent/world (prepare claims share-after-write; this review did not reopen the binaries).
- Creator morph weights applied to `HumanTorsoCore` / `UndeadTorsoCore` while those meshes are **visible** (bare torso). Dressed Pilgrim/Lector hides them.
- Equipment-stream unit tests for missing coverage part, `apply()` mask on `WayfarerTrousersUnderTorso`, failed fetch, and disposal. Parent covered the live side.
- Plan item 3 matrix: bare / mixed torso-legs, Orc, height 0.90, slender, sword/turn/land, both parts visible as a union check under motion. Captures are defect-focus Human stout 0.95/1.15 and Undead 0/1, front/back run/fire.
- Shadow membership of the new body mesh when visible (local lights already skip `visible===false`; dressed captures hide the core).
- Independent visual judgment of `ve-capture/character-mmo/coverage-layers-pilot-2026-10-01` versus `lector-source-fit-limit-v2-2026-10-01` and `coverage-body-pilot-v3-2026-10-01`. All three reports set `visualAcceptance: "requires parent review"`, same Lector-as-`pilgrimTunic` + Wayfarer legs/boots loadout, `runtimePassed: true`, recoveries 0. Layers `candidateRequests` lists only Lector tunic URLs; trousers remaps would not appear there even if served.

## Written assets (from `report.json`)

| Row | Covered / original tris | Bytes |
|---|---|---|
| human body | 414 / 5325 | 1 912 288 |
| undead body | 1352 / 8741 | 8 371 244 |
| human wayfarerTrousers | 323 / 2260 | 160 232 |
| orc wayfarerTrousers | 456 / 2260 | 210 504 |
| orc graveweaverSkirt | 454 / 2260 | 520 116 |
| undead wayfarerTrousers | 306 / 2260 | 146 772 |
| undead graveweaverSkirt | 309 / 2260 | 372 184 |

Joints 65 and clips 57 on both body rows. `vertexReindexing: false` on every row. No human graveweaverSkirt row.

## Bounds

This is a developer audition: original masters unchanged, catalogue v3 frozen, no production publication, no FPS/load claim. Index union at rest does not prove hidden-part coverage under motion. Live stills are review aids for the parent; they are not acceptance in this file.
