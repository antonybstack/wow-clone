# Human identity source review — 2026-10-04

Read-only file review for the parent resuming milestone 5. No renderer, Blender, builds, or product edits. Passing offline contracts are continuity evidence, not visual acceptance.

**Reuse the 2026-10-01 welded identity family.** `docs/plans/character-mmo/next-ten.md` §5 tasks 1–2 still describe the rejected separate-head cut (44° neck normals, fused-hair bald). That premise is historical. `docs/plans/character-mmo/results/identity-source-2026-10-01.md` already delivered a connected BMesh neck, complete bald scalp, separate ponytail, native colour bake, and the original 57 clips on the accepted 65-joint bind. Assets sit under ignored `.cache/character-mmo/identity-v1/`. `?humanHead=old-bald` (`src/ashen-reach/main.js` 104–114, 359–363; Vite `__human_head__`) is a different obsolete diagnostic.

Provenance still pins the M004 body used by current production shapes: `blender/characters/candidates/identity-v1/provenance.json` body sha `e8e564c9…` matches `.cache/character-mmo/identity-v1/canonical-body.json` and `public/ashen-reach/human-shape-v1/manifest.json` reproduction.

---

## 1. Neck topology, normals, UVs, weights, morphs

**Current, supported.** The weld is a new topology. Assembled painted bodies are 7038 (old) / 7211 (young) vertices against the M004/production 3274. `docs/baselines/character-mmo/identity-source-2026-10-01/source-contract.json`: 196 / 140 coincident neck split-groups, 855 samples each, `maxSplitM` 0, base and morph normal differences 0, clip duration delta 0, palette element ≤1.59e-5. Blender reports 102 / 82 shared neck vertices, 0 boundary, 0 non-manifold (`old-source.json`, `young-hair-source.json`).

How it is built:

- `scripts/character-assets/build-human-identity-source.py` 55–65, 135–165, 215–240: reconstruct logical surface, resample both loops by arc length, weld, smooth 148–155 cm carrying every shape layer, recalc normals.
- Head weights fade to `Head` by height (`:185–194`); joined body reduced to four influences (`:245–252`). Discarded mass `vertsDropGt01` is 0.
- `assemble-human-identity-source.mjs` 32–71 eases body/hair into the measured Head girth field above y=1.57 m; 73–92 dispose Blender actions and `copyToDocument` the original 57 M004 clips; 98–103 reject interleaved morph strides for Lite 1.31.1.
- `normalize-human-bind.mjs` restores joint order, mesh frame, and rest palette. Required before any garment borrows the live palette by index.
- `bake-human-identity-atlas.py` 75–80 samples the incident torso face by 3D adjacency. The earlier “first UV corner on the shared vert” defect in `docs/baselines/character-mmo/identity-source-2026-10-01/grok-followup.md` §3 is obsolete in current code. A nape/side mark may still be visible; that is a live call.

**Open geometry/shading issues the contract does not cover.** Eyes (`HumanIdentityEyes`) are rigid 1.0 Head (`build-human-identity-source.py` 264) and receive no slender/stout targets (`assemble-human-identity-source.mjs` 35 only morphs `HumanV1Body` and `HumanPonytail01`). Socket morph vs rigid eyeballs at stout/slender 0.95 is unmeasured. Neck-band smoothing can still read as a ring in side stills. Contract samples rest-pose split groups under skinned clips; it does not prove a painted join under the gameplay camera.

---

## 2. Torso / published garment correspondence

**Current production clothing is a different family from the 2026-10-01 live identity checks.**

