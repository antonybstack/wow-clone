# Babylon Lite 1.31.1 migration and audit follow-through

Reviewed 2026-09-25 against project commit `23049ab`, installed Lite **1.28.0**, Havok **1.3.14**, and the published Lite **1.31.1** package. This is an implementation plan: the review has not upgraded dependencies, changed runtime behavior, or demonstrated candidate changes in live play.

## Recommendation and scope

Proceed with a narrowly scoped upgrade to **exactly 1.31.1**, after correcting physics teardown and establishing a fresh baseline. The release brings relevant resource and shadow fixes, and useful public APIs. It also removes math exports that this project uses. Existing private animation/shadow integrations make this a moderate-risk runtime migration, despite the small version increment.

Complete the required migration through M4 before starting the independent follow-ups. Preserve the approved world, characters, lighting, input, seven enemies, and Havok movement. The normal build includes the character lab and body preview; these shared-dependency entry points are part of compatibility verification. Archived Duskwell and vendored offline math implementations are excluded. Do not add Babylon Classic, redesign combat, replace the animation system, or introduce terrain streaming.

The [original documentation audit](babylon-lite-documentation-audit-2026-09-25.md) remains the guide-page inventory. The decisions below supersede its original action suggestions. Reading a public API description establishes a candidate; it does not establish behavioral equivalence or a performance improvement.

## What the second review established

The review checked the current callers, installed 1.28 runtime/declarations, the exact 1.31.1 npm runtime/declarations, all four intervening release notes, and relevant upstream changes. It did not repeat a semantic review of all 1,817 API pages or run the proposed runtime experiments.

| Audit ID | Validity and decision | Work item |
| --- | --- | --- |
| L01: Havok teardown | **Confirmed, implement.** Missing world cleanup also includes controller collectors, static/animated collider shapes, callbacks, and partial-initialization cleanup. Calling only `disposePhysics` is insufficient. | M1 |
| L02: borrowed CSM texture | **Contract mismatch confirmed; severity reduced.** No current double free was established. Both versions acquire a generator owner reference but expose no public generator disposer, and the reviewed runtime has no matching owner release. Removing the application's final release can leak. Keep a documented, tested ownership exception until a complete public lifecycle exists. | M2 |
| L03: private animation mutation | **Confirmed, narrower than the original wording.** `stripRootTranslation` is applied to the **chest-hit reaction**, not locomotion generally. Prefer preprocessing this one channel in shipped assets; preserve all other translation tracks. | F3 |
| L04: private vertex-color buffer mutation | **Confirmed and active for the orc.** Its shipped body has seven primitives with `COLOR_0`; the inspected active human/undead bodies have none. Do not remove the workaround based on a human-only test or the unrelated upstream missing-color fix. | F4 |
| L05: private socket matrices | **Confirmed, retain an isolated bridge.** Neither reviewed version has an equivalent public live socket-world reader. Preserve the established transform chain and verify it across races/equipment. | M2 |
| L06: private shadow/PBR integration | **Confirmed, partly unavoidable.** Public caster APIs cover membership but not every far-PCF texture, task, or plugin-exclusion requirement. Upstream PCF fixes do not prove the custom CSM retirement workaround is obsolete. | M2; optional F5 |
| L07: eager error decoder | **Valid small improvement.** Both static `decodeError` and `enableErrorDecoding` imports need to leave the startup path to remove the message table. Preserve readable failures. | F2 |
| L08: device loss | **User recovery should improve; proposed native recovery is unsuitable.** The documented helper does not recover PCF/CSM shadows. It also does not restart our custom scheduler. Offer an explicit page reload; defer seamless recovery. | F1 |
| L09: deferred builders | **Original replacement is not equivalent.** `rebuildSceneRenderables` does not drain the deferred feature builders used by spell sprites. Keep behavior unless a tested public registration arrangement replaces the whole operation. | F6 |
| V01: math migration | **Confirmed upgrade blocker.** Rename four exports in the same working change/commit as the dependency bump; new names are absent in 1.28. | M3 |
| V02: render-target facades | **Useful optional refactor, not an upgrade blocker.** Existing bare `createRenderTarget({size: engine})` and public `engine.scRT` remain supported in 1.31.1. | F7 |
| V03: HUD projection | **Recommended bounded reuse after upgrading.** Native projection can replace local clip-space math while retaining canvas-relative CSS layout. | F2 |
| V04: diagnostic compute wrappers | **Defer.** Existing opt-in raw WebGPU probes already have bounded lifecycles. Rewrite only with a demonstrated simplification. | D1 |
| T01: CSM static caching | **Experiment only.** Must preserve deforming casters, woodland changes, and camera refits. | E1 |
| T02: async compilation | **Experiment only.** Eligible ShaderMaterial pipelines benefit; this is not a universal PBR/post-processing solution. | E2 |
| T03: VAT crowds | **Defer.** Seven enemies and live sockets do not justify a crowd architecture rewrite without profiling evidence. | D2 |

