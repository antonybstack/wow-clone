# Grok review — M5 compact saved Human startup

Reviewer: Grok 4.6, read-only working tree vs HEAD `394a738f134a4da30f21ad954c116660a67f4354`.
Scope: `src/ashen-reach/startup-fetch.js`, `src/ashen-reach/human-identity-assets.js`, `scripts/character-assets/prepare-production-human-identities.mjs`, `scripts/test-identity-startup.mjs`, `scripts/test-production-human-identities.mjs`, generated `public/ashen-reach/human-identity-v1` manifests/proofs. Supporting reads: `main.js` actorRequest/fullManifest, `startup-preload.js`, `startup-appearance.js`, `equipment-stream.js`, `startup-assets.js`, `verify-production-human-identities.mjs`, `human-identity-proof.mjs`, `coverage-manifest.js`, `public/_headers`, `vite.config.js`, installed glTF-Transform `setSparse` / `simplify` / `compactPrimitive`.
No tests, browser, live play, FPS, commits, or product edits. No startup or performance acceptance.

## Summary

Runtime selection, shared catalogue/asset promises, unsaved graph, lossless bodies, compact-hood-only reduction, full-hood upgrade through existing `actorRequest`, sparse-to-dense write, native simplify remapping, and prune of rotated body objects look consistent with the stated policy. One valid publication-cache finding. Compact opening skin/morph preservation is tested in source; that test was not executed here.

## Issues

### Issue 1 — Severity: bug

- File: `public/_headers` (missing rules; this diff newly rotates and deletes identity body objects while the catalogue URL stays fixed)
- Description: This change publishes new content-addressed bodies (`body-31f3ba87f47d.bin`, `body-ddf25d841211.bin`, `body-fc1092b22cb1.bin`), adds `graveweaverHood-compact-*`, and prunes the previous bodies (`body-aac9c271a4b4.bin`, `body-b334f056072c.bin`, `body-d094f9b226f9.bin`). The catalogue remains `/ashen-reach/human-identity-v1/manifest.json`. `_headers` gives `no-cache` to every other mutable catalogue (`human-shape-v1/manifest.json`, starter/character/region/presence) and immutable hashing to their bins/textures. There is no `human-identity-v1` rule. A cached catalogue after a Pages (or any CDN) publish can keep requesting deleted body URLs. In production Vite bakes `VITE_HUMAN_IDENTITY_SOURCE` from the new provenance; a stale catalogue then fails the provenance check on every reload until the catalogue is revalidated. In development that env is empty, so the stale catalogue is accepted and the pruned body 404s. Nothing here is released yet; this is a deploy guard this rotation depends on.
- Reproducer: Serve the new `public/` after a client has cached the previous `human-identity-v1/manifest.json`. Selected Human boot still requests `body-d094f9b226f9.bin` (or the matching old prime/weathered name) which this tree no longer contains.
- Suggestion: Add the same pattern as the shape pack:

```
/ashen-reach/human-identity-v1/*.bin
  Cache-Control: public, max-age=31536000, immutable

/ashen-reach/human-identity-v1/manifest.json
  Cache-Control: no-cache

/ashen-reach/human-identity-v1/manifest-*.json
  Cache-Control: public, max-age=31536000, immutable

/ashen-reach/human-identity-v1/texture-*
  Cache-Control: public, max-age=31536000, immutable
```

- Status: open

## Checked and not found as product bugs

Request promise / error / retry. `startupAssetBuffer` still caches by URL and deletes on failure. `preloadHumanIdentityCatalogue` uses the same `??=` / clear-on-reject pattern. `loadIndex` failure nulls `indexTask` and invalidates the catalogue. Early `preloadHumanIdentityCatalogue().catch(()=>{})` lets `preloadHumanIdentityPack` retry a fresh catalogue if the overlapped fetch already settled failed. Single-threaded `??=` assignment is safe.

Early catalogue / unsaved graph. `preloadSavedHumanPack` fetches the catalogue and dynamically imports `human-identity-assets.js` only when `appearance.components?.head` is set. Validated starter is `components: {}` (`contract.js` line 122). `usesHumanShapeStarter` for default saved Human without a head takes the shape or starter pack. `startup-preload.js` does not call the identity path in that case. Default boot still does not statically import the identity module.

Validated URL / recipe. Storage still does not supply URLs. Preset comes from `findHumanIdentityPreset`; pack URLs come from the sealed catalogue after schema/catalog/shape/coverage/descriptor checks.