Those checks served `.cache/character-mmo/m005/manifest.json`: nine entries (body + eight Wayfarer/Pilgrim/Graveweaver pieces), meshes `["HumanV1Body"]`, no coverage geosets (`check-human-identity-source.mjs` 30–36, 67). Current published Human shape family (`public/ashen-reach/human-shape-v1/manifest.json`) carries fifteen pieces including Lector, four Duskguard, and Warden pauldrons, plus `HumanTorsoCore` / `WayfarerTrousersUnderTorso` / `DuskguardTrousersUnderTorso` from `compile-coverage-manifest.mjs`. M005 morphs were tracked from the 3274-vert M004 body (`build-garment-shape-family.mjs` 30, `trackBodyShape` in `girth-field.mjs` 244). They do not own identity shoulder/skull/neck vertices.

Vertex-count comparison cannot establish fit. The existing metric already ignores counts:

- Rest: `measure-shape-garment-fit.mjs` + `garment-coverage.mjs` — 60 mm outward-normal ray from each body vertex into garment triangles; headline is **newly uncovered vs the same garment on the neutral body**.
- Motion: `measure-posed-garment-fit.mjs` — morph then skin with `pose-skin.mjs`; control is **neutral in the same pose at the same instant**; unclaimed Head/Neck/Hand joints and a 30 mm hem band are excluded.

Point those tools at the identity GLB:

```
ASHEN_POSED_FIT_BODY=.cache/character-mmo/identity-v1/human-old-painted.glb
ASHEN_GARMENT_BODY=<same>
ASHEN_GARMENT_DIR=<identity-refit pack>
ASHEN_POSED_FIT_DIR=<same>
```

Rebuild garment morphs first with existing `build-garment-shape-family.mjs` (`ASHEN_FIT_MODE=track`, `ASHEN_HEMS=1`). `trackBodyShape` is k-nearest in metres; it does not require M004 vertex identity. Then compile torso cores with `deriveTorsoCore` (`derive-coverage-geosets.mjs` 25–39): joint landmarks + weight mass, also topology-independent.

The parent-noted old stout torso/arm breach is evidence against the diagnostic M005 pack only. Current published Wayfarer/Lector/Duskguard fit on this topology is unknown.

Hood is a separate authored garment. `fit-human-identity-hood.py` 62–71 still adds **3.8 cm of cage +Z on the front opening** (`maxNeutralCorrectionM` 0.038 in `source-summary.json`). Lattice *is* bound to `IdentitySkullFit` (`:72`); the follow-up’s “unbound lattice” note is obsolete. Rear lining is still a neck graft joined into the hood primitive (`:128–157`; old 5270 / young 5172 verts vs production hood 4723). Source keys are zeroed before the copy (`:104`). Front opening remains the named visual blocker.

---

## 3. Eye / hair / head / torso ownership

| Mesh | Built | Runtime ownership today |
|---|---|---|
| `HumanIdentityBody` renamed `HumanV1Body` | Welded head+torso+scalp | Default `RACE_BODY_SEGMENTS.human` (`coverage-contract.js` 76–78) gives this mesh every segment, so a hood covering `head.scalp` cannot hide scalp without hiding the face. Same conservative rule production solved for *torso* with `HumanTorsoCore`. |
| `HumanIdentityEyes` | Separate, Head-bound | Not in any adapter. `assembleBodyVisual` (`body-visual.js` 429–441) adds every container mesh, so eyes stay always visible. Catalogue `HumanEyes` (`equipment-catalog.js` 14, `LEGACY_REGION_SEGMENTS` 115) maps to **no** segments and names the preloaded wanderer mesh. |
| `HumanPonytail01` | Young-hair only | Hideable only when `main.js` 350–352 injects `{HumanPonytail01:['head.scalp']}` on `?humanHair=ponytail`. |

`createStreamedEquipment` (`equipment-stream.js` 105–106) **replaces** `baseMeshes` / `bodySegments` with `manifestBodyCoverage`. A published coverage pack that lists only `HumanV1Body` + `HumanTorsoCore` drops the hair adapter. Identity extra meshes must be declared in that pack’s `coverage.bodySegments`, or merged after `manifestBodyCoverage`. Loading identity against `manifest-coverage-v1.json` / `human-shape-v1` without `HumanTorsoCore` throws `Missing human body coverage: HumanTorsoCore` (`equipment-stream.js` 135–136).

