# Startup candidate code review — 2026-09-30

Read-only review of the uncommitted prefetch split. Files: `ashen-reach.html`, `vite.config.js`, `src/ashen-reach/main.js`, `src/ashen-reach/startup-assets.js`, new `startup-fetch.js` / `startup-appearance.js` / `startup-preload.js`, `scripts/test-startup-prefetch.mjs`. Prior GPU diagnosis remains `.cache/startup-gpu-2026-09-30/review.md`.

No browser, no build, no process, no agent. A pipeline-JS duration is not GPU time. The public first-run `onSubmittedWorkDone` outlier is still open; this candidate does not touch Lite runtime, shader opt-in, or the playable fence, and must not be reported as fixing it. Local 50/40 remaining ~940 ms on largest is still bandwidth. Public `05b396f7.fardel.pages.dev` still needs a same-contract comparison with the released baseline.

## Ranked findings

### 1. Production provenance defines no longer match the fetch module — integrity

`vite.config.js` `define` keys are the exact identifiers `import.meta.env.VITE_STARTER_CHARACTER_SOURCE` and `import.meta.env.VITE_HUMAN_SHAPE_SOURCE` (plus world/fast-start). The previous `startup-assets.js` used those identifiers. The moved `startup-fetch.js` reads `import.meta.env?.VITE_STARTER_CHARACTER_SOURCE` and `import.meta.env?.VITE_HUMAN_SHAPE_SOURCE`.

Those optional-chain spellings are not the define keys. The production guards are `if (expected && manifest.provenance?.sha256 !== expected)`. With `expected` left undefined, both starter-character and human-shape family checks skip. A stale JS worker can then accept a newer mutable `manifest.json` and install geometry/materials the bundle did not pin — the failure the define comments exist to throw (`The character has been updated. Reload…` / matching-family message).

`startup-preload.js` still uses the unchained `import.meta.env.VITE_FAST_START`, so that flag will inline. The hash checks are the ones that drifted.

**Needed proof.** Native production `startup-bootstrap` / fetch chunk must contain the inlined `humanShapeManifest.provenance.sha256` and `starterCharacterManifest.provenance.sha256` string literals beside the size/family checks. Restore the unchained `import.meta.env.VITE_*` reads (same shape as `VITE_FAST_START` in the early entry). A unit test that only stubs `import.meta.env` will miss this.

### 2. Saved boots that still use the starter pack lose HTML overlap and get no early fetch — ownership

`ashen-startup-preload` still injects an inline script that **returns without** starter-character `link rel="preload"` whenever any of `ashen.appearance.v2|v1` / `ashen.creator.v1` is truthy.

The new async module only starts network work when `usesHumanShapeStarter` is true (human + non-default build/height/gear). Neutral saved humans, saved default gear, and saved orc/undead therefore:

- skip the HTML starter-body/clothes preloads, and
- do not start `preloadStarterCharacter` until `main.js` has downloaded and run.

Customized saved humans are the cohort this entry actually overlaps with Lite. Default unsaved still gets the HTML starter preloads and never calls `import()` of `store.js` or `preloadHumanShapePack` — that part of the contract holds in source.

**Needed proof.** With each of: empty storage, saved `defaultAppearance()`, saved customized human, saved orc; record whether starter `/ashen-reach/startup/character/*` or `/ashen-reach/human-shape-v1/*` is requested from the async module before the renderer chunk evaluates. Saved default/orc must either keep HTML starter preloads or have the early module call `preloadStarterCharacter`.

### 3. Build graph guard covers only the early entry’s static walk — bundler

`early-saved-character` `generateBundle` fails the build if the early entry’s static `imports` chain contains `/node_modules/@babylonjs/lite/` or `/src/character/appearance/`. It does not inspect `dynamicImports` (correct: `store.js` must stay lazy). It also does not inspect the **main / ashenReach** entry.

`includeDependenciesRecursively: false` on `lite-runtime`, `module-preload`, `startup-bootstrap`, and `appearance-storage` is what keeps the preload helper out of Lite and keeps the equipment catalogue out of the appearance group. That same flag means a missed `test` regex (helper path, appearance folder, or the three `startup-*.js` files) silently emits extra chunks instead of folding them into the named group.

