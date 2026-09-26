# Adversarial review — Babylon Lite 1.31.1 migration

Reviewed 2026-09-26 against checkout `33634c6` (`main`, clean, even with `origin/main`). Installed and locked `@babylonjs/lite` is **1.31.1** (`sha512-yA9A9OwT6onJJfQaDetIix6PhFVtUj2WHaGQYmKRm94s61DfoWOq7QbPv0C4EoqmtCzoR4InWg0zWbEvjFJ1Bw==`). Locked Havok is **1.3.14**. The Babylon Lite docs cache used for API checks is npm 1.31.1 at GitHub `2e064d88` (2026-09-25). This review treats the milestone write-ups as claims. Conclusions below come from the current source, the installed 1.31.1 implementation, the 1.28.0 package, tracked baselines, local capture JSON, and the live production HTML.

## Verdict

The M0–M4 migration and the F1–F7 follow-ups are present in the tree, and the production page is serving the bundle named in the release note. I do not have a confirmed critical break in walking, shadows, or the first-frame HDR path from the evidence I could check without replaying the game.

The ledger’s “complete” rows are narrower than they sound. F5 and F7 finished as bounded trials: the skeletal CSM retirement bridge, the far/local PCF bridges, the plugin-free caster alias, the half-resolution targets, and the borrowed bloom view are still in the runtime. Frame-time tails are still in the raw traces. Scene teardown still destroys shadow GPU resources while the frame scheduler is allowed to have submitted frames outstanding, and the disposal checks sample GPU errors before that teardown.

## Confirmed findings

### 1. Medium — shadow teardown destroys GPU resources that submitted frames can still reference

`createRenderLoop` allows four submitted frames (`maxPending: 4`) and only waits with `waitForGpuIdle` between frames (`src/ashen-reach/render-loop.js` lines 7–16). Scene disposal runs user callbacks synchronously. The frame-graph disposer is registered first. The sun and local-light cleanups run next and immediately `releaseTexture` the acquired depth wrappers and call `.destroy()` on the generator uniform buffers (`src/ashen-reach/sun-shadows.js` lines 90–102, `src/ashen-reach/local-lights.js` lines 23–31). The render-loop stopper is registered later, so it has not run yet when those destroys happen. `releaseTexture` drops the allocation count and calls `GPUTexture.destroy()` as soon as the count hits zero (`node_modules/@babylonjs/lite/lib/resource/texture-allocation-release.js` lines 9–16).

Lite’s own CSM and PCF task targets are `_eager` with `_ownsDepthTexture: false`, so task disposal does not free those depth textures (`lib/shadow/shadow-base.js` lines 147–170, `lib/engine/render-target.js` lines 87–88). The application release is the real free, which matches the retained L02 exception. That free is not behind a queue fence. The microtask in `sun-shadows.js` lines 161–170 fences only the detached CSM task object, and only after a membership change.

`waitForGpuIdle` is the wrong sole primitive for this cleanup. Its declaration says it resolves when work submitted before the call completes, and that it does not drain deferred resource releases; `waitForGpuResourceRetirements` is the teardown boundary (`index.d.ts` lines 15454–15465).

`scripts/ashen-reach/check-camera.mjs` lines 85–91 reads `__gpuErrors` and then calls `disposeScene`. A validation error raised by the destroy would not fail that check.

**Impact.** Steady play is unaffected. Disposing the scene during play, which the camera, HDR, and woodland checks do, can destroy a depth texture or uniform buffer named by a command buffer that has not finished. WebGPU treats that as a validation error. If the device records it, later in-page work on that device is suspect.

**Reproduction.** Boot a 1280×720 WebGPU session, walk until shadows are sampling, call `disposeScene` while the render loop is running, and keep the `uncapturederror` listener attached until `waitForGpuIdle` resolves after the dispose. Falsify if that listener stays empty across repeated disposals on Chromium 153.

**Fix.** Stop the scheduler before any generator destroy. After the last `renderFrame` returns, `await waitForGpuIdle(engine)`, then `releaseTexture` / destroy the generator buffers, then `await waitForGpuResourceRetirements(engine)`. Fold the CSM retirement microtask into that same sequence so a membership change and a scene dispose cannot free the depth texture and then dispose the old task on a destroyed device. `onSceneDispose` cannot be async; start this from the render-loop dispose, which already owns the scheduler, and make the shadow controllers expose a fenced `releaseGpu()` rather than destroying inside their current synchronous callback. Sample `__gpuErrors` after that fence in `check-camera.mjs` and `check-hdr.mjs`.

