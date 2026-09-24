# V11 sun-shadow architecture

Source snapshot: 2026-09-24, installed `@babylonjs/lite` **1.28.0**. This document describes the working implementation, not a deployment, visual acceptance, or performance result. The owning implementation is [sun-shadows.js](../src/ashen-reach/sun-shadows.js), with fog consumption in [volumetric-fog.js](../src/ashen-reach/volumetric-fog.js).

## Two maps, one scene sun

The actual scene sun owns native cascaded shadow maps (CSM). A separate, cached percentage-closer-filtered (PCF) map supplies distant visibility to custom surfaces and fog through an explicit scene task. Its directional-light object supplies a transform only: it is **not added to `scene.lights`**, and its generator is not attached to the scene sun.

The reason for this boundary is the V11 integration's reported bind-group validation errors when native PBR encountered PCF and CSM generators together in the scene light list. Treat this as the project's compatibility constraint for the installed version, not a newly verified live result or a claim about all Lite versions.

| Property | Native near CSM | Explicit far PCF task |
| --- | --- | --- |
| Map | Three 2048 × 2048 `depth32float` array layers | One 2048 × 2048 `depth32float` map |
| Fit | Active camera, maximum view-space distance 180; stabilized cascades | World caster bounds and independent directional-light transform |
| Configuration | `lambda: .75`, blend fraction `.1`, `worldSpaceBias: .006` | `bias: .00002`, `orthoMinZ: 1`, `orthoMaxZ: 2400` |
| Refresh | `forceRefreshEveryFrame: true` | Native PCF transform/version cache |
| Casters | Opaque world batches plus visible PBR/Standard meshes | Opaque world batches, unless explicitly replaced for diagnostics |
| Consumers | Native PBR; custom surfaces and foliage; near fog | Custom surfaces and fog beyond CSM coverage |

Both lights use `-SUN_DIR` as the direction light travels. The far transform is positioned at `(SUN_DIR.x * 1100, SUN_DIR.y * 1100, 80 + SUN_DIR.z * 1100)`.

Native PBR receives the scene sun's CSM through Lite's built-in material path. It does not use the custom far-map fallback. Custom materials and fog share the exported `SUN_SHADOW_WGSL` visibility functions, with different filtering costs.

## API boundary and receiver data

The public CSM bridge is `getCsmReceiverTexture(csm)` plus `onCsmReceiverUpdate(csm, callback)`. The texture accessor returns the generator's stable depth-array texture and comparison sampler. Custom ShaderMaterials declare a depth sampler with `viewDimension: '2d-array'` and `comparison: true`, then bind it through `setShaderTexture`.

The callback runs after Lite computes the cascade transforms and uploads its receiver uniform buffer, before it renders the shadow maps and subsequent scene tasks. The controller copies the reusable 80-float payload into its own `data` array and updates registered materials with `setShaderUniform`. Updating cascade matrices in a gameplay `onBeforeRender` callback would read the preceding frame's transforms.

| Float offsets in native payload | Meaning | Custom receiver use |
| --- | --- | --- |
| 0–63 | Four matrix slots | First three matrices, offsets 0–47 |
| 64–67 | Cascade split view depths | `sunSplits` |
| 68–71 | Cascade lengths | `sunLengths` |
| 72–75 | Native darkness, map size, inverse size, edge falloff | Native PBR consumes these directly |
| 76–79 | Native cascade parameters | Custom path supplies its own enabled flag, inverse size, range and blend fraction |

`bindSunReceiver(engine, material)` requires the controller to exist before materials are constructed. `addReceiver` binds both textures, initializes uniforms and retains the material in a controller-owned set. `materials.js` and both foliage material paths declare the shared uniforms, samplers and WGSL. There is no per-material receiver-unregistration API.

The PCF bridge is deliberately private and isolated in the controller's `sun-far-static-shadow` task:

- `_preloadShadowTask(farCasters)` loads the necessary caster material views.
- `_ensureShadowTaskState(engine, scene, farCasters)` returns the internal task state; its `_task.record()` runs initially and when the returned state changes.
- `_renderShadowMap(engine, state)` updates or reuses the cached map.
- `_depthTexture`, `_depthSampler` and `_lightMatrix` supply the custom receiver wrapper and transforms.

