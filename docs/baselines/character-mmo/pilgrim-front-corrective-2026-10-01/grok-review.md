# Skin-corrective review — pilgrimTunic full Data Transfer

**Verdict: reject this candidate.** Do not adopt the full-body rebind. Geometry/bind assembly is sound; the producer rebinds almost the whole tunic, jump still shows abdomen flesh, and idle/run cloth already changes. Parent independently confirmed a rear skin stripe on posed neutral with the body hidden. A Hips/Spine/Spine1 mask that keeps original upper/cape/sleeve/hem weights is the right next audition.

No production write: `public/ashen-reach/equipment/pilgrimTunic.glb` and `body.glb` still match the manifest; body still has 57 clips and the 65-joint palette. Candidate lives under `.cache/character-mmo/wardrobe-v1/skin-corrective/`.

This is not a full-fit success. Metrics improved and stills still fail.

## Highest-impact defects

### 1. Bug — full rebind, not an abdomen correction
- **File:** `scripts/character-assets/transfer-garment-skin.py:51-80`
- **Verified:** Clears every destination group, copies **all** body groups with `POLYINTERP_NEAREST` / `layers_vgroup_select_src='ALL'` / `mix_mode='REPLACE'`, unlimited distance, then keeps the strongest four and renormalizes. Assembler report: **8520/8960** weights changed (`pilgrimTunic-report.json`). Direct GLB compare: **3166** dominant-joint flips; mean L1 **0.65** (abdomen band **0.84**, hem **0.73**, arms **0.18**). Largest flips: Spine→Hips 796, Spine1→Spine 408, Spine→LeftUpLeg 258, Spine→RightUpLeg 221, Spine2→shoulders/arms, **RightUpLeg→LeftUpLeg 183**.
- **Stills (front only):** `candidate-jump.png` still shows a flesh patch at chest/abdomen. `candidate-idle.png` / `candidate-run.png` add a sternum-to-belt crease and puffier sleeves versus baseline. Parent’s hidden-body rear stripe is outside this image set; treat that as parent-verified, not re-derived here.
- **Fix:** Do not `vertex_groups.clear()`. Transfer only the abdomen palette (Hips, Spine, Spine1 — actual landmark names on this rig), keep original groups on cape/sleeves/hem/upper chest, then rebuild four normalized slots. Use a vertex-group or distance mask so hanging skirt/cuff vertices cannot bind to the opposite leg.

### 2. Bug — face-interpolated weights truncated to four
- **File:** `transfer-garment-skin.py:61,75-80` then `build-garment-skin-corrective.mjs:59`
- **Verified:** `POLYINTERP_NEAREST` interpolates a triangle of body verts, each with four joints, so a garment vertex can carry more than four groups. The script then `[:4]` and divides by that partial sum. Output JSON has only the truncated four, so discarded mass is not in the artifact.
- **Hypothesis:** The discarded tail is largest at spine/hip blends (where the abdomen defect lives). Copying the **nearest body vertex’s exact four weights** onto masked vertices avoids the truncation; eight-influence `WEIGHTS_1` is unnecessary if the mask stays small.
- **Fix:** For masked abdomen verts, assign the nearest body vertex’s `JOINTS_0`/`WEIGHTS_0` unchanged. Leave unmasked verts on the original four.

### 3. Bug — posed-fit headline cannot accept this audition
- **File:** `scripts/character-assets/measure-posed-garment-fit.mjs:309-317,210-228`
- **Verified:** `exposedToCamera` only runs on vertices covered on **neutral** and uncovered on **shape**. It does not compare candidate vs original, and it does not test camera exposure of vertices that still pass the 60 mm normal ray. Stout worst exposed **17 → 10** (`baseline-posed.json` Idle_Loop@0.48 vs `candidate-posed.json` Jump_Loop@0.48) while jump stills still show flesh and idle stills show a new crease. Rays are horizontal `(dx,0,dz)` against a downward review camera.
- **Verified provenance gap:** those two JSON files have no `metricRevision`. Current script emits revision 2 and the body-only index skip (`:221`). Relative baseline-vs-candidate still has meaning because topology is identical; do not treat the absolute counts as the revised metric.
- **Fix:** Gate acceptance on candidate-vs-original in the same pose, including a back camera and a hidden-body pass (the rear stripe). Keep shape-vs-neutral as a regression probe only. Restrict the self-triangle skip to the body occluder (already done).

## What held

- **Assembler correspondence / frame:** NodeIO path, not a Blender mesh export. Original vs candidate POSITION/NORMAL/UV/indices are byte-identical; 65 joint names and inverse binds match (IBM max abs 0); mesh node is identity. `maxMatchDistanceM` 8.68e-7 m. Y-up undo `[world.x, world.z, -world.y]` is empirically valid at that tolerance. Weight sums are 1.0 on both files.
- **Isolated shape override:** `build-garment-shape-family.mjs` (working-tree `ASHEN_GARMENT_SOURCE_DIR` guard) refuses sources/outputs outside `.cache`. `trackBodyShape` uses rest positions, not weights, so morph identity of the rest garment is preserved; posed motion is entirely the new skin.
- **Cache-only producer output:** `build-garment-skin-corrective.mjs:17` throws unless `out` starts with `.cache/`.

## Metric / tooling notes (not adoption blockers)

- Default `OUT` in `measure-posed-garment-fit.mjs:37` is still `docs/baselines/character-mmo/m007/posed-garment-fit.json`. Unset env overwrites the committed baseline. Pin `ASHEN_POSED_FIT_REPORT` under `.cache/` for auditions.
- `samplesPerClip: 5` is reported even when `ASHEN_POSE_TIMES=0.48` produced four rows. Use `explicitTimes`.
- Candidate drops `EXT_meshopt_compression` (479 776 → 695 300 bytes). Audition-only; recompress before any production hash.
- Assembler integrity hash uses `getArray().buffer` (`build-garment-skin-corrective.mjs:63-67`), the whole ArrayBuffer. **Hypothesis:** a shared buffer could false-alarm; SEPARATE layout likely hides it. Hash `byteOffset`/`byteLength`.

## Masked-transfer hazards (for the next audition)

Clearing groups (`transfer-garment-skin.py:53`) is incompatible with preserving cape/sleeve/hem. Replacing only Hips/Spine/Spine1 without dropping those three from the original four-slot set will double-count unless the four slots are rebuilt and renormalized after the transfer. Opposite-leg dominant flips (183 verts) show why the mask must be geometric, not “nearest face anywhere.” Re-check hidden-body rear and front jump/idle stills before any metric claim.