### 2. Low — per-frame math and list allocations remain on the hot path

These are present on 1.31.1 and were already the shape of the 1.28 code. They are not a migration regression. They are large enough to keep in view while the frame-time tails are unexplained.

- `equipment-stream.js` `update` calls `sockets.sync` every visible frame (lines 331–339). `toCapsule` calls `invertMat4`, `multiplyMat4`, and `decomposeMat4` (`src/character/sockets.js` lines 149–164 and 234–245). Each of those public functions allocates. `allocateMat4` returns a fresh 16-element array (`lib/math/_matrix-allocator.js` lines 25–27). `index.d.ts` exports `invertMat4`, `multiplyMat4`, and `decomposeMat4`, and does not export a `ToRef` multiply or invert.
- `createSunShadows` `update` allocates a filtered copy of `scene.meshes` on every `onBeforeRender` (`sun-shadows.js` lines 149–154), then usually discards it.
- `createDisplayPass` allocates a `Float32Array` inside `execute` (`display-pass.js` line 20). `createContactOcclusion` allocates a position object inside `execute` (`contact-occlusion.js` lines 123–127). Both `execute` paths run every frame.

**Fix.** Keep one scratch `Mat4` and one decompose result in the socket adapter and multiply in place with project-owned math (the same pattern as `mat4Multiply` in `src/character/runtime/fit-contract.js`). Reuse the sun-shadow candidate array. Hoist the display and contact scratch values the way `hud-projection.js` already reuses its result object. Re-measure the same 12 routes before calling that a tail fix. Do not import `multiplyMat4IntoBuffer`; it is not a public export.

### 3. Low — disabling shadows still redraws the custom far and local maps

`setEnabled` calls public `setShadowGeneratorEnabled` on the CSM generator only (`sun-shadows.js` lines 175–179). Installed 1.31.1 implements that by writing darkness `1` into the CSM uniform buffer and skipping `_renderShadowMap` while disabled (`lib/shadow/shadow-enabled.js` lines 32–48). Custom receivers also return early on `state.enabled`. The far task (`sun-shadows.js` lines 188–194) and both local spot tasks (`local-lights.js` lines 112–119) have no enabled check, so they keep ensuring and drawing maps that the shaders then ignore.

**Impact.** Extra shadow draws while the dev/runtime shadow toggle is off. The enabled image is unchanged.

**Fix.** If `state.enabled` is false, return 0 from those custom `execute` functions after the maps have been created once. Keep the bindings. Do not dispose the depth textures on toggle; that is the failure mode the F5 note already recorded for a generator disable that leaves a stale map bound.

### 4. Low — Havok is locked, but `package.json` still allows a newer 1.3.x

`package.json` line 19 is `"@babylonjs/havok": "^1.3.14"`. `package-lock.json` resolves 1.3.14 exactly, and `npm ci` will keep it. A later `npm update` can move Havok without a Lite change. The migration plan said to keep the locked 1.3.14.

**Fix.** Set the dependency to `1.3.14` with `--save-exact` in its own commit, then re-run the real Havok lifecycle test and one built-bundle movement check.

## Likely risks

- **Startup device loss is unhooked.** The lost-device listener is attached in `createRenderLoop` (`render-loop.js` lines 30–38), after `registerSceneWithShadowSupport` and `start`. A loss while the churchyard or body is still loading has no reload panel. F1 covers loss after the loop exists. I did not inject a loss during loading.
- **The private bridges refuse any Lite other than 1.28.0 or 1.31.1.** `createSunShadows`, `createLocalLights`, and `lite-skin-layout.js` throw on another `VERSION`. That is the right guard for these field layouts. A 1.31.2 patch will not boot until those guards and the field checks are re-validated.
- **`rebuildMaterial` completion is still fire-and-forget.** Installed `rebuildMaterial` returns `void | Promise<void>` and logs a rejection (`lib/material/material-rebuild.js` lines 8–14). `configureLinearMaterials` does not await it (`linear-materials.js` lines 68–81). The in-file comment already says the `onBeforeRender` scan is not a first-draw guarantee. `registerLateFeatures` calls that attach between unregister and register (`register-late-features.js` lines 2–7) and does not collect the promises. Spell billboards themselves are drained by `buildScene` during the second register, which is the right public path. A PBR material added in that window can still compile a frame late.
- **Frame tails are real and still unexplained.** They are not a failed >120 FPS gate. See the measurements section.

