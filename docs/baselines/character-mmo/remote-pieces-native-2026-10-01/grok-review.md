# Remote pieces renderer/hooks — independent review

Reviewed 2026-10-01 against current uncommitted `src/character/remote-pieces/renderer.js`, `src/ashen-reach/equipment-loader.js`, `equipment-stream.js`, `prime-morph-materials.js`, `src/character/runtime/inspection-preview.js`, `src/character/sockets.js`. Candidate bounds in `prepare-native.js` were read for contract only. Lite 1.31.1 `removeFromScene` last-scene disposal, `waitForGpuIdle` (submitted work only), `goToFrame`, and garment palette-borrow comments were used as the native contract.

Parent since the earlier pass: failed-boot `await equipment.drain()`, prop `dt` in `pose()`, per-request `AbortController` separate from `resource.controller`. Those sequential paths are acknowledged below.

Evidence: `one-actor-v3-report.json` passed one owner / same-body armor / undead swap. `functional-v3/report.json` passed 8 owners, 10 complete lifecycles, corrupt/late/stale, 32-id queue, final `owned:0` / `leases:0` / `pendingBuilds:0`. That is functional teardown after completed jobs, not performance acceptance and not dispose-during-boot.

Candidate remains DEV-only (`vite.config.js` `/__remote_pieces__/` mirror). Public integration is not implemented. Queue pump is still one active job.

## Findings

### 1. High — in-flight boot still has no equipment drain owner under concurrent retire

**Where:** `src/character/remote-pieces/renderer.js:121` `owned.add` with `equipment:null`; `:140` assignment only after `await createStreamedEquipment`; `:97-110` `retire`; `:147` stage catch; `:151-153` manager `dispose`; `src/ashen-reach/equipment-stream.js:422-429` sequential boot drain.

**Trigger:** `dispose()` / scene abort / `owned` retire while `stage()` is inside `createStreamedEquipment` (body visual and sockets already live, garments preparing or in `beforeCommit` rebuild). `remove(id)` of an unpublished actor also skips `retire` (finding 3), so manager dispose is the direct path.

**Consequence:** `retire` sees `resource.equipment == null`, skips `dispose`/`drain`, then `await Promise.allSettled([...builds])` and `retireVisual` / `disposeMeshGpu` on the body. Garments still borrow `donor.skeleton.boneTexture` / `boneMatrices` (`equipment-stream.js:256-261`). Lite `removeFromScene` on the body’s last scene releases that palette. The boot path then hits `equipment.dispose()` + `drain()` on a retired visual. Shared skeleton use-after-free, garment `removeFromScene` after the GPU idle fence, or `apply` throwing (finding 4). Sequential boot failure is now drained *before* `stage` catch; `functional-v3` only proves retire after jobs complete (`after.streaming.owned === 0`).

**Fix:** Keep a `resource.boot` promise assigned *before* the await:

```js
resource.boot = createStreamedEquipment(...).then(eq => { resource.equipment = eq; return eq; });
resource.equipment = await resource.boot;
```

At the start of `resource.retirement`, `await resource.boot?.catch(()=>{});` then `equipment?.dispose(); await equipment?.drain();`. `createStreamedEquipment` already disposes on boot failure; awaiting the settled boot orders palette restore before `retireVisual`. Stage catch can still `await retire` because boot has already rejected and does not wait on `retire`.

---

### 2. High — Armory ease weights zero Fire/Lava/Pulse at start and terminal hold

**Where:** `src/character/runtime/inspection-preview.js:39-40` layered weight `ease(time/.09)*ease((duration()-time)/.18)`; `:70` `loopAnimation = !terminalHold`; `src/character/remote-pieces/renderer.js:38` maps `FireBlast_Upper`/`LavaBall_Upper`/`PyreBurst_Upper` to `fire`/`lava`/`pulse`; `:93` `preview.seek(sample.frame/fps)`.

**Trigger:** Remote `pose()` with those clips, especially `ended` / `sample.frame === lastFrame` (`actor-state.js` non-loop terminal) or `timeSeconds === 0`. `terminalHold` lets `seek` park at `duration`, so `(duration()-time)/.18 === 0` and spell/upper/lower weight is 0. Idle (index 0) stays at weight 1.