`farTexture` carries the underlying `texture`, `view`, `sampler`, `_sampleType: 'depth'`, dimensions and `depth: true`. ShaderMaterial validation requires `_sampleType`; its texture ownership accounting requires `texture`. The fog EffectWrapper uses a smaller view/sampler descriptor, appropriate to that separate API. Private PCF hooks and fields must be rechecked on Lite upgrades. The controller also accesses CSM private configuration for the debug toggle, `_version` for counters, and generator buffers for teardown.

## Startup and frame order

[main.js](../src/ashen-reach/main.js) creates the scene with `{defaultRenderTask: false}`, creates the controller before world materials, attaches the player, supplies world casters, constructs either the post or direct pipeline, then calls `registerSceneWithShadowSupport` unconditionally. `?noPost` therefore keeps surface shadows.

Each pipeline creates exactly one explicit scene draw. Registration prepends native `shadow`, while `addTask` appends the far task before the scene draw. The resulting task order with post processing is:

```text
native shadow (CSM and receiver callback)
  → sun-far-static-shadow (PCF, then receiver uniform update)
  → ashen-scene (color and depth)
  → shadowed-fog-integrate
  → shadowed-fog-composite
  → ashen-bloom, or ashen-present copy
```

Before graph execution, the gameplay callback updates movement, animation-facing state, equipment and the controller's dynamic membership. Native animation/skeleton work updates the live bone palette before shadow rendering. The CSM callback writes current cascade data. The far task then calls `updateMaterial` after PCF rendering, so the final `ashen-scene` receives the current far matrix even on the first map render or a refit.

With `?noPost`, `buildDirectPipeline` in [post.js](../src/ashen-reach/post.js) adds `ashen-direct`, drawing to `engine.scRT` with a separate `depth32float` target. Its order is `shadow → sun-far-static-shadow → ashen-direct`. Both pipelines draw scene color after the far task has synchronized receiver matrices, including on initialization and refit.

Fog updates its uniform block in both `record()` and immediately before each `execute()`. The execution-time update reads current CSM `data`, current `far._lightMatrix`, the view matrix and inverse scene view-projection, after both shadow tasks have executed.

## Casters, skinning and visibility

`setWorld(world)` snapshots `world.meshes`, excluding `Ash motes` and `Lamp light shafts`. Each remaining world material receives a position-only, double-sided shadow caster override through `setShadowCasterMaterial`. This avoids binding a receiver's shadow textures while rendering into those same textures. It also assumes these batches are opaque and need no vertex deformation or alpha discard in the shadow pass.

`update()` scans `scene.meshes` for meshes whose `visible !== false`, whose material family is PBR or Standard, and which are absent from the world caster list. It compares the ordered list by identity and calls `setShadowTaskCasterMeshes` with a new combined array only when membership changes or a forced update is requested. Visibility is checked every call, not gated by `_renderableVersion`.

This discovers race replacements, streamed garments and socket props without requiring a fixed body mesh list. It depends on existing visibility helpers propagating hidden state to each mesh: there is no ancestor walk or actor-only allowlist. Any future visible PBR/Standard effect also qualifies. Hidden parked bodies, cached garments and coverage geosets are excluded when their mesh flags are false.

Membership changes also use a guarded private CSM compatibility bridge. The owning implementation session reported that actor shadows persisted after all actor casters were removed. In installed Lite 1.28, the skeleton preloader calls `mapCasterMeshes`, replacing its remembered source/wrapper arrays before the next ensure call reaches `prepareExistingState`. The previous task state's original source array then fails that identity check. Incremental CSM removal can consequently call `removeMeshFromTask` with an original mesh while the task holds its skeletal wrapper, leaving the old draw registered. This is a task-membership defect; forced shadow refresh alone does not remove the stale draw.

Inside the membership-change branch, the controller saves `csm._shadowTaskState` and, if it exists, sets that field to `undefined` before submitting the new caster list. Native scheduling builds fresh cascade tasks for the new membership. It retires the previous task with `queueMicrotask(() => device.queue.onSubmittedWorkDone().then(() => previous._task.dispose(), () => previous._task.dispose()))`, delaying the completion fence until after the current synchronous frame work has submitted and disposing the old task after that submitted work finishes. Fence rejection, including device loss, also disposes the old task. The generator and shared maps remain; this resets task state, not the entire shadow controller.