## Unverified

- I did not open the VE MP4s or the Telegram deliveries. Stills are not motion acceptance. Files I did open: `docs/baselines/lite-1.28.0-2026-09-25/shots/churchyard.png` (churchyard, clothed character, HUD, lamps) and `ve-capture/ashen-reach/lite1311/final-release/after.png` (bridge approach toward the cathedral, same HUD). `ve-capture/ashen-reach/lite1311/m4-performance/failure.png` is an unlabeled churchyard capture; nothing in `m4-performance/REPORT.md` describes it, so I am not treating it as a reproduced defect.
- I did not re-run the live route matrix, the mobile depth fallback, desktop WebKit, or a physical iPhone. No on-device frame log is in the repo. The release notes already separate iPhone acceptance; that separation is still accurate.
- I did not re-run the F5 experiment that removed CSM task retirement. The retained bridge matches a real wrapper hazard: `enableSkeletonShadows` rewrites caster identity through `Object.create` proxies and then `restoreSourceCasters` puts the source list back (`lib/shadow/deformable-shadow-casters.js` lines 45–101). Incremental `ensureCsmShadowTaskState` can miss the meshes actually bound in the old task. The live “zero samples without the bridge” result is the implementation team’s, not mine.
- `conditions.gpu` is `null` in both the tracked 1.28.0 performance JSON and the local final report. The runs record HeadlessChrome 153.0.8010.54 on an M1 Max. A successful boot implies WebGPU, because the game has no WebGL engine, but the adapter name was not stored.

## Validated decisions

