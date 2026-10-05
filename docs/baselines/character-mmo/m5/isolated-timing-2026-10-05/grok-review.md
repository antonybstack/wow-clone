# M5 isolated-timing review (bounded)

Parent-corrected items from the preceding message are treated as standing: coverage contract/manifest in `appearance-common`, `strictExecutionOrder`, facade-aware early/main loader ownership, identity-loader graph guard, held-Lite seed migration with empty-slot fill, preload hint removed. A later live prefetch report in `.cache/character-mmo/m5-isolated-timing-2026-10-04/prefetch-live.json` records all ten named cases and `passed: true`, including `early-selected-before-lite` and actually-hit stale shape/identity/starter rows. This reviewer did not re-read the three working files or the bundle after that passing run, and did not inspect pixels or the latest whole build.

## Remaining concerns

**Prefetch still certifies request sharing, not the native actor.** Last-read `scripts/ashen-reach/check-startup-prefetch.mjs` for the identity case asserts one compact body URL, one identity manifest, no `/startup/character/body-`, then migrated equipment/height/shape after `playableReady`. Scene mesh names, hair hide/show, clip set, and GPU morph weights are only in `scripts/ashen-reach/probe-playable-startup.mjs`. A dressed-state pass on prefetch can still miss a wrong head if equipment IDs match.

**Default-boot leak net omits identity URLs.** Last-read unsaved path asserts `human-shape-v1|appearance-storage` only. `human-identity-v1` is outside that pattern.

**Identity provenance is runtime-only in the last-read bundler guard.** `vite.config.js` `earlyCode` still required starter-character and human-shape hashes. `VITE_HUMAN_IDENTITY_SOURCE` lives in `src/ashen-reach/human-identity-assets.js`. `prefetch-live.json` `stale-identity-provenance` did reject from that chunk (`Human identities have changed…`, `manifestHits: 2`). A silent drop of the compiled identity hash would not fail the early-entry string check.

**Source/evidence skew on the stale-identity wait.** Last-read prefetch helper waited for `#loading-error` text `updated` and `assert.match(error,/updated/)`. Last-read identity throw is `have changed`. The passing JSON row contains `changed` and a `manifestHits` field that was not in that last-read script. If the wait is still only `updated`, that source cannot be what produced the passing identity row; this reviewer did not re-read the file.

**Hooded selected seed is the exercised identity path.** Compact-startup `seed-prime-ponytail.json` and the grouped pony pilot wear `graveweaverHood`. The probe then requires `HumanPonytail01` not visible. Grouped-pilot rows did list that mesh. Uncovered-hair first play is outside those runs.

**`bootDependencyChunk` still has no `test`.** It walks only `importedIds` from `resolve('src/ashen-reach/main.js')` and keeps `/src/` ids. Earlier same-priority groups (Lite, bootstrap, appearance-storage, appearance-common) win by index. Dev is unbundled. Pages vs lab multi-entry graph lookup was not re-checked on the claimed 338-resource build.

## Parent-corrected (not reopened)

`human-identity-assets.js` → `coverage-manifest.js` had been a path into `ashen-boot` / Lite. After the appearance-common move, a dist identity chunk inspected in this review imported `appearance-common`, `startup-preload`, and `appearance-storage` only. Held-Lite selected-body-before-`ASHEN` is what the parent reports as passing.

## Probe / claims

`probe-playable-startup.mjs` records failed/outlier rows, continues the cohort, and makes no FPS or one-second claim. At `playableReady` it reads grounded/physics, overlay gone, `supported-frame-completed`, compact body URL, playable clips, body/eyes/brows, morph length 2, and hair vs scalp cover. That is the native boundary the grouped 3-run pony pilot used (`955/962/948 ms`). A 3-run local compressed pilot is not a 20-run p95 or public-CDN gate. First-use GPU tail remains open.

## Inspected paths

`vite.config.js`, `scripts/ashen-reach/probe-playable-startup.mjs`, `scripts/ashen-reach/check-startup-prefetch.mjs`, `src/ashen-reach/startup-{preload,fetch,appearance}.js`, `human-identity-assets.js`, `coverage-manifest.js`, `main.js` playable fence, `loading-screen.js` / `error-display.js`, appearance `store.js` / `human-identity.js`, Rolldown `CodeSplittingGroup` / `ChunkingContext` docs, cache pilots (`cold-pony-pilot.json`, `cold-default-pilot.json`, `cold-pony-grouped-pilot.json`, `grouped-build-verified.json`, `build-grouped.log`, `prefetch-live.json` / `.log`), one then-current `dist/assets/human-identity-assets-*.js`.

## Limits

Read-only. No browser, harness, FPS, Telegram, or git. No re-audit of the build the parent now says has 338 exact compressed resources, character 200/200, startup 10/10, or all ten prefetch cases. No visual or physique judgement. Full cold/FPS/device cohorts and GPU first-use tails remain unverified here.This turn was a bounded read-only review of startup packaging and probes (docs/tooling); no visual cycle, Telegram clip, or queue work.