**Consequence:** Sampled source-phase is idle, not the atlas row. Region exact uses `goToFrame(group, sample.frame)` with no Armory fade (`region-crowd/renderer.js` `exactPose`). `one-actor-v3` FireBlast was `timeSeconds: 0.48` (ease ≈ 1). `functional-v3` seats were `Walk_Loop`. Carry raw `Walk_Carry_Loop` is non-layered and is not this bug.

**Fix:** Add a preview flag (e.g. `sourceHold`) that sets layered overlay weights to 1 and does not ease in/out. Or seek the motion clip with `goToFrame(group, sample.frame, game.engine)` like the exact crowd path, and keep inspection-preview only for Armory. Do not change default Armory playback (`terminalHold`/`includeAirborne` default false).

---

### 3. Medium — `remove()` of an unpublished actor never retires the owned staging resource

**Where:** `src/character/remote-pieces/renderer.js:192` `remove`; `:121` `owned.add` at stage start; `:125-127` body lease; `:140-144` equipment leases/rebuild use `AbortSignal.any([stageSignal, resource.requestSignal, request])`; `:147` catch retire; `request-queue.js:21-25` cancel marks `active.cancelled` only.

**Trigger:** `remove(id)` during first `upsert` before `actors.set` (`renderer.js:181`). Token abort runs (`desired.get(id)?.controller?.abort()`). `actors.get(id)` is missing, so `retire` is skipped. `resource.controller` (`ownController`) and therefore `stageSignal` stay live.

**Consequence:** Cleanup depends on native decode finishing, then `current(token)` / `throwIfAborted` on `requestSignal`, then stage catch. `loadGltf(engine, bytes)` after a resolved lease has no signal (Lite load is not interruptible). Owned count and immutable leases stay up until that returns (`functional-v3` `held-body` mid-swap: `owned:2`, `leases:1`; after wait, 0). A hung or slow body decode occupies the `capacity+1` staging slot. `functional-v3` “superseded-queue-fully-drained” waited for the queue, it did not `remove` mid-`loadGltf`.

**Fix:** Map in-flight resources by actor id (or store `actorId` on the resource). `remove` aborts the token **and** `retire`s that staging resource (idempotent via `resource.retirement`). Optionally fold `token.controller.signal` into `stageSignal` so lifetime abort and request abort use the same fence.

---

### 4. Medium — remote `equipment.dispose` `apply()` is outside `try/finally`, and `hide()` can throw before `retirement` is assigned

**Where:** `src/ashen-reach/equipment-stream.js:415-419`:

```js
dispose() {
  stopped = true;
  if(options.beforeCommit){visible=false;apply(loader.getState());}
  loader.dispose();
}
```

`renderer.js:97-100`: `resource.retiring=true; hide(resource); ... resource.retirement=(async()=>{...`. `hide` → `equipment.setVisible(false)` → `apply` (`equipment-stream.js:392-394`).

**Trigger:** Finding 1 (body already `retireVisual`’d) or any `apply` throw (missing socket node, disposed mesh). Player path has no `beforeCommit`, so this hook is remote-only.

**Consequence:** `apply` throw skips `loader.dispose()`. Cache garments keep borrowed palettes. `drain` may run against a loader that was never disposed, or boot `dispose()` throws before `await drain()`. If `hide()` throws, `resource.retirement` is never set; `retiring` is true; a later `retire` retries `hide` and still cannot enter teardown (`if (resource.retirement) return` is false).

**Fix:**

```js
dispose() {
  stopped = true;
  try { if (options.beforeCommit) { visible = false; apply(loader.getState()); } }
  finally { loader.dispose(); }
}
```

In `retire`, assign `resource.retirement` (or abort) before `hide`, and wrap `hide` in `try/catch`. Skip `apply` when `stopped` / `resource.retiring`.

---

### 5. Medium — failed upsert rewrites `desired` without a controller and leaves `canCommit` bound to the dead token

**Where:** `src/character/remote-pieces/renderer.js:173-174` `resource.canCommit=()=>valid()&&current(token)`; `:185` `if(kept)desired.set(actor.id,{actor:kept.actor});else desired.delete(actor.id);throw error;`; `:166-167` same-revision fast apply does not reset `canCommit`; `:192` `desired.get(id)?.controller?.abort()`.