- **Physics ownership matches Lite 1.31.1.** `disposePhysics` stops stepping, clears `_afterStep`, removes remaining bodies, and does not release shapes (`lib/physics/havok.js` lines 1076–1099 and 1242–1264). The character controller releases its own body, current shape, and both query collectors, including the shape replaced by `setShapeOptions` (`lib/physics/character-controller.js` lines 243–314). `createPhysicsOwnership` disposes the controller first, releases the camera query shape while the world exists, then releases caller bodies and shapes, then calls `disposePhysics` once (`src/player.js` lines 135–156). Mesh aggregates reuse the caller-supplied shape instead of allocating a second one (`havok.js` lines 1117–1138). `node --test scripts/test-player-physics-lifecycle.mjs` passed against real Havok 1.3.14, including the release counts (2 body, 4 shape, 2 query collector, 1 world).
- **Math rename is atomic and semantically the same decompose as 1.28.0.** No first-party `mat4Invert` / `mat4Multiply` / `mat4Decompose` / `mat4Translation` imports remain. `multiplyMat4(a, b)` is `a * b` column-major (`lib/math/multiply-mat4.js` lines 4–8). I unpacked `@babylonjs/lite@1.28.0` under `/tmp/ashen-grok-lite-review-2026-09-26`. Its `mat4Decompose` already returned a negative `scale.y` for a negative determinant and built the quaternion from the un-mirrored basis. Installed `decomposeMat4` does the same (`lib/math/decompose-mat4.js` lines 29–38). The current docs’ “behaviour change” note is about versions older than 1.28.0. Socket code that keeps translation and rotation and sets a positive node scale was already living with that decompose.
- **Bloom threshold compensation still matches 1.31.1.** `extract-highlights.js` uploads `pow(threshold, 1/2.2)` (lines 3 and 30). `post.js` passes `1.2 ** 2.2`, so the shader compares against 1.2. Leave it.
- **F6 uses the public registration contract.** `unregisterScene` only removes the context (`lib/scene/scene-core.js` lines 285–288). `registerSceneWithShadowSupport` returns immediately if the context is still registered (lines 266–269) and otherwise `buildScene`, which drains `_deferredBuilders` (lines 227–232). Billboard systems enqueue those builders (`lib/sprite/billboard-scene.js` lines 4–14). The helper awaits that second register (`register-late-features.js`). The loading overlay is opaque and still up when this runs (`loading-screen.css` line 3, `main.js` lines 170–171 then 256).
- **F7 surface targets follow the 1.31.1 resize rules that were actually shipped.** `createSurfaceRenderTargetTexture` shares color and depth facades and resizes through `_syncEager` (`lib/texture/rtt-surface.js` lines 10–22 and 85–124). Scene `_resize` rebuilds the frame graph (`lib/scene/scene-core.js` lines 72–74), and `resizeSurface` calls that hook when the backing store changes (`lib/engine/surface.js` lines 106–130). Half-resolution fog and AO stay on `createRenderTarget` with a mutated `{width, height}` because a surface `scale` uses `Math.floor` (`lib/engine/render-target.js` lines 102–110) while the shaders use `Math.ceil(source / 2)`. Replacing them with `scale: 0.5` would change odd portrait sizes. Bloom’s output stays a borrowed task texture; `display-pass.js` line 15 still reads `_colorView` for that path. That is the gap the plan allowed.
- **F1 does not enable native scene recovery.** `lib/shadow/shadow-recovery.js` lines 13–14 throws unless the generator is ESM. The reload panel, input lock, and `engine._device.lost` handling match that limit (`render-loop.js` lines 30–38, `loading-screen.js` lines 68–84, `input.js` lines 84–88).
- **F3 and F4 asset checks pass on the current files.** `scripts/test-chest-hit-contract.mjs` and `scripts/test-orc-color-cleanup.mjs` passed in this review (17 tests together with the physics file, 0 failures). Shipped Hit_Chest clips in the contract have zero Hips translation channels. The runtime `stripRootTranslation` remains only for `/characters/base.glb` and `source-reference` (`body-visual.js` lines 74–90 and 235–240).
- **Production bundle name matches the release note.** `curl -L https://play.sparkify.dev/ashen-reach.html` returned 200 at `https://play.sparkify.dev/ashen-reach` and the HTML references `ashenReach-Cb6x_hI8.js`. I did not replay production movement. The local `production-runtime.json` says 14.06 m, Havok on, 1280×720, seven enemies, no GPU errors; that file is an ignored capture, not a re-run from this review.
- **HUD projection uses the public function and copies coordinates before the next point.** `projectWorldToScreenToRef` sets `clipped` for behind-camera and offscreen points (`lib/camera/world-to-screen.js` lines 49–75). `combat-hud.js` lines 116–139 writes `cssX` / `cssY` into style before projecting the next marker, so the reused result object is safe there.

## Measurements

Conditions that match across these files: Apple M1 Max, darwin arm64, HeadlessChrome 153.0.8010.54, 1280×720 canvas, seven enemies, Havok on, 12-second runs, warmup 1.5 s, `recording: false`, `vsyncCapped: false`. `gpu` is null in the JSON. Means below are arithmetic means of the runs in that file. I computed them from the JSON, not from the prose.

| Set | File | Town | Bridge | Cathedral | Forest | Worst frame in the file |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 1.28.0 baseline, 3 runs, commit `30d205c` | `docs/baselines/lite-1.28.0-2026-09-25/performance-raw.tar.gz` | 178.09 | 217.71 | 225.48 | 190.60 | 22.4 ms town |
| M4 paired 1.28.0, first pass | `ve-capture/.../m4-performance/lite128/measure.json` | 179.48 | 219.54 | 225.60 | 191.20 | 22.2 ms town |
| M4 paired 1.28.0, repeat | `.../lite128-repeat/measure.json` | 179.57 | 217.72 | 225.60 | 191.29 | **96.1 ms bridge** |
| M4 paired 1.31.1, first pass, commit `ff91340` | `.../lite1311/measure.json` | 179.86 | 219.48 | 226.25 | 191.62 | 36.7 ms bridge |
| M4 paired 1.31.1, repeat | `.../lite1311-repeat/measure.json` | 179.78 | 219.49 | 225.47 | 191.09 | **60.5 ms bridge**, 53.3 ms cathedral, 28.8 ms forest |
| F1–F7 candidate, 3 runs, commit `52700a0` | `ve-capture/.../final-performance/report.json` | 179.43 | 218.88 | 225.53 | 191.68 | 16.9 ms bridge (one frame over 16.67 ms) |

