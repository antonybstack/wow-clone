# Connected Human source audition — Grok follow-up

HEAD `17ee3e9` working tree. Read-only. Do not treat this as M5 complete.

## Verdict

The assigned parent changes are a DEV compact/full overlay of the pinned connected source onto the released `ashen-human-shape-v1` clothing family. Offline source contract is green. The 162-row still pass is diagnostic. Live motion remains an open gate.

**New consequential regressions in the assigned diff: none.**

Prior unused-curve / disconnected copied-rig / rigid-eyeball gaps are closed in this tree.

## Closed in this parent pass

1. **Exact curves + prune.** `assemble-human-identity-source.mjs:81–109` disposes Blender channels/samplers (non-recursive `Property.dispose`) and copied `NODE`s after remapping `copyToDocument` targets onto the accepted rig. `check-human-identity-contract.mjs:26–40` requires unused accessors `=== 0` and byte-identical clip signatures vs M004. `.cache/character-mmo/identity-v1/source-contract.json`: all three labels `sourceCurvesExact: true`, `unusedAccessors: 0`, nodes 68 / 68 / 69 (young-hair + ponytail).

2. **Eye morph field.** `assemble-human-identity-source.mjs:37–73` applies the Head `softShape` field to `HumanIdentityEyes` with fade `1`. Contract `41–54` requires two named targets and `maxEyeFieldDifferenceM < 1e-7`. Report: `1.862645149230957e-9` on old / young / young-hair.

3. **Semantic torso / eyes / hair.** `prepare-human-identity-review.mjs:82–84` publishes `HumanIdentityEyes=['head.face']` and young-hair `HumanPonytail01=['head.scalp']`, then asserts `manifestBodyCoverage` matches `body.meshes`. Runtime override is `equipment-stream.js:105–106` (`packs.human.baseMeshes` in `main.js:356–357` stays `['HumanV1Body']` and is replaced by the pack). `docs/baselines/character-mmo/m5/head-2026-10-04/final-fits/report.json`: 162 rows, `passed: true`, `direct: true`, `HumanIdentityEyes` always visible, `HumanTorsoCore` present, ponytail hidden only on `warden`.

4. **Compact/full lifetime.** `identity-review.js:19` hands the loader `{...fullManifest, items: compactItems, fullManifest}`. `main.js:572–582` upgrades through `actorRequest` (serial with equip), `lifetime.throwIfAborted()`, `previous.dispose()`, dispose-on-failure if `impl !== next`. Prefetch is `identity-review.js:20` (`body` + `DEFAULT_BOOT_GEAR` present in compact items).

5. **Saved-character isolation.** `startup-appearance.js:11` excludes `humanIdentity` from `permitsSavedAppearance`. `main.js:411–412` skips `saveAppearance` and sets the temporary-audition warning. `identity-review.js:11–12` refuses combined diagnostic query params. Direct 162-row run asserts the M7 seed is unchanged (`check-human-identity-current-fits.mjs:71`). Armory `applyProductionBody` (`main.js:708`) also goes through `rememberAppearance`. `src/ashen-reach/creator.js` does not write storage.

6. **Production isolation.** `main.js:87–88` dynamic-imports `identity-review.js` only under `import.meta.env.DEV`. `identity-review.js:17` requires `productionAcceptance === false`. Vite plugin `vite.config.js` `dev-only-connected-human-identity` is `apply: 'serve'`; middleware serves one label / hashed `manifest|body|hood|texture` under `.cache/character-mmo/identity-review-v1/` with `Cache-Control: no-store`. Assets stay out of `public/`. Production-graph DCE of the async chunk was not measured this turn (no build).

## Open gates / inherited limitations (not new regressions)

- **M5 recipe / capabilities.** Appearance remains `components: {}`. `HUMAN_SHAPE_CAPABILITIES.faceOrAge` / `hair` stay false. Reproduce log: saved identity and production release gates remain open.
- **Live motion.** `final-fits/report.json` stills only (`scope`: “no identity recipe acceptance”). Parent stills are diagnostic.
- **Young hood eye clearance.** `fit-human-identity-hood.py:48–52,105–113` now lifts the front lip to `eye_ceiling+4` cm in the garment frame. Treat as the in-progress parent correction; do not accept from stills. Symmetric cage still cannot author the original one-sided curtain (`:105–108`).
- **Unfitted released clothes.** Prepare replaces only body + `graveweaverHood` (`prepare-human-identity-review.mjs:65–80`). Wayfarer / pilgrim / lector / duskguard stay the published family on a 7038/7211-vert identity body.
- **Contract default labels.** `check-human-identity-contract.mjs:16` defaults to `['old','young-hair']`. Reproduce passes all three; the current contract file includes `young`.

## Action

Keep this as a DEV audition. Finish the young-hood eye-height clearance under live motion, then a saved identity recipe, before any M5 completeness claim.
