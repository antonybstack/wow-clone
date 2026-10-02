# Coverage publication review (uncommitted, versioned alias)

Independent read-only review of the current tree after separate `manifest-coverage-v1.json` packs. Parent implements. No live renderer, no tests, no binary triangle reparse of coverage GLBs in this pass.

## Summary

The versioned-alias split is the right publication shape: the three canonical equipment `manifest.json` files match HEAD (human working SHA `0a6ae6cf2459d3f5` equals HEAD). New runtime packs are `manifest-coverage-v1.json` plus immutable `*-coverage-*.glb` files. `main.js` loads those packs for streamed Human/Orc/Undead body and clothes. Default compact boot still goes through the mutable startup / human-shape manifests.

One demonstrated provenance defect remains in the written startup trousers `coverageSource`. One developer-path adapter override is a demonstrated boot failure from code. Fast-path `assetURL` still names the unsplit Human body while the buffer is the covered body. I did not accept performance. I did not treat missing FPS, remote, or catalogue-v3 work as bugs.

## What I actually checked

- Current diffs: `main.js`, `equipment-stream.js`, `coverage-manifest.js`, compile/release/starter/shape scripts, `check-production-customization.mjs`.
- Written JSON: `equipment/manifest-coverage-v1.json`, orc/undead coverage manifests, startup and human-shape manifests, `coverage-provenance.json` (earlier), compile report claims.
- HEAD identity of `public/ashen-reach/equipment/manifest.json`.
- **Reparsed** `public/ashen-reach/startup/character/wayfarerTrousers-f595aace8ff8.bin`: gzip size/SHA match the coverageSource bytes; glTF JSON mesh names are `WayfarerTrousers`, `WayfarerTrousersCuffs`.
- **Did not** reparse coverage GLB index unions, inverse binds, or morph accessors in this pass. **Did not** view images. **Did not** run the game.

## Issues

### 1 — Severity: bug
- File: `public/ashen-reach/startup/character/manifest.json` (wayfarerTrousers.coverageSource.meshes)
- Description: `coverageSource` points at `wayfarerTrousers-f595aace8ff8.bin` with SHA `169ad033…` (decoded 146288 bytes, match). That GLB’s meshes are `WayfarerTrousers` and `WayfarerTrousersCuffs`. The same `coverageSource.meshes` lists `WayfarerTrousersUnderTorso`. The unsplit source does not contain that mesh. This is leftover metadata from compiling startup while the equipment item already advertised coverage meshes; `prepare-starter-character.mjs` encode copies item metadata and only overrides body mesh names.
- Repro: gunzip the coverageSource URL and read `meshes[].name`. Compare to `coverageSource.meshes`.
- Impact: idempotent rebuild that trusts `coverageSource.meshes` as the unsplit inventory is lying. Runtime boot uses compiled `items.wayfarerTrousers.meshes` and the SHA/bytes of the bin, so default play is not shown to fail from this field.
- Suggestion: when encoding, set `meshes` from the document just written (as body already does). Rebuild the startup manifest from HEAD equipment. Do not copy coverage mesh lists onto unsplit sources.

### 2 — Severity: bug
- File: `src/ashen-reach/equipment-stream.js:101` with `src/ashen-reach/main.js:349-365`
- Description: `manifestBodyCoverage` replaces `baseMeshes` and `bodySegments` whenever the loaded manifest has coverage. `?humanHair=ponytail` and `?humanHead=old-bald` still load unsplit candidate bodies (no `HumanTorsoCore`) and, without a garment-fit URL, stream `equipment/manifest-coverage-v1.json`. That pack requires `HumanTorsoCore`. Bindings then throw `Missing human body coverage: HumanTorsoCore`. Coverage-pilot already refuses those candidates; published coverage now applies on the ordinary streamed pack. `?preloadedEquipment` still uses `createEquipment` and the baked wanderer GLB, so it does not hit this adapter.
- Repro: streamed `?humanHair=ponytail` or `?humanHead=old-bald` without `garmentFit=refit`.
- Impact: those developer bodies fail to boot against the new Human coverage pack.
- Suggestion: apply the published adapter only when the live body already contains every advertised mesh, or keep diagnostic routes on a pack without `coverage`. Do not overwrite an explicit hair/head `bodySegments` option.

### 3 — Severity: suggestion
- File: `src/ashen-reach/main.js:136-141` and `307`
- Description: Default/fast play loads the covered starter (or compact family) body via `startupAssetBuffer(m.items.body)`. `playable.assetURL` stays `/ashen-reach/equipment/body.glb` because `fullBodyManifestP` is null on that path. `loadGltf` uses `def.buffer || assetURL`, so first assemble is coherent. Human race return restores the parked visual and does not fetch `pack.bodyUrl`. The alias is still the unsplit master.
- Impact: anything that later fetches `assetURL` / `sourceURL` gets a body without `HumanTorsoCore` while equipment still uses the covered starter/shape manifest.
- Suggestion: set `assetURL` from the same manifest entry that supplied the buffer (`starterCharacterP` / compact family `items.body.url`).

## Checked and not raised as bugs

- Canonical equipment `manifest.json` files are HEAD-identical. Old clients keep fused-body mesh semantics. New clients use `manifest-coverage-v1.json`.
- Orc coverage pack does not split the body; adapter skips `coverageRevision` on orc. Undead coverage pack body URL is `body-coverage-02cb6c3cc877.glb` with `UndeadTorsoCore`. Race switch fetches that URL from the same manifest it passes to `createStreamedEquipment`.
- Failed Human return: `stageSource` dispose skips the parked original (`if(!retained)disposeCandidate`). Failure harness patterns now match `body*.glb*` and `manifest*.json`.
- Compact family trousers URL is `wayfarerTrousers-compact-coverage-f834210550a3.bin`. Compact body is the full covered body. Saved compact boot and post-play full refinement were not live-executed here.
- Leftover `human-shape-v1/wayfarerTrousers-coverage-f834210550a3.bin` sits beside the compact-coverage name. Unreferenced extra public file; prune regex does not catch `*-coverage-*`. Cleanup, not a boot defect.
- Legacy prefetch still warms unsplit `wayfarerTrousers.glb` and `equipment/manifest.json`. Default fast start skips it.
- Compiler dusk/lector hooks are idle: those items are absent from current equipment manifests. Missing catalogue work, not a defect in the published packs.
- Extra skinned meshes / draws are a load cost. No FPS or allocation measurement in this review. Do not treat normal-path performance as accepted.

## Incomplete acceptance (not defects)

Pilot 30-case morph/shadow restoration, 145/96 tests, and parent’s normal-path functional v2 are parent claims. This review did not rerun them. Production Pages is unchanged. Catalogue v3, remote composition, and source-motion descriptors remaining candidate-only are out of scope.This turn was an independent read-only review of uncommitted coverage publication; no game clip.