**Trigger:** Same-shape `setLoadout` returns `failed` (corrupt garment, native rebuild error after `stale()` is false). Catch keeps the live actor and replaces `desired` with `{actor:kept.actor}` (no `controller`, no `pending`). `functional-v3` `corrupt-garment-keeps-committed-body-and-recipe` passed this keep-body check (`owned:1`).

**Consequence:** `current(failedToken)` is false, so `resource.canCommit` stays false until a later *new-revision* same-shape upsert resets it at line 174. Same-revision retry (`:166`) writes transform/motion and returns `applied` without touching `canCommit`. A following `beforeCommit`/`commit` on that resource (if any path calls `setLoadout` without line 174) throws `Equipment owner superseded` and can drop a good loadout. `remove` cannot abort a controller that was dropped. Not hit by `functional-v3` after the corrupt row.

**Fix:** Restore `desired` as `{actor:kept.actor, controller:new AbortController()}` or keep the previous token. Set `resource.canCommit=()=>current(desired.get(id))` (or `()=>true` while idle) in the catch before rethrow. Same-revision apply should reset `canCommit` the same way.

---

## Non-issues (current code)

- Sequential boot failure: `equipment-stream.js:423-428` `dispose` then `await drain()` before throw; stage catch then retires the body. Palette order is correct when nothing else retires the same resource concurrently.
- Per-request `token.controller` vs `resource.controller`: new upsert `existing?.controller?.abort()` (`:186`); same-shape copies `resource.requestSignal` before `setLoadout`. Lease/rebuild `AbortSignal.any` includes that request signal.
- Prop `dt` in `pose()` (`:86-88,94`) plus `equipment.update(dt)`: staff/book easing can advance without a new source row.
- `poseKey` skip (`:89-93`): 60 Hz source rows; `evaluateHandAnimation`/`updateAnimationManager(0)` run on seek. Matches the native-frame comment. Force after boot and live equipment (`:146,178`).
- `equipment-loader` delayed cache dispose when `beforeCommit && active` (`:53`): live `setLoadout` + `retire` keeps garments until the awaited rebuild finishes, then `drain`. Player has no `beforeCommit`; dispose stays synchronous. `drain:()=>chain` swallows rejections; remote still waits for settlement.
- `maxIdle` 0–2 in `equipment-stream.js:63-64`: player default 2. `loadBuffer(asset,{signal})`: `startupAssetBuffer` ignores the second argument.
- `prime-morph-materials.js`: same warm non-rendering scene as former `main.js` inline; one promise per engine; failure retries. Not a second game renderer.
- `inspection-preview` defaults: Armory unchanged (`includeAirborne`/`terminalHold` false). `ARMED_BASE` `'air'` is inert without the air option.
- `sockets.js` Orc `palmPush` 1.25 at attach: playable boot is still Human source then rebind; remote Orc never rebinds. Not a player-boot regression.
- Serial `createRequestQueue` pump: one `stage` at a time, so `owned.size >= capacity+1` is the 8 live + 1 staging ceiling, not two parallel restages.
- `prepare-native.js` palette borrow/restore in `finally`; `escaped===0` in prepared output. Not a runtime owner.
- `functional-v3` final `owned/leases/pendingBuilds` zero after `dispose` once work had finished. `liveEquipmentChanges` in that report is 0; same-body native armor remains the `one-actor-v3` row.

## Unverified (not counted as defects)

- `rebuildScenePbrPipelines(game.scene, true)` after `claimQueuedBuilds` rebuilds the live playable PBR family (player included). Hitch/flicker unmeasured. Same Lite 1.31.1 workaround as town/region staging. No mesh-scoped public rebuild in 1.31.1.
- `waitForGpuIdle` does not wait for deferred GPU retirements (`waitForGpuResourceRetirements`). Same as region exact. Residual driver memory unmeasured.
- `Walk_Carry_Loop` uses the raw unmasked two-hand clip; `Walk_Loop` + two-hand uses Armory layered carry. VAT row equality is an M8 gate.
- `capsuleHeight: 0` and `game.body.definition` for all remote races: clip names match the 57 source curves; grip quality on Orc/Undead seats was not measured (functional suite did not assert weapon matrices).
- Dispose-during-`loadGltf` / dispose-during-`beforeCommit` was not a `functional-v3` row. Findings 1, 3, 4 stay open until that race is a test.
- Eight-owner FPS, 100-actor capacity, and public Pages integration are out of scope.