Suggested identity adapter, same pattern as production Human + Undead eyes:

- `HumanV1Body`: all `BODY_SEGMENTS` (exposed shell)
- `HumanTorsoCore`: `torso.upper`, `torso.lower`, `waist` via `deriveTorsoCore`
- `HumanPonytail01`: `head.scalp`
- `HumanIdentityEyes`: `head.face`

Hood already declares `covers:['head.scalp']` (`equipment-catalog.js` 35). Tucked hair is unimplemented; hide/restore is.

---

## 4. Keep identity out of default starter bytes

Identity painted GLBs are 5.78 / 5.80 / 6.72 MB with 57 clips (`source-summary.json`). Default compact Human body is 1.78 MB (`public/ashen-reach/startup/character/manifest.json`). `.cache/` is gitignored.

Current fences that already keep this graph out of play:

- `resolveHumanShape` (`human-shape.js` 175–183) sets `assetURL` null at weight 0, so a neutral query never fetches `__human_shape__`.
- `prepare-production-human-shapes.mjs` 29–30 rebuilds from `public/ashen-reach/equipment/body.glb` (sha `585f916e…`), never identity.
- `prepare-starter-character.mjs` 33 reads that same public body, then `compileCoverageManifest`.
- `verify-production-human-shapes.mjs` 10–13 hashes provenance inputs; swapping identity in would fail the release gate *after* overwrite. Keep identity out of `ASHEN_SHAPE_OUT` / `ASHEN_PRODUCTION_SHAPE_OUT` / starter root.
- `HUMAN_SHAPE_CAPABILITIES.faceOrAge` / `hair` stay false (`human-shape.js` 84–85). `validateAppearance` forces `components:{}` (`appearance/contract.js` 164, 177). Flipping a flag or stuffing age/hair into `shape` is an explicit failure.
- `permitsSavedAppearance` (`startup-appearance.js` 11) already refuses `humanHair` / `humanHead` / `garmentFit` / `creator` queries.

Live identity serving is a Playwright route onto `__human_shape__` or `__human_hair__` (`check-human-identity-source.mjs` 27–28). Session-scoped. Do not add a Vite middleware that replaces those URLs globally; creator and shaped production boots share `__human_shape__`.

`check-human-identity-source.mjs` 38 drives 0.95 × the URL’s weights. Neutral identity rest is unreviewed. `creator=1` and `humanHair` are mutually exclusive (`main.js` 124).

---

## 5. Bind, actions, cancellation, lifetime

Reuse the existing streamed path. Do not add a second loader.

- Bind: `normalizeHumanBind` on every identity body and fitted hood before palette borrow (`equipment-stream.js` 264–275).
- Actions: keep `copyToDocument` of M004 clips; reject `weights` channels (`assemble-human-identity-source.mjs` 85). Identity morphs are mesh extras, driven by `setMorphTargetWeights` like production (`main.js` 229–250).
- Cancellation: `createEquipmentLoader` aborts the previous `AbortController`, commits only the newest serial, restores borrowed skeletons on dispose (`equipment-loader.js` 15–53, 64–70; `equipment-stream.js` 186, 245, 255, 318–333). Identity swaps must go through `request()`, including hood/hair/body.
- Lifetime: extra eye/hair meshes live on the body container. `packVisibility` only toggles names in `bodySegments`. Unlisted meshes ignore hood hide. `stopped` dispose must remain the owner of those meshes.
- Shape on garments: `getShapeWeights` in `prepare` (`equipment-stream.js` 281–285) stages committed weights before visibility. Rebuild identity garments with the same two named targets.

---

## Historical / obsolete (do not resume)