Frames over 16.67 ms, summed across both M4 passes: town 2 → 0, bridge 4 → 4, cathedral 0 → 1, forest 0 → 1. That matches the published M4 table. Every run in these files is above 178 FPS. The 5% / 10% route gates are not tripped. The 96.1 ms and 60.5 ms samples are single frames, so they move the worst-frame column and barely move p99. The baseline report itself said a foreign Chrome game tab was open; the M4 pair is the comparable set. The final `52700a0` run is a later session, within 1 FPS of the M4 1.31.1 means, and it is not a paired 1.28.0 rerun.

Load time was not re-measured here. The baseline doc’s 10.48 s local and 50.80 s production figures stay unverified by this pass.

## Coverage matrix

| Item | Status | Evidence |
| --- | --- | --- |
| M0 baseline and check URLs | Implemented, with gaps | Tracked performance tar and `docs/baselines/lite-1.28.0-2026-09-25/summary.json`. Contact and local reports store `visitedUrl`. Camera, HDR, sun, exploration, and region rows in that summary have null URLs. `conditions.gpu` is null. |
| M1 physics | Implemented | `src/player.js` ownership ledger; real Havok test passed. In-place full game restart was out of scope and is still absent. |
| M2 private bridges | Implemented as contained debt | Version guards, acquire/release comments, and socket adapter exist. Final GPU destroy is not fenced (finding 1). L02 is not eliminated. |
| M3 exact 1.31.1 and math rename | Implemented | `package.json` / lock / installed package are 1.31.1. Havok lock is 1.3.14; the manifest range is still `^1.3.14` (finding 4). No stale `mat4*` Lite imports. |
| M4 production gate | Implemented on desktop evidence | Live HTML serves `ashenReach-Cb6x_hI8.js`. Paired FPS JSON matches the release table. Motion clips were not reviewed in this pass. iPhone not run. |
| F1 device loss | Implemented | Reload dialog in `ashen-reach.html`, input lock, no `enableDeviceLostSceneRecovery`. Loss before the render loop is uncovered. |
| F2a lazy decoder | Implemented | `formatGameError` dynamic-imports `decodeError` only for `#digits` Lite errors (`error-display.js`). Startup does not import the decoder. |
| F2b HUD projection | Implemented | `hud-projection.js` calls `projectWorldToScreenToRef` with reused objects. Style is written before the next project. |
| F3 chest hit | Implemented | Asset contract test passed. Runtime strip remains for the legacy `base.glb` path only. |
| F4 orc colors | Implemented | Shipped-asset test passed: no `COLOR_0` on the orc pack primitives covered by `test-orc-color-cleanup.mjs`. |
| F5 shadow trial | Partial, by the plan’s stopping rule | `setShadowGeneratorEnabled` is used. CSM `_shadowTaskState` retirement, far PCF field access, and the `_pi` caster alias remain. “Complete” means the trial ended, not that the bridge is gone. |
| F6 late features | Implemented | `register-late-features.js` unregisters, prepares materials, and awaits `registerSceneWithShadowSupport`. |
| F7 sampled targets | Partial, by the plan’s stopping rule | Scene and contact-composite targets use `createSurfaceRenderTargetTexture`. AO, fog half targets, bloom output, and contact `shadowTexture._colorView` stay private. |
| E1 CSM static cache | Deferred | `forceRefreshEveryFrame: true` is still set on the near CSM (`sun-shadows.js` lines 106–109). No `enableCsmStaticCache` call site. |
| E2 async pipelines | Deferred | `createEngine` in `main.js` does not pass `enableAsyncShaderPipelineCompilation`. |
| D1 compute probes | Deferred | `foliage-lod-probe.js`, `sun-shadow-probe.js`, and `local-light-probe.js` still open `engine._device`. |
| D2 VAT crowds | Deferred | Enemies are still independent skinned actors. |
| L01 Havok teardown | Implemented | See M1. Calling only `disposePhysics` would still leak shapes; the app does not do that. |
| L02 CSM owner release | Partial | Final `releaseTexture(csmTexture)` remains, which is required because the generator never acquires its own depth texture. The in-flight fence required by M2 is missing on that path. |
| L03 chest-hit mutation | Implemented for shipped races | Legacy adapter kept, with a test. |
| L04 orc vertex colors | Implemented | Runtime `_gpu.colorBuffer` clear is gone from the playable path; asset prep removes neutral colors. |
| L05 socket matrices | Implemented as one adapter | `lite-skin-layout.js` is the only `_gltfMixer` / `_debugWorldMat` reader in character runtime. No public socket-world API exists in 1.31.1. |
| L06 shadow/PBR private fields | Partial | Public enable toggle adopted. PCF task, UBO, and caster-alias fields remain. |
| L07 eager decoder | Implemented | See F2a. |
| L08 device loss | Implemented | See F1. Native recovery correctly rejected: `rebuildSceneShadowGenerators` throws on non-ESM generators. |
| L09 deferred spell builders | Implemented | See F6. `rebuildSceneRenderables` was not used as a substitute. |
| V01 math | Implemented | See M3. |
| V02 render-target facades | Partial | See F7. |
| V03 HUD projection | Implemented | See F2b. |
| V04 compute | Deferred | See D1. |
| T01 / T02 / T03 | Deferred | See E1, E2, D2. The plan allowed that after M4. |