This reset runs on membership changes or an explicit `update(true)`, never as routine per-frame animation refresh. It is another version-specific bridge to review on an engine upgrade. The actor-on/off probe in `check-sun-shadows.mjs` exercises this membership transition; runtime acceptance results are outside this architecture document.

Native PBR caster views retain skinning. `enableSkeletonShadows(csm)` supplies live skeletal bounds for cascade fitting; it does not replace the native vertex deformation. Forced refresh renders changing poses even when their bounds or root transform happen to remain unchanged. The world position-only override is not assigned to dynamic character materials. Morph-target bounds support is not enabled by this controller.

The dynamic scan sets `receiveShadows = true`, but this assignment alone does not rebuild an existing material pipeline. Current player bodies, streamed garments, tinted NPC bodies and shade garments set their receiver flags in their construction paths. Future late receiver opt-ins must set the flag before building the renderable or explicitly rebuild it.

## Surface and volume sampling

Custom visibility chooses a cascade using positive camera-view Z and blends across the final 10% of each cascade. It falls back to the far map outside a cascade's depth/UV bounds, blends the last cascade into that map, and uses the far map beyond 180 view-space units. Out-of-map far samples return fully lit. Shadow maps use ordinary depth with a clear value of 1; scene-depth reconstruction uses the camera's reverse-Z convention.

Custom surfaces apply a `.004` world-space normal offset and nine comparison samples on a 3 × 3 grid. Far sampling uses a single comparison lookup with a `.00008` receiver depth offset. Native PBR retains Lite's own CSM filtering and blending; it does not execute this custom function.

[atmosphere.js](../src/ashen-reach/atmosphere.js) multiplies direct solar key and rim by visibility. Foliage also attenuates solar transmission. Ambient sky/ground fill, lamps, spell lights and emission stay independent of solar visibility.

Fog derives WGSL from the shared source by replacing uniform names and replacing the nine-sample cascade filter with one comparison lookup. It passes a zero normal. This textual replacement depends on the shared function's current spelling and structure.

The fog pass integrates 48 jittered samples at half resolution into `rgba16float`, ending at scene depth or `maxDistance` (default 850). Defaults are density `.006`, solar power `3.4`, and height scale `48`. Scattering combines a constant ambient term with shadow-tested directional scattering; extinction accumulates transmittance. The full-resolution composite uses four depth-weighted neighbors, approximately reverses the shared material grade, applies extinction/scattering, then grades again. Clipped highlights cannot be recovered. Bloom follows the composite.

## Ownership and teardown assumptions

The controller explicitly calls `acquireTexture(farTexture)` to retain a far-map owner reference. ShaderMaterial renderables acquire their own references, so receiver replacement must not destroy a map still owned by its generator. `getCsmReceiverTexture` already retains an owner reference internally; the controller does not acquire an additional one.

The scene owns `farTask`, whose disposal retires its internal render task. An `onSceneDispose` callback unsubscribes receiver updates, clears the receiver set and engine lookup, releases the far and CSM texture owner references, and destroys both generators' `_shadowUBO` and `_shadowParamsUBO`. Fog wraps task disposal to dispose its EffectWrappers. Ordinary scene/renderable cleanup releases the consumers' texture references.

This is a **full-scene-lifetime controller**, with one controller per engine in a WeakMap. It has no independent `dispose()` or safe live-replacement contract. In installed Lite, the frame graph's disposal callback is registered before this controller callback; ordinary mesh cleanup may run afterward, so texture reference counting is part of the lifetime guarantee. Do not interpret the source comment as a promise that all receiver references have already retired.

The public CSM accessor documents its texture as generator-owned and forbids callers from releasing it independently. The current scene teardown releases that owner reference as part of retiring the entire generator, relying on installed implementation details. Receiver code must never independently release or destroy it. Old CSM tasks detached by membership changes are retired by their own queued completion promises, with disposal on both fulfillment and rejection; the scene callback does not await those promises. A Lite upgrade must review this owner-release convention, buffer ownership, deferred task retirement and device recovery together; rejection cleanup alone does not establish full device-recovery correctness.