Additional omissions now covered: exact dependency pinning; controller/shape ownership; failed setup cleanup; race-specific color coverage; conditional asynchronous material rebuilds; release-sensitive material/texture ownership; dev-only versus built-bundle tests; tests accidentally pointed at the default server; fresh GPU timing baselines; and the difference between disposing a physics subsystem and restarting the entire game in place.

## Release changes and their actual effect here

Review the pinned release, not `master` or npm `latest`, when executing this plan. Use the installed package's `index.d.ts` and `lib/` to verify any implementation detail.

| Release / UTC date | Relevant changes and project decision |
| --- | --- |
| [1.29.0](https://github.com/BabylonJS/Babylon-Lite/releases/tag/npm-lite-v1.29.0), Sep 14; `fbbf158` | [Math names change without compatibility aliases (#688)](https://github.com/BabylonJS/Babylon-Lite/pull/688): required migration. Native world-to-screen projection is useful later. [Distributed static CSM refits (#701)](https://github.com/BabylonJS/Babylon-Lite/pull/701) add an experiment option, not a default setting change. New ArcRotate keyboard controls and compatibility scene pointer observables do not replace our coordinated LMB/RMB/touch controls. |
| [1.30.0](https://github.com/BabylonJS/Babylon-Lite/releases/tag/npm-lite-v1.30.0), Sep 15; `4de3381` | [Lights become scene nodes (#718)](https://github.com/BabylonJS/Babylon-Lite/pull/718); ours are factory-created and already comply. Verify transforms rather than rebuilding the light system. [Solid-texture ownership (#683)](https://github.com/BabylonJS/Babylon-Lite/pull/683), [preload caster membership (#684)](https://github.com/BabylonJS/Babylon-Lite/pull/684), and [PCF task retirement (#686)](https://github.com/BabylonJS/Babylon-Lite/pull/686) justify lifecycle and equipment/shadow regression tests. |
| [1.31.0](https://github.com/BabylonJS/Babylon-Lite/releases/tag/npm-lite-v1.31.0), Sep 21; `3ce8ae6` | [Explicit resource lifetimes (#728)](https://github.com/BabylonJS/Babylon-Lite/pull/728) affect ownership, rebuilds, and shader/plugin isolation. Its `RenderTask.addMesh` and surface-sized `createRenderTargetTexture` breaking changes do **not** match active callers: we use neither flow. `createRenderTarget` is a different API. Private target fields still exist in the exact runtime, although they remain unsupported dependencies. [GPU timing fix (#730)](https://github.com/BabylonJS/Babylon-Lite/pull/730) means old and new GPU timings need careful interpretation. |
| [1.31.1](https://github.com/BabylonJS/Babylon-Lite/releases/tag/npm-lite-v1.31.1), Sep 24; `7d66215` | [Material accessors/rebuild completion (#760)](https://github.com/BabylonJS/Babylon-Lite/pull/760) make `rebuildMaterial` return `void \| Promise<void>`; verify first-draw readiness and rejected promises. [Uniform access (#761)](https://github.com/BabylonJS/Babylon-Lite/pull/761) returns live arrays from the new getter; existing setters are compatible. Do not mutate getter backing storage. USD, compatibility wrappers, easing additions, and new demos need no adoption for this task. |

Two tempting but incorrect substitutions:

- [Shared final-color WGSL (#709)](https://github.com/BabylonJS/Babylon-Lite/pull/709) and [missing vertex-color fallback (#735)](https://github.com/BabylonJS/Babylon-Lite/pull/735) concern an opt-in ShaderMaterial color helper. They do not replace the PBR linear-output plugin in `src/ashen-reach/linear-materials.js` or establish that the orc workaround can be removed.
- `getShaderUniform` throws for undeclared names; there is no `hasShaderUniform` in 1.31.1. It is not a replacement for `_uniformValues.has` in `materials.js`/`local-lights.js`. A later cleanup can use declared-name metadata owned by our material factories. This is not a migration blocker.

## Execution contract for GPT-6 Sol, medium effort

Work through M0–M4 in order. Each item names its files, required outcome, checks, and boundary. Read `docs/CURRENT.md` and the live checkout first. Preserve unrelated edits. Record results in this document's execution ledger and update current state. Commit and push each completed, working checkpoint; M3's dependency and math edits are one atomic commit. A failing candidate remains off production while its cause is investigated.

Do not turn uncertain findings into mandatory rewrites. Where a task says **trial**, either retain a measured improvement or record why the existing bridge remains. Avoid changing assertions merely to accommodate a different image or performance result. Every retained private bridge needs a nearby comment with: the behavior required, the missing public capability, supported Lite version, an official source link, and the test that protects it. Use release-tag documentation links instead of moving `master` links for version-specific claims.

### M0 — Reproducible baseline and trustworthy checks

**Files:** `scripts/ashen-reach/check-contact-occlusion.mjs`, `check-local-lights.mjs`, `measure-region.mjs`; new focused built-runtime smoke script if existing checks cannot cover the gate. Read `scripts/harness/`, `scripts/lib/cdp.mjs`, `docs/debug-view.md`, `vite.config.js`.

1. Record git SHA, clean/unrelated working changes, actual installed/locked package versions, lockfile integrity, browser version, hardware and GPU adapter, and current production deployment. Do not assume historical FPS is a comparable baseline.
2. Make the two hardcoded live checks honor `ASHEN_TEST_URL`. `check-sun-shadows.mjs` uses `ASHEN_URL`; set both environment variables. Preserve their default root route. Ensure reports include the URL actually visited.
3. Keep `check-camera.mjs` and `check-hdr.mjs` as dev checks unless deliberately adapted: they fetch `/src/ashen-reach/main.js` to find a Vite dependency URL. Build a small production-compatible smoke check using public `ASHEN` state and normal inputs; it must not import dev source paths. Assert the expected built script and installed release metadata recorded with the build.
4. Run the required verification matrix below against 1.28. Capture a short live baseline showing camera obstruction, ordinary walking, a chest hit/cast, equipment, lamps, and cathedral/forest views. Use separate diagnostic captures for the other races if they cannot fit legibly in one clip.
5. Run the existing region performance runner without recording. Replace or augment its hardcoded machine/browser condition string with detected/reportable facts. Assert seven enemies, 1280×720 actual canvas, active Havok, unchanged recovery count during each run, and meaningful movement. Save start/end positions; establish a clear route segment and minimum travel threshold from the baseline, then use the same route/threshold for the candidate. A blocked character is not a valid traversal performance sample. Save baseline reports under `ve-capture/ashen-reach/lite1311/baseline/` and a concise tracked summary. The artifact directory is ignored; documentation must contain commands and outcomes sufficient to reproduce it.

**Done when:** the reports demonstrably target the intended server, baseline failures are explained, all render/viewport dimensions are explicit, and the reference captures have been reviewed. A setup teleport to a route start is allowed; successful traversal after that must use normal controls without recovery teleports.

### M1 — Complete physics ownership on 1.28

**Files:** `src/player.js`, focused lifecycle tests; existing camera and player checks. Inspect `addStaticColliders`, `setupPlayer`, animated collider registration, Lite's `physics-character-controller`/world implementation, and the [physics lifecycle contract](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/42-physics.md) before editing.

1. Give the player physics subsystem one idempotent cleanup function, registered early enough to cover setup failure and scene disposal. Register every returned caller-owned shape/body in the ownership ledger immediately, before subsequent calls can throw, including static mesh/box aggregates and animated collider shapes. Do not wait for successful setup to register cleanup.
2. Detach the rig sweep and frame callbacks first. Guard application physics callbacks, pending initialization and late collider registration with the disposed state. `onPhysicsAfterStep` returns `void`; `disposePhysics` stops stepping and clears its callbacks. Use that lifecycle rather than inventing an unsubscribe API or adding private writes. Release the camera query shape while the world is alive.
3. Dispose the character controller **before** disposing the world: its own disposal releases its body, shape and query collectors. Do not also release its owned shape through the application's ledger. Account for `setShapeOptions`/height changes so replaced controller shapes are not released twice.
4. Remove/release caller-owned collider bodies and shapes according to Lite's ownership contract while the world is valid, then call public `disposePhysics(world)` once. Keep release order explicit; verify whether each aggregate-created shape is caller-owned rather than inferring ownership from body removal.
5. Route zero-collider initialization and caught failures through the same cleanup. Replace `world._stopStep` with the complete public teardown. Set `usingPhysics`/world/controller references to their consistent fallback/disposed state. Preserve successful movement; do not silently accept fallback movement in physics-required traversal tests.

**Verification:** add focused real-Havok lifecycle coverage for successful setup/disposal, repeated cleanup, zero colliders, failure after world/controller/query creation, animated colliders, and controller shape replacement. Count or otherwise verify native releases/callback cessation and no post-disposal stepping/querying. Inject failures at named boundaries after returned allocations; claim coverage for failure inside a Lite constructor only after examining its own cleanup behavior. Use a small owned fixture, not repeated full-game boot as a proxy. Run camera, movement, stairs and collision live checks on 1.28. A complete in-place game restart is outside this step: UI, input, audio and HUD ownership have separate lifecycles.

**Done when:** all owned physics resources have an explicit lifecycle, partial setup leaves no live world, and movement/camera behavior matches baseline. Commit this independently of the version bump.

### M2 — Document and contain unavoidable private bridges

**Files:** `src/ashen-reach/sun-shadows.js`, `local-lights.js`, `local-light-materials.js`; `src/character/sockets.js`, `src/character/adapters/lite-fixture.js`, and `src/character/runtime/body-visual.js` where they share private reads. Introduce small domain-specific adapter modules only where they remove duplicated ownership or private-field assumptions.

1. Write an ownership table in comments or a linked local document for near CSM, far PCF, and both local spot maps: creator, texture wrapper/owner reference, material/task consumers, unsubscribe, task retirement, final release, and uniform-buffer destruction.
2. Preserve the final CSM owner release until a real owner-disposal path replaces it. Document the exception to [the borrowed receiver contract](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/17-cascaded-shadow.md). Neither removing the release nor adding an arbitrary acquire/release pair solves the missing generator-owner lifecycle. Do not release while material/task consumers remain live.
3. Put generator lifetime operations behind an idempotent, version-checked path; retain the existing GPU submission fence where tasks can still be in flight. Include queued membership changes and a pending preload during disposal. Do not destroy a depth texture through both a facade and its generator owner.
4. Consolidate socket private-layout reads into one narrow adapter if feasible without changing transforms. Keep inverse-bind, mesh-world, root-world and capsule-foot offsets in their existing order. Raise a useful compatibility error when a fully loaded supported skinned rig lacks required private layout. Preserve existing null fallbacks for optional bones, unbound sockets and loading states. Do not invent a public socket replacement or silently return identity matrices.
5. Guard necessary shadow/plugin internals rather than broadly refactoring them. Keep the plugin-free native caster alias until a candidate preserves alpha, skeleton/morph deformation, and avoids sampling the same attachment being written. Consider public `isPbrMaterial`/`isStandardMaterial` for classification only after checking equivalence to the existing material-family predicate.

**Verification:** repeated subsystem teardown, teardown during queued shadow replacement, hidden/removed/equipped casters, race swaps, one-/two-handed socket motion, woodland transitions, GPU error collection. Use the same checks again on 1.31.1. Record the ownership exception as retained technical debt rather than claiming L02 is eliminated. No upstream issue posting is required or authorized by this plan; a local issue draft is sufficient if useful.

### M3 — Atomic dependency and compatibility migration

**Files:** `package.json`, `package-lock.json`; the five modules below and affected tests. Re-read shared preview/lab imports because normal `npm run build` includes them.

1. In the implementation checkout, run `npm install --save-exact @babylonjs/lite@1.31.1`. Keep Havok at the locked 1.3.14 unless a separately demonstrated incompatibility requires a change. Inspect the lockfile diff; do not run a broad dependency update or change Vite because upstream changed its tooling.
2. Migrate imports **and usages**, preserving multiplication order and null checks:

   | 1.28 export | 1.31.1 export | Signature |
   | --- | --- | --- |
   | `mat4Invert` | `invertMat4` | `(input) -> Mat4 \| null` |
   | `mat4Multiply` | `multiplyMat4` | `(a, b) -> Mat4` |
   | `mat4Decompose` | `decomposeMat4` | `(matrix) -> DecomposedTransform` |
   | `mat4Translation` | `createTranslationMat4` | `(x, y, z) -> Mat4` |

   Call sites: `src/character/sockets.js`, `src/character/adapters/lite-fixture.js`, `src/ashen-reach/contact-occlusion.js`, `src/ashen-reach/volumetric-fog.js`, `src/ashen-reach/dev-tools.js`. Remove unused imports where appropriate. Update string-evaluated mocks such as `scripts/test-local-lights.mjs`. Do not rename unrelated local/vendor functions just because they share a name.
3. Scan all first-party Lite imports against the target exports, including dynamic imports and scripts. Check the broader [math rename table](https://github.com/BabylonJS/Babylon-Lite/pull/688), including `normalizeVec3`'s changed scalar/object contract, if any additional caller is found. Do not treat a build of only the Pages entry points as complete import coverage.
4. Verify private layout assumptions in M2 and render-target/probe bridges against the exact installed runtime. The reviewed target retains `_width`, `_height`, `_colorView`, `_depthTexture`, engine `_w`/`_h`/`_ro`, and the public surface fields. Presence alone is not a behavior test.
5. At `linear-materials.js` and `local-light-materials.js` rebuild boundaries, inspect the new `void | Promise<void>` completion behavior. If a path requires a completed rebuild before revealing the scene, collect/await its completion at that boundary and surface rejection. Keep frame callbacks synchronous; do not launch an unbounded rebuild promise every frame. Preserve the existing first-draw linear-output guarantee.
6. Preserve current control mappings, CSM/PCF settings, render-target formats/scales, tone mapping, native PBR plugin behavior, and diagnostic probes for the first comparison. Do not mix F/E work into the minimal upgrade.

**Done when:** clean install from the lockfile resolves exactly 1.31.1, normal and Pages builds succeed, relevant unit tests pass, and the migration regression matrix passes on the built client. Commit dependency/compatibility changes together. New math names and a 1.28 lockfile must never be a completed checkpoint.

### M4 — Live acceptance and production release

Collect the full matrix below on the final candidate, compare with M0, and review actual live motion. Reuse checks already run on that same candidate; repeat only when changes or unresolved failures justify it. Record any remaining unsupported private bridges. A failing visual, runtime, or performance gate blocks release of the candidate; preserve the last good deployment while resolving it.

After acceptance, follow `scripts/deploy-pages.sh` and [the existing Cloudflare deployment workflow](DEPLOY.md). Record the production deployment active **immediately before** upload as the rollback target; do not assume the historical ID in this plan is still current. Commit/push the accepted runtime before deployment. Verify the candidate's assets and built script, then repeat production movement, cathedral entry/exit and tower route, mobile depth fallback/touch, and desktop WebKit checks. Roll back on loading, movement, or rendering failure and record the failing evidence. Use the recorded previous successful production deployment with the [Cloudflare rollback API](https://developers.cloudflare.com/api/resources/pages/subresources/projects/subresources/deployments/methods/rollback/) (`POST /accounts/{account_id}/pages/projects/fardel/deployments/{deployment_id}/rollback`), then confirm the restored production bundle and movement. Keep authorization tokens in environment variables; save only sanitized deployment metadata.

Send a reviewed live MP4 through `bash scripts/tg file <clip.mp4> "<caption with VE URL>"` under the project's existing delivery authorization. Preserve the verified 1280×720 landscape capture procedure and actual portrait ratio for portrait clips. Use `scripts/ve-upload.sh`, verify `video/mp4` and seeking, and validate Telegram's returned dimensions. If sent before the final code commit, run `bash scripts/tg record <clip.mp4>` after committing. The user already confirmed the earlier cathedral resend proportions; repeat that established encoding/delivery procedure. Report physical iPhone acceptance separately from emulation.

**Done when:** release SHA/deployment/rollback ID, package versions, checks, performance, reviewed motion link and Telegram delivery are recorded in `docs/CURRENT.md` and the execution ledger. Commit/push the result documentation. The upgrade is complete without requiring any deferred experiment.

## Independent follow-ups after the migration

These are separate working commits with relevant live acceptance. Complete one before starting the next. F1/F2 are recommended product/maintenance improvements; F3/F4 remove asset workarounds after focused evidence; F5–F7 are bounded trials and may validly finish with documented retention of the current bridge.

| Item | Explicit implementation task | Acceptance and stopping rule |
| --- | --- | --- |
| **F1 — visible device-loss recovery** | In `render-loop.js` and a small runtime error UI, stop scheduling/input on actual device loss and show a readable **Reload game** action. Reuse loading-screen styling where useful, but `failLoading` alone cannot display a runtime failure after the loading DOM is removed. Preserve the original error for diagnostics. Keep full-page reload as the recovery boundary. | Inject device loss after readiness with `ASHEN.engine._device.destroy()` in the owned test session. This produces reason `destroyed`, currently suppressed by the listener: distinguish loss while the game is active from shutdown after disposal. Verify one visible message, no continued frame submissions/held movement, accessible retry and a successful reload. Intentional loss belongs to this test's expected errors, not ordinary acceptance. Do not enable `enableDeviceLostSceneRecovery` for CSM/PCF: [documented limitation](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/50-device-lost-recovery.md). |
| **F2a — lazy error decoding** | Remove both eager decoder imports/call from `main.js`; dynamically load decoding only in the error path. Decode before displaying startup failures; retain stack/cause and a fallback if decoder loading fails. | Simulate a coded Lite error and an ordinary network error; verify readable messages/retry and no unhandled rejection. Compare initial bundle/request bytes. See [error handling](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/49-error-handling.md). |
| **F2b — native HUD projection** | Replace manual projection in `combat-hud.js` with `projectWorldToScreenToRef`. Supply both view and view-projection matrices; use existing `observeCanvasLayout` CSS dimensions and reusable result/options objects. Preserve anchoring and visibility rules. | Tests for front/behind/near/far/offscreen points, canvas offsets, portrait/landscape resize, device-pixel ratio and backing-resolution changes. Live check nameplates/damage numbers during camera movement. No per-label allocation regression. See [projection](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/54-world-screen-projection.md). |
| **F3 — authored chest-hit translation** | Inspect existing character preparation pipelines and use installed glTF Transform tools to remove only Hips translation channels from the shipped **Hit_Chest** clip where runtime stripping is currently applied. Cover the active human/orc/undead body variants and shared consumers. Preserve original source/provenance and all other clips/channels, including Hit_Head. Add an asset contract check, then remove `stripRootTranslation` and its private mutations. | Before/after channel inventory plus live chest hit, head hit, idle, directional locomotion, jump and moving cast on all three races. No change to physics translation or skeleton/socket alignment. If a currently supported external/unprocessed asset still needs the workaround, keep a clearly scoped adapter until that path is covered. |
| **F4 — orc vertex colors** | On 1.31.1, first test the shipped orc with the color-buffer suppression disabled in an isolated candidate. Inspect `COLOR_0` values and alpha to determine whether the old problem remains. If vertex color carries no intended appearance, remove it in the existing orc asset preparation boundary using glTF tools, regenerate only affected outputs, and remove the runtime `_gpu.colorBuffer` write. | Live orc body, garments, lit/shadowed views, depth/shadow passes, equipment swaps and preview/lab checks. Human-only results do not pass. If color is meaningful or the defect persists without a safe asset fix, retain/document the workaround and a minimal reproduction; do not strip colors globally. |
| **F5 — reduce shadow workarounds** | Test removal of custom CSM task retirement separately from the version migration, using native caster membership. Compare `setShadowGeneratorEnabled` with current receiver-darkness behavior before replacing private `_config` writes: disabling a pass can leave stale textures used by custom receivers. Keep receiver semantics explicit. | Repeated unequip/equip, hidden/dead/replaced actors, moving skeletons, woodland changes, shadow disable/re-enable, and pending teardown show no ghost casters, stale maps or sampling hazards. If any fail, keep the guarded workaround with evidence. No complete public replacement is assumed for the far/local PCF bridge or plugin-free PBR caster alias. |
| **F6 — public late-feature registration** | Try constructing deferred spell features before initial registration, or a documented unregister/register cycle with `registerSceneWithShadowSupport` and material preparation. `rebuildSceneRenderables` alone is insufficient; repeated registration without unregistering is a no-op. | Pyre Burst and the other existing spells retain all billboard layers, meshes, shadows, ordering and first-use readiness, with acceptable load/stall cost. If neither public arrangement is equivalent, move the current sequence into one guarded, documented helper and retain it. |
| **F7 — sampled render-target facades** | Convert one application-owned target at a time in `post.js`, `contact-occlusion.js`, `volumetric-fog.js`, and `display-pass.js`, using `createSurfaceRenderTargetTexture`, `withSampledDepthTexture`, and `disposeRenderTargetTexture` with the target release's declared signatures. Update shared preview targets only if affected. Record one cleanup owner and its interaction with task-owned target disposal before changing each target; sampled attachments are borrowed facades, not independent `releaseTexture` owners. | Verify full/half resolution, resize, portrait, DPR/internal resolution changes, HDR/depth sampling, WebKit fallback, and disposal. Do not wrap borrowed contact-shadow or bloom output with a second owning facade. Stop at a public-API gap and keep that narrow bridge. See [frame graph](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/28-frame-graph.md). |

### Optional experiments and deferred work

- **E1 — near CSM cache:** test native `enableCsmStaticCache`/`createCsmRefitGate` and 1.29's `staticCascadesPerFrame` after the upgrade. Explicitly partition static/deforming casters, invalidate cached content for woodland detail changes, and preserve offscreen shadow casters. Compare the same route suite and shadow captures. Retain only a repeatable improvement beyond baseline variation with no visual loss; otherwise record the negative result and keep the current settings.
- **E2 — async pipelines:** test `enableAsyncShaderPipelineCompilation` separately, using repeated cold startup/first-use runs and WebKit fallback. Measure time until the fully rendered, clothed scene is visible, longest stalls, and missing-material frames. Keep only if it improves readiness/stalls without incomplete first frames. Do not describe this as eliminating every pipeline stall.
- **D1/D2:** no compute-probe rewrite or VAT crowd conversion in the migration. Revisit only when profiling identifies a concrete maintenance or performance problem. No USD adoption, new compatibility layer, or wholesale camera-controller replacement.

## Verification matrix and reusable commands

### Unit/build gates

Run the focused tests for the changed work item during development. Run the following combined gate once for the final migration candidate; add the new lifecycle/bridge tests from M1/M2. Fix a failed assertion only after distinguishing a real regression from a version-sensitive test fixture.

```sh
npm run test:character
npm run test:equipment
node --test scripts/test-camera-rig.mjs scripts/test-frame-scheduler.mjs scripts/test-canvas-layout.mjs scripts/test-touch-input-lifecycle.mjs scripts/test-gpu-compatibility.mjs
node --test scripts/test-linear-materials.mjs scripts/test-local-light-materials.mjs scripts/test-hdr-color.mjs scripts/test-local-lights.mjs
node --test scripts/test-woodland-tiles.mjs scripts/test-regional-terrain.mjs scripts/test-region-world.mjs scripts/test-gothic-cathedral.mjs
npm run build
```

Use `npm ci` in an owned clean validation checkout to prove the committed lockfile; preserve the live checkout's unrelated work. Inspect character-lab and body-preview loading as well as the root game. The production workflow performs its own staged Pages build; normal build verification does not replace that artifact check.

### Live checks

Choose an unused harness slot. Example **slot 6** maps to Vite **5773** and CDP **9937**; use the actual selected slot's ports. Do not stop someone else's default browser/server.

```sh
node scripts/harness/up.mjs --slot 6 --headless --uncapped
export ASHEN_CDP_PORT=9937
export ASHEN_TEST_URL='http://127.0.0.1:5773/ashen-reach.html?play&clean'
export ASHEN_URL="$ASHEN_TEST_URL"
node scripts/ashen-reach/check-camera.mjs
node scripts/ashen-reach/check-hdr.mjs
node scripts/ashen-reach/check-sun-shadows.mjs --tag lite1311
node scripts/ashen-reach/check-contact-occlusion.mjs --tag lite1311
node scripts/ashen-reach/check-local-lights.mjs
node scripts/ashen-reach/check-exploration.mjs
node scripts/ashen-reach/check-region.mjs
node scripts/ashen-reach/check-mobile-runtime.mjs --inject-depth-bundle-failure
node scripts/ashen-reach/check-mobile-runtime.mjs --webkit
```

The contact/local checks require M0's URL correction before using this recipe. Reports and screenshots with fixed paths must be copied into distinct baseline/candidate directories before the next run overwrites them. Read a script's arguments before running; do not assume every legacy check accepts the same flags.

Also exercise the following behaviors explicitly; the commands above do not cover all of them:

| Area | Required observations |
| --- | --- |
| Physics/camera | Havok active; ordinary walking, jump/land, slopes, walls, doorway/stair clearance, terrain/perimeter collision; camera sweep ignores player and blocks terrain/walls; LMB/RMB/touch semantics preserved. No recovery teleports during successful routes. |
| Animation/assets | Human/orc/undead load; idle/directional/run/jump/chest hit/head hit/moving cast; streamed equipment, one-/two-hand grips and garment alignment; race/actor replacement, hidden/dead casters, no ghost shadows. |
| Rendering | First visible frame has correct PBR linear output; sun/far/local shadows, AO/contact/fog/bloom/display order, foliage/woodland detail changes, lamps, resize/portrait/backing-resolution changes. No new black/white flashes or stale attachments. |
| Lifetime | Fixture create/dispose cycles, setup failure, disposal during pending preload/task replacement, no callbacks after teardown and no native/GPU resource double release. Full-page reload works. |
| Browser/input | Chromium WebGPU; real touch events with cancellation/blur/modal interruptions; forced depth-bundle fallback; desktop WebKit. Report actual iPhone testing only if performed on hardware. |

Run the M0 built-runtime smoke against a locally served production build before deployment. It must catch build-only failures and identify the exact bundle under test. Capture and inspect live motion independently of automated assertions; screenshots alone do not complete visual acceptance.

### Performance gate

```sh
mkdir -p ve-capture/ashen-reach/lite1311/candidate
node scripts/ashen-reach/measure-region.mjs ve-capture/ashen-reach/lite1311/candidate/performance.json
```

Use M1 Max, uncapped Chromium WebGPU, **1280×720 actual canvas rendering**, seven enemies, three 12-second runs each for town/bridge/cathedral/forest, with the runner's warmup and **no recording**. Record actual hardware/browser versions; the script's old condition string is not proof. Keep visual settings and pixel ratio equivalent, close unrelated game renderers, and reject `vsyncCapped` measurements as evidence for the >120 FPS goal.

Report every run's FPS, median/p95/p99 frame duration, worst frame and counts over 8.33/16.67 ms, plus route aggregates. Compare baseline and candidate measured in the same session. Default acceptance: every route/run remains above 120 FPS; investigate a repeatable route median-FPS regression over 5% or p99 degradation over 10%. Repeat paired measurements only when noise or a regression warrants it; do not discard poor runs selectively. Persistent unexplained regressions block the release. The 5%/10% thresholds are proposed review tolerances, not prior product claims; >120 FPS is the existing product goal. Keep CPU frame intervals separate from changed GPU timestamp behavior in #730.

### Production gate

After `npm run deploy`, verify the exact deployment and bundle, then run production-compatible checks. Do not run the dev-source-import camera/HDR checks against Pages and call their failure a game failure.

```sh
node scripts/verify-pages.mjs ve-capture/ashen-reach/lite1311/production-assets.json
export ASHEN_TEST_URL='https://play.sparkify.dev/ashen-reach.html?play&clean'
export ASHEN_URL="$ASHEN_TEST_URL"
node scripts/ashen-reach/check-exploration.mjs
node scripts/ashen-reach/check-mobile-runtime.mjs --inject-depth-bundle-failure
node scripts/ashen-reach/check-mobile-runtime.mjs --webkit
```

Set `ASHEN_EXPECT_BUNDLE` to the newly deployed bundle filename for mobile checks, and use the built-runtime smoke for exact-bundle movement/camera/shadow coverage. `verify-pages.mjs` compares the staged `dist` files, including terrain/woodland assets, textures and Havok MIME/content. The injected-depth check is production-compatible; its `--disable-depth-fallback` negative control patches source and remains dev-only. Preserve existing deployment rollback procedure and verify the restored deployment if rollback is needed.

## Execution ledger

Update this table during implementation; a reviewed plan is not a completed runtime milestone.

| Item | Status | Commit / evidence / retained limitation |
| --- | --- | --- |
| M0 baseline and harness | Planned | No candidate tests run in this planning review. |
| M1 physics lifecycle | Planned | Controller and caller-owned shapes must be included. |
| M2 private bridges | Planned | CSM owner-release exception remains until explicitly verified. |
| M3 Lite 1.31.1 migration | Planned | Runtime remains on locked 1.28.0. |
| M4 release acceptance | Planned | No deployment performed by this review. |
| F1/F2 recommended follow-ups | Planned, after M4 | Separate commits and targeted acceptance. |
| F3/F4 asset workarounds | Planned, after M4 | Race/clip-specific evidence required. |
| F5/F6/F7 public replacement trials | Optional, after M4 | Retained bridge is a valid documented outcome. |
| E1/E2 performance trials | Optional | No improvement claimed without measurements. |
| D1/D2 compute/VAT | Deferred | No current product requirement. |