Exact body geometry / 57 curves / 65-joint bind / coverage. HEAD vs working decoded mesh identity hashes are unchanged for all three bodies (`8d760063…`, `390203105ba6…`, `5384ab3382a6…`) and animation hashes stay `4d17f973…`. Vertex/index counts match the previous bodies. New GLBs: 57 animations, one 65-joint skin, eyes/brows, ponytail only on prime-ponytail, `HumanTorsoCore`, two morphs named slender/stout. `compactItems.body` is the same descriptor as `items.body`. Full hood hashes are unchanged from HEAD.

Sparse-to-dense. Previous bodies had two sparse accessors; new bodies have zero. `Accessor.setSparse` only flips the write flag; `getArray()` is already the decoded dense array. Encode hashes geometry before the flag change, writes meshopt, re-reads, and requires the same `identityGeometryHash`. That is a roundtrip of the audition document, which prepare already pins to `preparation.json` / `source-summary.json` file hashes. Decoded vertex counts are unchanged. This is a packing change, not a source-geometry change.

Native simplify / boundary skin and morphs. Compact hood is the only reduced identity mesh. Authoring uses the same `simplify({ratio:.4,error:.002,lockBorder:true})` as released clothes. `weld({overwrite:false})` returns immediately on already-indexed primitives. `compactPrimitive` remaps base attributes and morph targets together. Compact young/old hoods keep one mesh, two morphs with matching vertex counts, 65 joints, no animations; vertex counts drop 5052→2464 and 5085→2481. Tests require full-hood opening boundary size > 200, exact POSITION/NORMAL/UV/JOINTS/WEIGHTS/both-morph records on that boundary, encoded size < 60% of full, copied full textures, and a deleted-record control that must fail. Those tests were not run in this review.

Full vs compact texture / actorRequest. Compact hood copies `hood.textures`. Compact body is the full body, so first play already lists the full identity maps on `startup.textures`. `main.js` post-play `actorRequest` loads `(await starterCharacterP).fullManifest` (original `items`, including the unsimplified hood) with `loadBuffer: startupAssetBuffer`. Other clothing already used that path.

Provenance / prune. Prepare provenance includes the prepare script, shape manifest, source-summary, preparation pins, hood-fit JSON, and `package-lock.json`. Prune regex now matches `graveweaverHood-compact-*`. Working tree deleted the old bodies and kept the still-referenced full hoods; new compact bins and bodies exist on disk and match `preparation.json`.

Tests. `test:character` includes both identity test files. Artifact tests pin bind against the live shape-family body, 57-curve hash against that body, compact body identity, compact-hood policy/size/boundary records, and a geometry-hash mutation control. `verifyProductionHumanIdentities` does not itself require the hood to be reduced; `test-production-human-identities.mjs` does. Runtime unit tests overlap catalogue fetch with the dynamic module and share decompression; their compact fixture rewrites every URL, with loadout `{torso:'wayfarerTunic'}`, so they never request a hood. Compact-flag behavior is still exercised via the rewritten body URL. Live `check-compact-human-identity.mjs` is outside `test:character` and was not run.

## Hypotheses (not verified findings)

- `test-identity-startup.mjs` test 3 invalidates the catalogue but leaves the default `human-identity-assets.js` `indexTask` holding the mutated fixture. Harmless if that file is last and the runner isolates files; a same-process later import of the default module could reuse rewritten URLs.
- Opening-boundary records after meshopt decode were not independently recomputed here. If `lockBorder` dropped a UV-split opening corner, the new test should fail; that is unexecuted.
- Cloudflare Pages matching of the catch-all `/` max-age=60 rule was not re-read from current CF docs. Even if it applies, it is weaker than the `no-cache` used on every other mutable catalogue.

## Limits

Working diff and on-disk generated packs only. No `node --test`, no prepare rerun, no browser, no compressed-build cold start, no FPS. User WoW is running; no startup or frame-time claim is possible. `preparation.json` `bodyGeometryLossless: true` is authored after success, not an independent measurement; HEAD geometry-hash and vertex-count equality is. New hashed bins are untracked and must be committed with the code if this is published.

## Parent disposition

The missing identity cache-policy finding is valid and fixed in `public/_headers`, with the upstream documentation linked in a comment. The existing release verifier now checks these response headers alongside artifact bytes. Native local Wrangler Pages parses 22 rules, serves all 845 artifacts with exact bytes, and passes all 17 identity cache policies. This is local Pages verification, not a production deployment. Character 195/195, startup-focused 14/14, 11 compact refinement cases, 8 repeated saved-route cases and 7 desktop mobile cases pass in the parent. Actual motion is Telegram 853. The fixture-cache observation is a test-isolation hypothesis, not a reproduced runtime defect; no production reset API was added for it. Source/bind/morph/curve changes were not needed. The first 15-turn review was resumed for a bounded two-turn verdict (session `01a1099f-87a6-7d22-8823-0fea7598f27c`, Grok 4.6/high); no worker browser or product edits.