If `startup-fetch.js` / `startup-appearance.js` are copied into both the early entry and the renderer entry, `pending`, `savedAppearanceTask`, `starterManifestTask`, and `shapeManifestTask` are per module instance: prefetch and install will not share one request, and a retry map on one copy will not clear the other. `main.js` statically imports `./startup-appearance.js` and re-exports fetch through `startup-assets.js`; sharing depends on Rolldown emitting **one** module.

`generateBundle` also rewrites **every** `.html` asset that still contains `<!-- ASHEN_STARTUP_PRELOAD -->` to `<script type="module" async crossorigin src="/${entry.fileName}">`. `ashen-reach.html` is the only source with that marker. Confirm the post-`writeBundle` `/` copy of that document still has exactly one such script.

**Needed proof (native `ASHEN_PAGES=1` / starter build, `ASHEN_LITE_BUNDLE` left on):**

| Check | Pass |
| --- | --- |
| Early entry static imports | only the named `module-preload` helper (+ the `startup-bootstrap` files themselves) |
| Early `dynamicImports` | `store.js` / `appearance-storage` only, and only from `startup-appearance.js` |
| Main / ashenReach static imports | no `src/character/appearance/` module, no `appearance-storage-*` chunk |
| `appearance-storage-*` | does not contain equipment-catalogue source |
| `lite-runtime-*` | does not contain `startup-fetch.js` / `startup-appearance.js` / `startup-preload.js` |
| Module identity | one file owns `startupAssetBuffer` / `loadStartupAppearance`; both entries import that file |
| Default HTML | no `modulepreload` / `preload` of `appearance-storage` or `/ashen-reach/human-shape-v1/` |
| `ASHEN_LITE_BUNDLE=0` | either still satisfies the early-entry walk, or is a documented non-native path |

The plugin already throws `Missing early saved-character entry` / `eagerly imports optional renderer/storage code` for two of these; the rest are still unasserted.

## What the new tests already pin

`scripts/test-startup-prefetch.mjs` is real coverage for:

- `usesHumanShapeStarter` / `permitsSavedAppearance` diagnostic query names (including `preloadedEquipment`)
- one `loadStartupAppearance` promise shared inside a single module instance; corrupt JSON stays in storage (`restored: false` + warning); `localStorage` throw returns `null`
- compact then full human-shape fetches share one manifest request and one `startupAssetBuffer` per URL
- failed speculative manifest and buffer fetches null the cached task / `pending` entry and retry

`loadStartupAppearance` still only `import()`s `../character/appearance/store.js` and calls `loadAppearance()`. There is no parallel decoder and no fetch URL taken from storage; equipment ids are keys into the build-owned manifest (`manifest.items[id]`), then `selected.items[id].url`.

`main.js` still `appearanceAPI ||= await import('../character/appearance/store.js')` on save / post-play editor, same specifier as the early loader.

Retry swallowing on the async module (`.catch(() => {})`) does not convert `starterCharacterP` itself; `main.js` still `await`s that same task at body/equipment install.

## Tests still missing (failure / retry / migration)

- **v1 and `ashen.creator.v1`:** a record in either key, no v2, must call the real `loadAppearance()` (migrations + validation) once, and `usesHumanShapeStarter` must see the migrated shape/equipment. Current tests only mock v2.
- **Query override still wins after a valid save:** `?creator` / `?humanShape` / `?preloadedEquipment` must return `null` from `loadStartupAppearance` and must not start `human-shape-v1` from the async module.
- **Gzip + size mismatch:** `compression: "gzip"` wrong length deletes `pending` and retries; a second good response is used. Uncompressed path is the only one tested.
- **`compactItems` holes:** every id selected from `manifest.items` must exist in `compactItems` when `compact: true`. A missing compact row currently `startupAssetBuffer(undefined)` inside a swallowed `.catch`, then returns a pack `main.js` will later `await` as the playable body.
- **Provenance throw still reachable** after finding 1 is fixed: wrong `sha256` / wrong `shapeFamily` / `targetNames` rejects, nulls `shapeManifestTask` / `starterManifestTask`, and the next call can fetch again.
- **Native HTML + two-entry sharing** (finding 3 table). Node `?valid` / `?corrupt` query imports prove per-instance maps; they do not prove the browser build has one instance.

## Limits of this pass

Did not execute the test file, a Rolldown build, or a live game. Did not re-read `store.js` migrations beyond the call site. Did not treat local 50/40 or a Pages preview as GPU-service evidence. First-run public fence remains an open measurement from `review.md`.