- Separate-head neck at y=1.5 m, chroma matching, normal welding (`m006-old-head-neck-albedo.md`). Identity weld superseded it.
- Collapsing shipped fused hair for bald (`m006-gate.md`). Identity bald scalp exists.
- `?humanHead=old-bald` / `OldBaldHeadV2Diagnostic` adapter.
- Grok-followup UV-first-corner bake; unbound hood lattice; leftover stout key on lining copy. Parent already landed the code fixes.
- Treating M005 nine-item live stills as a description of current Lector/Duskguard/shoulder fit.
- Treating `source-contract.json` green as M5 exit.

---

## Smallest next implementation slice

Playable young/long and old/bald as **DEV identity-family candidates**, still unreleased.

1. **Do not rebuild the neck.** Reproduce with `node scripts/character-assets/reproduce-human-identity-source.mjs` if bytes drift; pin hashes from `source-summary.json`.
2. **Identity garment pack under `.cache/`.** `build-garment-shape-family.mjs` with `ASHEN_GARMENT_BODY` = each painted identity GLB, `ASHEN_FIT_MODE=track`, isolated `ASHEN_GARMENT_OUT`. Then `compileCoverageManifest` / `deriveTorsoCore` on that body. Declare `HumanTorsoCore`, `HumanIdentityEyes`, and `HumanPonytail01` in the pack’s `coverage.bodySegments`. Keep `public/` and starter hashes untouched.
3. **Hood opening.** Change `fit-human-identity-hood.py` 69–71 to push the front cage **forward (Y)** and keep the skull/collar vertex group. Per-age `hood-{age}-fit.json` already exists; keep using `assembledSha256`.
4. **Eye morphs.** Give `HumanIdentityEyes` the same Head-field slender/stout deltas the skull uses, or lock socket verts so eyeballs track the morphing lids. Measure at 0 and 0.95.
5. **Live check against that pack**, not M005. Extend `check-human-identity-source.mjs` so `garmentManifestURL` is the identity pack; pin served sha256; include weight 0, both ages, Wayfarer + Graveweaver + one current published design (Lector or Duskguard). Close every owned context.
6. **Offline fit numbers** via `measure-shape-garment-fit.mjs` / `measure-posed-garment-fit.mjs` on the identity body vs the new pack. Then live motion. Capability flags and appearance `components` stay empty until both named examples save/reload on a compact path.

Authoring the hood opening is garment art. Measuring current-pack fit is the first engineering gate; the M005 breach does not substitute for it.

---

## Still needs actual live review

Parent owns the renderer. Offline continuity is already green.

- Hood front/side at both ages, weight 0 and 0.95, after any cage change.
- Neck join in gameplay light (side/nape), grey and painted.
- Eyes in sockets at slender/stout and during blinkless idle/turn.
- Young hairline, hanging length vs Neck/Spine2, hood hide/restore, shoulder/cape clearance.
- Old stout torso/arm against **rebuilt** Wayfarer and against one current published cuirass/coat.
- Neutral rest (weight 0) identity body; the 2026-10-01 clips are tall-slender young and short-stout old at 0.95.
- Walk / jump / cast with the identity hood (stills were Armory rest).
- Confirm no identity URL is fetched on default and saved-neutral boots.

---

## Reuse; do not replace

`@gltf-transform/core` 4.4.2 `copyToDocument` / `prune` / `unpartition`, `normalize-human-bind.mjs`, `pose-skin.mjs`, `girth-field.mjs` `trackBodyShape` + Head field, `garment-coverage.mjs` / posed fit scripts, `deriveTorsoCore` + `partitionCoverageMesh` + `compileCoverageManifest`, `createStreamedEquipment` + `createEquipmentLoader`, `mh_io.reduce_weights`, pinned Blender 5.2.1 BMesh weld/lattice/Cycles bake, `fetch-makehuman.py`, Playwright ownership harness. No new engine, coverage framework, or fake `faceOrAge`/`hair` flags.
