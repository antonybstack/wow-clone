**Verdict: the helper is a coherent 1.31.1 pin, not a supported API. Ship only with tests that native never allocates `_drawArgsBuffer` and that both color and shadow bundles re-record the new logical count. `setThinInstanceDrawCount` is not a substitute.**

### What the helper actually does
`syncThinInstanceForDraw` stays on a direct `drawIndexed(..., ti.count)` only while `_drawArgsBuffer` is missing and `_drawArgsInstanceCount === ti.count` (`thin-instance-gpu.js`). Any count change that leaves those unequal allocates a 20-byte indirect buffer and `bumpVisibilityEpoch()` so the next bundle records `drawIndexedIndirect`. That is the documented `setThinInstanceCount` policy (`thin-instance.js`, `index.d.ts`).

The helper fights that policy: public `invalidateRenderBundles` (epoch + `_renderableVersion`), public `setThinInstanceCount`, then a private ack so the next `update()` still returns `null`. There is no public “keep direct after count change” API. Foliage already uses the supported path (`enableThinInstanceDynamicDrawCount`). `setThinInstanceDrawCount` only skips the matrix dirty range; a differing capture count still promotes. Do not treat its cheaper upload as a direct-draw policy.

`diagnose-direct.json` is a different trick (initial count 1, opt-in stripped, count never diverges). It does not measure this bridge.

### Cache safety
Color replay is `task._lastVis !== _vis` in `executePassBody` (`render-task-base.js`). Direct instance count is baked at record time; later `update()` cannot change a cached `drawIndexed`. The epoch bump is required on every membership change, including `0→1` and `0` reuse.

Shadow execute re-records when `_recordedVersion !== scene._renderableVersion` (`shadow-task.js`). `invalidateRenderBundles` also bumps `_vis`, and CSM/PCF inner tasks still go through `executePassBody`, so cascade bundles re-record even when `ensureCsmShadowTaskState` swallows a caster-set-unchanged `_renderableVersion` bump (`csm-shadow-task-hooks.js` lines 56–58). Engine is the primary surface, so `engine._renderingContexts` is the right list here.

Order is safe in one synchronous turn: invalidate → count → ack, then `update()` sees a match and the same frame’s bundle record bakes the new `ti.count`. `removeThinInstance` already decrements; the helper then acks `pool.ids.length` and does not double-remove.

If a frame ever runs after `removeThinInstance` and before the helper, native allocates `_drawArgsBuffer` and the next helper call throws. Today add/remove stay in one turn. A later `await` in `crowd.set` that mutates count across a frame is the ownership footgun.

### Call site
Fixed capacity 100, draw count = logical population, VAT instance texture still full-capacity: matches the native comments. Exact actors are out of this path. Guards (VERSION, no cull, no LOD, no `_drawArgsBuffer`, `count ≤ _capacity`) are the right fail-fast.

Per-mesh global invalidate (one actor, several primitives) is correct and noisy, not a wrong-count bug.

### Missing tests (blockers)
`test-region-crowd-lifecycle.mjs` mocks `invalidateRenderBundles` as a no-op and `setThinInstanceCount` as `ti.count = n`. It never asserts the native contract. Add a focused helper test (real `thin-instance.js` + `thin-instance-gpu.js` semantics, no WebGPU) for:

1. `0→1→10→middle swap-remove→0→reuse` with `_drawArgsBuffer` remaining unset and `_drawArgsInstanceCount` equal to logical count after each helper call.
2. `invalidateRenderBundles` invoked on every change, including when `removeThinInstance` already set `ti.count`.
3. Throw on `_drawArgsBuffer` / cull / LOD / `count > _capacity`.
4. Early-return only when both `ti.count` and the capture already match.

No live GPU test today proves shadow *and* color bundles replay the survivor count after a middle removal.

**Action:** keep the private ack and the VERSION pin; do not switch to `setThinInstanceDrawCount`. Do not merge until those four helper assertions exist. Replace the bridge when Lite exposes a public direct-count policy, then remeasure both paths.This turn was a read-only safety review of the direct-count helper; no game files were edited and no clip is owed.
