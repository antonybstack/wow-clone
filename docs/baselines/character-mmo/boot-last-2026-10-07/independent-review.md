# Independent review: Orc boot last + Duskguard greave envelope

Frozen-source read of `scripts/character-assets/build-boot-last.mjs`, `blender/characters/wardrobe/boot-last.json`, `prepare-boot-sole.mjs` `--last`, `author-duskguard-plates.py` optional boot envelope, `build-duskguard-armor.mjs` argument branch, `blender/characters/wardrobe/duskguard-armor.json`, plus the bind/coverage/publication contracts those files call. No builders, tests, browser, git, or source edits.

## Summary

No consequential correctness or regression defects in the reviewed source. Orc-only last grading pins exact inputs, edits POSITION/NORMAL only, keeps the native 65-joint skin, and publishes through the existing immutable hashed-file path. Human/Undead sole, strap, underlayer, and joint-radius greave paths stay on their previous descriptors and public hashes. The new greave envelope is Orc-gated and fingerprint-checked; old plate-array equality is skipped only on that last path.

## Issues

None.

## What the source actually does

- **Pinning.** `boot-last.json` pins authored catalogue boot `0f4091ff26d4`, catalogue body `e813a40bbb00`, Orc before-last boot `e07c5fab32bc`, Orc body `b055e29393ca`. `duskguard-armor.json` Orc underlayer is `1880f480f1bf`; Human `52c5c2f6df2b` and Undead `96df888598dd` match the current public `manifest.json` entries. `build-boot-last.mjs:39` and `build-duskguard-armor.mjs:31-32` refuse unreviewed bytes.
- **Authored-only POSITION/NORMAL.** `build-boot-last.mjs:113-118` writes remapped last positions, rebuilds normals, and asserts every other semantic equals the before-last Orc input. Skin/UV/joints/indices stay on that Orc pack; topology is compared to the authored last after `canonicalizeFactoryTriangles`.
- **Binder.** Output goes through `verifyFactoryEquipmentBind` (`65` joints, exact IBM, rest palette delta `<=1e-6`). Cache private-controls already record `joints: 65` and `worstPaletteDelta: 0` for both boot and greaves; this review did not re-run that gate.
- **Positive grading.** `boot-last.json` sections/height knots are strictly increasing (`build-boot-last.mjs:30-37`); section widths and strap clearance are positive and bounded. Height knots map the measured authored range onto `[-0.006, 0.458]`, matching the recorded boot bounds.
- **Foot convention.** Side split is Mixamo `x * sign` with Left `+X`. Last frame is rest `Foot`→`ToeBase` flattened to XZ, `right = up × forward`. Greave envelope uses the same Left `+X` split and Blender `-Y` as glTF `+Z` front (`author-duskguard-plates.py:179-188`).
- **Strap/sole.** `--publish` remains Human/Undead sole; `--straps` remains three races; `--last` is Orc only (`prepare-boot-sole.mjs:22-30`). Last reapplies `strapClearanceM` `0.006` on the same 856 strap indices the strap builder uses. Re-running `--straps` after last would fail the Duskguard underlayer pin for Orc (`prepare-boot-sole.mjs:50`).
- **Greave envelope.** `duskguard-armor.json:121` sets `greaveEnvelope` only on Orc. `build-duskguard-armor.mjs:35-40` throws unless race is Orc and the envelope is `wayfarerBoots`, then passes the already hash-checked underlayer into Blender. Human/Undead keep the previous `limb_points` greave (`author-duskguard-plates.py:173-176`). Public Human greave `171f8518a871` and Undead `20cffe52ddaf` are unchanged in their manifests.
- **Copied contracts.** `--last` requires underlayer semantics to match the new last boot, allows meshopt triangle rotations, and replaces old plate-array equality with `reviewedGreaveGeometrySha256` `f370f46d3d8a…` on a canonicalized plate readback (`prepare-boot-sole.mjs:73-85`, `101`). Published arrays are not rewritten by that canonicalize. Publication still uses `planPublication` / `executePublication` (hashed file + canonical copy, then manifest rename).
- **Coverage.** Runtime Orc pack is `manifest-coverage-v1.json`. `--last` does not write that file; it lists coverage in `remaining`. The current coverage-v1 already advertises `wayfarerBoots-1880f480f1bf` and `duskguardGreaves-64595d16f60d`. Hiding covered body parts stays on the existing geoset pipeline.

## Limits

This review did not re-run the last builder, Blender author, publication, binder, or live Havok. It did not recompute `1880f480f1bf` or `f370f46d3d8a`. It did not inspect plate-audition PNGs or claim motion/occlusion/FPS/startup acceptance. Repeat byte-identity and 65/0-delta are taken from the frozen descriptors, public manifests, and already-written cache reports, not from a new operation.

## Unverified speculation (not findings)

- Source-body section counts of `12045` vs Orc `634` at the sole station are consistent with geosets sharing one POSITION array; min/max AABB is invariant under those duplicates. That is why the last uses vertices, and why the triangle diagnostic is a separate, non-acceptance measurement.
- Absolute Blender Z clips `0.19–0.44` on the Orc envelope are not `unit`-scaled. They are Orc-gated and sit inside the last’s `0.458` cuff; they would be wrong on another race, which the policy already refuses.
- Strap index ranges are duplicated rather than read from `boot-straps.json`. They match today; a later strap-index edit would need a last-descriptor edit too.