## Tests and what they do not prove

Passed in this review, with no source edits:

```sh
node --test scripts/test-player-physics-lifecycle.mjs \
  scripts/test-shadow-bridge-lifecycle.mjs \
  scripts/test-hud-projection.mjs \
  scripts/test-lite-rtt-facade.mjs \
  scripts/test-lite-skin-layout.mjs \
  scripts/test-register-late-features.mjs \
  scripts/test-game-error-display.mjs \
  scripts/test-contact-composite-facade.mjs
node --test scripts/test-orc-color-cleanup.mjs \
  scripts/test-chest-hit-contract.mjs \
  scripts/test-player-physics-lifecycle.mjs
```

The first command reported 24 passing tests. The second reported 17 passing tests. The shadow-bridge file mocks `@babylonjs/lite` through a `data:` URL and counts fake `acquire` / `release` calls. It does not create a GPU device, so it cannot catch finding 1. The default mock version in that file is `1.28.0`; the 1.31.1 case is a string flag, not the installed package.

The full character, equipment, and Pages build gates from the migration plan were not re-run. Live route, WebKit, and depth-fallback checks were not re-run.

## Fix sequence

1. **Fence shadow and local-light teardown.** Stop the scheduler, await `waitForGpuIdle`, destroy generator-owned textures and uniform buffers, then await `waitForGpuResourceRetirements`. Point the CSM retirement microtask at that same sequence. Extend the camera and HDR disposal checks so they record uncaptured GPU errors after the fence. Gate: ten disposals during an active 1280×720 shadowed session, zero uncaptured errors, and the pre-dispose shadow still moving with the character.
2. **Leave the CSM retirement bridge in place** until a live unequip/equip probe shows non-zero actor-shadow samples without it. A unit mock that nulls `_shadowTaskState` is not that probe.
3. **Attribute one long frame before changing shadow cache or async compilation.** Capture a single bridge run with the existing GPU timestamp switch and a CPU profile around the 16–60 ms samples. Adopt `enableCsmStaticCache` or `enableAsyncShaderPipelineCompilation` only if that profile says the cascade redraw or a shader compile is the sample. Re-run the paired 12-route set. The acceptance gate stays: every run above 120 FPS, and no repeatable median drop over 5% or p99 rise over 10% against the M4 1.31.1 files.
4. **Pin Havok to 1.3.14 exactly** when the next dependency commit happens. Re-run `scripts/test-player-physics-lifecycle.mjs` and one built-bundle movement check.
5. **Scratch-buffer the socket sync and the per-frame caster filter** only if step 3 shows allocation in the long frames. Do not rewrite the socket transform chain in the same change.

## Limits of this pass

No browser session was driven. No MP4 was decoded. No iPhone was used. Production was checked by fetching HTML, not by walking the deployed scene. The 1.28.0 decompose comparison used a temporary npm pack in `/tmp/ashen-grok-lite-review-2026-09-26` and did not change the repo lockfile. Ignored `ve-capture` JSON was read as local evidence; it is not in git.