## Debug controls and diagnostic scope

| Control | Actual effect |
| --- | --- |
| `ASHEN.shadows.setEnabled(false)` | Makes custom visibility return lit and native CSM darkness become 1. Shadow work still runs; this is not a performance-disable switch. Use the method, not direct `state.enabled` mutation, to affect both paths. |
| `ASHEN.shadows.state.characters = false` | Removes the entire dynamic PBR/Standard caster set on the next `update()`. World casters and receiving remain. Restore `true` to resume discovery. |
| `ASHEN.shadows.update(true)` | Forces caster-list submission, useful after a diagnostic membership change. |
| `ASHEN.shadows.probeSun(points)` | On-demand GPU sampling of the shared custom surface visibility function, using an upward normal; not a native PBR pixel test. |
| `ASHEN.shadows.setFarCasters(meshes)` | Replaces only explicit far-task inputs; CSM/world membership remains unchanged. Supply supported, already-preloaded caster material families. |
| `ASHEN.volumetric.state.shadows = false` | Bypasses visibility only inside fog integration. |
| `ASHEN.volumetric.state.enabled = false` | Composite presents source color; fog integration is still scheduled. |
| `ASHEN.volumetric.state.debug = 1` / `2` | Shows weighted sunlight visibility / extinction, respectively. Set 0 for normal composition. |
| `?noPost` | Uses `buildDirectPipeline` to draw once to the swapchain after both shadow tasks; omits fog and bloom while retaining surface shadows. |

`state.version` tracks CSM regeneration, not acceptance or frame rate. Resolution, range and step counters are not general runtime reconfiguration APIs: map allocation and the 48-step shader are fixed at creation/compilation.

The older `ASHEN.volumetric.probeSun(points)` checks the far map against CPU triangle raycasts only. It does not validate cascade sampling or deformed characters. Its CPU caster array is captured at construction, so `volumetric.setCasters()` can change GPU inputs without changing that reference; deliberate mismatch tests must account for this. [check-sun-shadows.mjs](../scripts/ashen-reach/check-sun-shadows.mjs) is a diagnostic entry point, not evidence that checks have passed.

## Limits and sources

Grass and flowers receive shadows only. Fine alpha-tested, wind-deformed vegetation casting is not implemented. Opaque world caster overrides omit wind and alpha discard. The far map excludes dynamic characters, and native PBR has no custom distant fallback. There is no ambient-occlusion pass yet; direct sun shadows do not substitute for contact ambient occlusion. Forced refresh and fog cost require measurement under stated conditions; no FPS or live-quality result is asserted here.

Official entry points are the [Babylon Lite documentation](https://doc.babylonjs.com/lite/) and [BabylonJS/Babylon-Lite repository](https://github.com/BabylonJS/Babylon-Lite). Upstream documentation may describe a newer package. Exact behavior above was checked against installed 1.28.0 declarations and source:

- [Public API declarations](../node_modules/@babylonjs/lite/index.d.ts): CSM bridge, registration, caster APIs, texture ownership and rebuild contracts.
- [CSM generator](../node_modules/@babylonjs/lite/lib/shadow/csm-directional-shadow-generator.js) and [CSM task hooks](../node_modules/@babylonjs/lite/lib/shadow/csm-shadow-task-hooks.js): data layout, callback timing, forced refresh and fitting.
- [PCF task hooks](../node_modules/@babylonjs/lite/lib/shadow/pcf-shadow-task-hooks.js): isolated far-map execution and cache behavior.
- [Deformable shadow casters](../node_modules/@babylonjs/lite/lib/shadow/deformable-shadow-casters.js): live bounds and caster wrappers.
- [Scene core](../node_modules/@babylonjs/lite/lib/scene/scene-core.js), [frame-graph actions](../node_modules/@babylonjs/lite/lib/frame-graph/frame-graph-actions.js), and [shadow task](../node_modules/@babylonjs/lite/lib/frame-graph/shadow-task.js): ordering and scene-light scheduling.
- [ShaderMaterial renderables](../node_modules/@babylonjs/lite/lib/material/shader/shader-renderable.js) and [texture reference counting](../node_modules/@babylonjs/lite/lib/resource/gpu-pool.js): consumer ownership and retirement.
