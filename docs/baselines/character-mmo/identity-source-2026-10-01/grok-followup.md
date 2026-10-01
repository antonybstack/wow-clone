# Identity source follow-up review

Unreleased `.cache` checkpoint. Not M5, not production, not recipe/palette/persistence/startup/crowd. Parent already named hood face-opening and an old stout torso/arm garment breach; those are not recertified here.

Read current `scripts/character-assets/{build-human-identity-source.py,assemble-human-identity-source.mjs,bake-human-identity-atlas.py,fit-human-identity-hood.py,assemble-human-identity-hood.mjs,check-human-identity-contract.mjs,check-human-identity-source.mjs}` and live `ve-capture/character-mmo/identity-v1/{old-painted,young-hair-painted}/{front,side,back,hood-front,hood-side,hood-back}.png`. No renderer, Blender, or product edit.

**Model / limits:** Grok 4.6, six-turn file-and-still pass. No GLB accessor dump, no fitted-motion frame audit, no `hood-young` fit JSON (current `hood-fit.json` is old).

---

## Fixed since the prior report

| Prior finding | What landed | Evidence |
|---|---|---|
| Hair mesh not in coverage | Build names `HumanPonytail01` (`build-human-identity-source.py:279`). Check sets `humanHair=ponytail` and asserts hide (`check-human-identity-source.mjs:34,79`). | `young-hair-painted/report.json`: `hairVisible` true on body stills, false from `hood at source neck/scalp` onward. `hood-back.png` has no tail. |
| Hood path wrote `hood-raw.glb`, checker read unnormalized `hood.glb` | `assemble-human-identity-hood.mjs` runs `normalizeHumanBind`, pins `rawSha256`, writes `hood-{age}.glb`. Check loads that file (`check-human-identity-source.mjs:26–30`). | Both painted reports: `"hood":"normalized native fit"`. |
| Stacked young+old shrinkwrap | One age target; lattice cage (`fit-human-identity-hood.py:32–70`). | `hood-fit.json`: `"fitScope":"one age; no union claim"`. |
| Cap weighted down the ponytail | Cap is Head until z=160, then Neck/Spine2 (`build-human-identity-source.py:285–292`). | Code. Rest stills no longer show a sliding forehead strap. |
| Five influences, exporter truncate | `mh_io.reduce_weights(...,4)` on head and joined body, then assert (`build-human-identity-source.py:191–251`). Hood keeps four (`fit-human-identity-hood.py:112–123`). | `old-source.json`: max discarded 0.027, `vertsDropGt01: 0`. |
| Missing `setWeights` / `targetNames` | Assemble sets both on body, hair, and hood (`assemble-human-identity-source.mjs:28–29,71`; `assemble-human-identity-hood.mjs:19`). | Contract asserts `[0,0]` and names (`check-human-identity-contract.mjs:19`). |
| Blender-resampled clips | Dispose exported actions; `copyToDocument` of M004 clips; remap nodes; reject `weights` channels (`assemble-human-identity-source.mjs:73–92`). | Contract: 57 named clips, duration delta 0, palette element ≤1.6e-5 over 855 samples/source. |
| UV-split neck as separate render verts | Contract groups coincident neck positions, skins 57×5×3 morphs. | `source-contract.json`: `maxSplitM: 0`, base and morph normals 0 on 196/140 split groups. |
| Incomplete source hashes | `provenance.json` pins M004 GLB, `base.obj`, age targets, eyes, skin PNGs; build verifies (`build-human-identity-source.py:38–42`). Blender 5.2.1 pinned. | File. |
| Head had no Head-bone girth; hair had no shapes | Assemble eases body into M004 Head field above y=1.57 and writes hair slender/stout (`assemble-human-identity-source.mjs:32–71`). | Code. Not a live zero-weight proof. |
| Warm head / printed stubble (parent paint pass) | Linear boundary gain + bald-scalp / nape pigment (`bake-human-identity-atlas.py:81–152`). | `old-colour-adaptation.json` gain ≈ (0.45, 0.58, 0.83). Scalp in `old-painted/back.png` is clean vs the earlier printed crop. |

Weld JSON still reports a manifold Blender neck (old 204→102, non-manifold 0). Offline pose/palette continuity is green. That is not live M5.

---

## Current source / hood defects

### 1. Lattice face opening lifts the cowl onto the face (demonstrated)

Parent observed the opening. Cause in this pass:

`fit-human-identity-hood.py:67–69` treats negative cage Y as “front” and **adds 3.8 cm to deform Z** (up) with a 149–160 cm fade. `hood-fit.json` `maxNeutralCorrectionM` is **0.038 m**, the same number. The lattice modifier is **not** bound to `IdentitySkullFit` (`:70` vs unused group `:41–46`), so the cage is a whole-hood scale (18% width, 14% depth, 3.2 cm top lift) plus that upward lip.

**Stills:** `old-painted/hood-front.png` — cowl covers one eye, slits the other. `young-hair-painted/hood-front.png` — opening is a mouth hole; eyes gone. `hood-side.png` both ages: pale cheek crescent, cowl on the zygoma. Rear/scalp coverage is the part that improved (`hood-back.png`, no ear).

**Confidence high.** Rest armory camera, stout 0.95 / slender 0.95, normalized identity hood.

**Smallest fix:** Deform the opening **forward** (cage Y), not up (Z). Bind the lattice to the skull/collar group so shoulders stay authored. Re-capture hood-front/side at both ages before calling the opening done.

### 2. Old stout torso/arm garment breach (parent; not a hood-fit proof)

Check still routes **M005 refit garments** (`ownership.json` `garmentFit=refit`) against a **7,475-vert** identity body. M005 track-body morphs were built on the 3,274-vert M004 mesh (`build-garment-shape-family.mjs`). Neck smooth + new skull + Head-field fade change the shoulder/arm surface those garments do not own.

This review does not independently measure millimetres from the stills. It agrees the breach is expected until garments are rebuilt on this family. Open, as parent stated.

### 3. Neck mark remains on painted side stills

`old-painted/side.png` and `young-hair-painted/side.png` still show a dark nape/side streak after the gain pass. Bake still samples `body_corners[nearest][0]` (`bake-human-identity-atlas.py:74–75`) — first torso UV on the welded vert, not the loop that shares the seam edge. Global RGB gain cannot remove a wrong island or the 148–155 cm smooth band (`build-human-identity-source.py:224–233`).

**Confidence medium** as albedo-vs-geometry mix. **Fix:** copy the adjacent torso loop UV; keep the geometric ring as a mesh problem if grey still shows it.

### 4. Rear lining is a body-neck graft joined into the hood primitive

`fit-human-identity-hood.py:130–154`: duplicate the identity body, keep `144<z<157 && y>1`, inflate 0.8 cm along normals, steal nearest hood UVs, `object.join`. `hood-fit.json` vertex count **5,270** (cloth + neck patch, one material).

Risks: leftover **target shape-key value** after the eval loop (`:78–81` sets stout=1 and never zeros the body before `target.copy()` at `:130`); lining UVs from a fold island; extra skinning cost; lining was not in the offline 855-sample body contract.

**Confidence medium** (join is definite; stout-copy and UV bleed untested). **Fix:** zero body keys before copy; author lining UVs on a cloth island; contract-skin the hood mesh.

### 5. Hood fit bookkeeping is last-age-wins

One `hood-raw.glb` / `hood-fit.json`. Assemble then copies to `hood-{age}.glb`. A later old fit does not re-hash `hood-young.glb`. Young-hair uses `hood-young` via `age.split('-')[0]`.

**Fix:** per-age raw sha in the JSON the assemble step checks.

---

## Open on purpose (do not treat as closed)

- Native clip **motion** of the lattice hood (walk/turn/jump/cast). Stills are rest armory.
- Weight **0** identity rest: check drives 0.95 (`check-human-identity-source.mjs:38`); `resolveHumanShape` at 0 still loads the shipped body.
- Morph `byteStride` after assemble (Lite 1.31.1).
- New-family M005 rebuild, recipe, creator age/hair, startup bytes, crowd/VAT.
- Hair **tucked** vs hidden: hidden is implemented; tucked is not.

---

## Visual taste (not weld blockers)

Eyes sit a little dead in both fronts. Young hair is still a cap with a hard hairline. Remaining neck ring in front/side is the mark in §3. Rear bald scalp is the improved part of the paint pass.

---

## Bottom line for this checkpoint

Prior pipeline holes (coverage name, bind normalize, clip copy, 4-weights, split-normal pose, provenance, Head-field hair shapes) are addressed in scripts and in the painted live stills that exist. The weld’s offline continuity check is green.

The live hood **front opening is wrong**, with a direct lattice +Z cause. Parent’s stout garment breach is the unmigrated M005 pack. This is an unreleased source family, not complete M5.
