Milestone 3 is a partial streaming slice on accepted M2 code. It is not an M3 exit. Lite **1.31.1**, the direct-count bridge, and exact root `scaling.set(-h,h,h)` remain in the reviewed renderer. `frame-budget.js` is treated as unchanged per the parent. Later priority validation/reprioritization and public metadata descriptors were not re-read.

## Reproduced bugs

### 1. Active-id replacement is rejected when the pending map is full
**Severity: bug** — `src/character/region-crowd/request-queue.js:33-36`

`submit` only treats a **queued** id as a replacement. The in-flight job is not in `queued`, so a full pending map throws `Appearance queue is full` for that same id.

```33:36:src/character/region-crowd/request-queue.js
   if(!queued.has(id)&&queued.size>=limit){stats.rejected++;throw RangeError('Appearance queue is full');}
   cancel(id);stats.submitted++;
   const promise=new Promise((resolve,reject)=>queued.set(id,{id,priority,run,resolve,reject,sequence:sequence++,cancelled:false}));
```

Renderer impact: `renderer.js` admits **before** `desired.set` (`~290-292`). A throw leaves the old in-flight token and last coherent actor; the new revision/tier never enters the queue.

Same-revision transform coalesces on `pending.pending` and does not hit this. A **new revision or tier** for the actor that is currently preparing does, once `pending === limit` other ids are waiting.

**Repro:** `createRequestQueue({limit:1})`, one active, one queued other id, `submit('active', …)` throws `/full/`. Node confirmed.

**Fix:** Count unique ids. If `queued.has(id) || active?.id===id`, replace (cancel + enqueue) without using a new slot. Keep the throw only for a **new** id at the limit.

### 2. Live exact revision always decodes and rebuilds
**Severity: bug** — `src/character/region-crowd/renderer.js:166-188`, commit path `~269-286`

`prepareExact` reuses only `idleExact` by `variant.entry.sha256`. A live exact on the same actor/key is ignored. The new container is `own()`ed, staged, PBR-rebuilt; the previous copy is released to idle.

**Repro (lifecycle fixture):** `set(exact)` then `replaceActorAppearance` + `set(exact)` on the same id:

- `loadGltf` 2 → 3, `rebuildScenePbrPipelines` 2 → 3
- `sameResource === false`
- `idleExact === 1`, `owned === 3` (VAT source + live + idle duplicate)

That is a normal single appearance change duplicating an independent skeleton and a scene-wide PBR rebuild. It fights M3’s stall rule and the idle-reuse work that already exists.

**Fix:** If `actors.get(actor.id)?.exact` has the same `key` and is not retiring, `applyExact` + pose/transform in place (or after the queue `current()` check). Decode only on a key miss. Keep idle reuse for a **different** actor.

## Traced, not renderer-reproduced

**Exact ceiling vs retiring / comment mismatch** — `renderer.js:170-172`, `releaseExact` `67-69`, `disposeResource` `71-84`. Comment says incompatible idle is evicted before decode. Code throws if `owned.size-sources.length >= exact+idleExact+1`. `owned` still holds retiring resources until `builds` settle. Single-flight plus `between()` RAF makes a throw hard to hit; `idleExact: 0` plus `remove()` during a paused stage is the remaining window. **Fix:** Ceiling over non-retiring exact owners; evict incompatible idle before `loadGltf` as the comment states.

**In-flight exact after `remove()`** — M2 disposed any `owned` resource with that `actorId`. M3 only `queue.cancel` + `releaseExact` on the **committed** entry (`renderer.js:294`). The in-flight container is parked idle after `current()`/`token` fail. Single-flight bounds it; it is a lifecycle change, not a demonstrated leak.

**Asset-cache abort subscribe** — `asset-cache.js:10-31`. `throwIfAborted` then `refs++` then `addEventListener`. A synthetic abort inside `addEventListener` leaked `reservedBytes` (2). There is no yield on the production path between the check and the listener; treat as a defensive gap. After a successful load, `Promise.race` swallows a later abort reject (no unhandled rejection in Node).

**Process-global byte cache** — `asset-cache.js:7-8`. One 8 MB `entries`/`reserved` for every `createRegionCrowd`. Correct for one manager; two overlapping managers share the ceiling.

## Implemented and tested (12/12 Node)

`scripts/test-region-streaming.mjs` + `scripts/test-region-crowd-lifecycle.mjs` passed.

| Area | Covered |
| --- | --- |
| Queue | Limit, preserve admitted work, coalesce, priority order, close/drain, late submit `disposed` |
| Byte cache | Shared in-flight fetch, one-lease abort, final release, hash/size/ceiling, retry after verify fail |
| Renderer | Hide then retire after PBR build; decode drain before own; transform coalesce + exact `-h` root; pending remove does not commit; capacity recheck + swap-remove ids; stale revision; idle exact reuse/shape/idle cap 2; exact budget keeps VAT |

M2 seams still present in the reviewed renderer: `VERSION === '1.31.1'`, `setDirectInstanceCount` on VAT membership, exact glTF root TRS, no `attachVat` on the player, hide until `rebuildScenePbrPipelines`.

## Unmet M3 acceptance (`next-ten.md` §3)

No all-ten claim. No M3 exit.

- **WP1/3/6:** Counters exist (`streaming()`: queue, leases, exact/idle/owned, `gpuBytes` unknown). Limits are hardcoded `pending:32 / exact:8 / idleExact:2` and `8MB`, only lowerable, not committed device data from M2. Immutable bytes have a lease ceiling, not unused LRU. GPU totals remain unknown.
- **WP4:** Queue priorities 0–4 exist. Local / target / party / nearby policy was not in the reviewed `set()` (default `priority=2`). Parent later added validation/reprioritization; that delta was not re-verified here.
- **WP5:** Last coherent actor on decode/budget failure is tested. Queue-full throw on the **active** id is the atomic-admission hole.
- **WP7:** No arrival waves, failure injection, 10 town entry/exit cycles, 30-minute churn, 10 Mbit/s / 80 ms, loss.
- **WP8:** No isolated solo/startup remeasure, no streaming-tail gate, no reviewed live burst/promotion clip, no production gate.

Budget values and fallback policy are still in-source defaults, not a measured policy artifact.This turn was read-only review of milestone 3 streaming code: no game, clip, or Telegram delivery.
## Parent reconciliation

Both reproduced findings are addressed before the 30-minute run. Queue capacity now counts unique actor IDs across pending and active work, allowing one coalesced replacement to occupy the active identity's reserved slot while native decode drains. The pending map itself remains <=32. Same-fit live exact revisions use synchronous validated native morph/transform/pose writes after the current-token check; they do not decode/rebuild. Two new meaningful regression tests cover these cases (14 targeted streaming/lifecycle tests pass).

The exact ceiling deliberately includes retiring owners, because submitted/native-build resources still consume memory. The misleading eviction comment is corrected rather than excluding those bytes to make the counter smaller. In-flight removed containers become bounded hidden idle cache entries if they complete successfully; they never become another actor. The process-global verified-byte ceiling is intentional; compatible managers share leases. Closed managers now also clear resolved leases, variant buffers and decoded source arrays, so a retained diagnostic manager cannot hold those source bytes indefinitely. CPU/GPU accounting, slow-link/shared-cancellation tests, ten cycles, publication and endurance evidence were added after the review snapshot. Their acceptance is recorded separately, not attributed to this review.
