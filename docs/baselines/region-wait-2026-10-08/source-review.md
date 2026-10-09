# Region-wait source review (2026-10-08)

HEAD `1d4404c`. Read-only. No measured timings. Parent owns phase measurements and conclusions.

User-facing copy: **“Waiting for region collision before jumping…”** (`menu.js` 176–178). Fly-click uses **“Waiting for region collision before teleporting”** (`dev-tools.js` 119–121). Both keys off `tools.regionReady` → `ashen.regionReady`.

---

## Verdict on the candidate findings

All three hold in source.

1. **The dev gate waits for the full rest fence.** `menu.js` 173–178 disables Jump until `tools.regionReady`. `dev-tools.js` 147 defines that as `isAlive() && isRegionReady()`. `main.js` 900 wires `isRegionReady: () => ashen.regionReady`. `ashen.regionReady` / `whenRegion` flip only after hostiles, full foliage, and texture enhancement (`main.js` 916–924), together with `ashen.ready`. Comment at `main.js` 37–44 and 768–770 already names this as the “all of it” flag.

2. **The worker regenerates the whole partitioned world, then streams non-start chunks under credit backpressure.** `world-worker.js` 26–41: `partitionWorld(await buildChurchyard(..., { dataOnly: true }))`, skip `batch.initial`, `postMessage` one batch at a time with 8 credits. `world-partition.js` 70–98 splits near-start vs rest and chunks collision at 512 triangles / world at 4096. Main install is sequential 1 ms slices then `yieldToFrame()` (`starter-world.js` 608–613).

3. **`{ done: true }` is after grass, and box colliders install after that.** `world-worker.js` 43–59 generate foliage, transfer it, then `done`. `loadRegion` loops `while (!done || queue.length)` (`starter-world.js` 598), then installs remaining `manifest.boxes` with the same 1 ms / frame yield (`616–627`), then disposes the opening-path gates (`630–633`).

---

## What the string actually waits for

Three nested fences, coarsest last.

### 1. Menu / jump / teleport (what the user reads)

| Step | Where | What becomes true |
| --- | --- | --- |
| Tools object exists | `main.js` 317 stub `{tick(){}}`; real tools at 900 | Until `attachDevTools`, `tools.regionReady` is missing, so the status line is already the wait copy (`menu.js` 173–178) |
| `attachDevTools` | `main.js` 900, inside `whenRest`, after combat / armory / creator import | Destinations and `regionReady` getter exist; Jump still disabled |
| `ashen.regionReady = true` | `main.js` 916–924 | After `await ashen.whenHostiles` and `await Promise.all([foliageP, texturesP])` |

`foliageP` is `regionP.then(() => world.startFoliage())` (`737`). `texturesP` is `regionP.then(upgradeTextures + optional character texture upgrade)` (`741–748`). `whenHostiles` waits town enemy load (`908–916`). Nearby foliage is also inside `regionP` after `startRegion` (`729–734`).

God / Fly buttons wait only for `tools.dev.enabled` (`menu.js` 180–185). Jump and fly-teleport wait for `regionReady`.

`whenRegion.then` in `dev-tools.js` 140–145 runs `?at=` auto-jump on that same full fence.

### 2. Actual walkable collision (what the copy claims)

`loadRegion(player)` (`starter-world.js` 530–638`), started as `world.startRegion(player)` from `regionP` (`main.js` 721–727`).

Order:

1. Temporary visible railing + Havok gate boxes (`533–571`).
2. Worker start (`575–596`).
3. Drain transferred batches through `install(block, player)` until `done` and queue empty (`598–614`).
4. Remaining authored boxes (`616–627`).
5. `gates.dispose()` — “Every route now has real collision” (`628–633`).

After step 5 the player can walk the streamed region. There is no public `collisionReady` / `whenCollision`. `regionP` continues into nearby foliage. `whenRegion` continues past that into foliage replace, textures, and town NPCs.

On the diagnostic full-world path (`main.js` 198: `buildChurchyard` when `fastStart` is false) `world.startRegion` is absent, so `regionP` skips the worker. Collision is already in `world.colliders` at playable time. Jump still waits `regionReady`.

### 3. `install()` per chunk (CPU / GPU / Havok, same call)

`starter-world.js` 200–305. For a given `meshId:indexOffset` key:

- Collision record: `createMeshFromData` → `player.installStaticColliders` → `disposeMeshGpu` of the cook source (`206–229`). `installedCollisions` is set even if a later GPU upload throws, so retry must not recook (`226–228`).
- World record: lazy/eager storage allocate, CPU interleave (64-byte vertices + shadow positions), three `updateStorageBufferRange` uploads (`230–275`).

Render and collision for one block share one `install()` and one 1 ms slice.

---

## Wait kinds (no durations)

Name these separately when measuring. Source does not rank their cost.

**Worker / header generation (off main thread, before and between transfers)**

- Full `buildChurchyard` + `partitionWorld` of every triangle, including near-start batches that are never sent (`world-worker.js` 26–33; `world-partition.js` 47–102).
- Header `postMessage` then mesh-list equality check against the starter manifest (`world-worker.js` 30; `starter-world.js` 579–585). Mismatch is `reloadRequired`.
- After every non-initial batch has transferred: `generateFoliagePlacements` + `bucketFoliagePlacements` (`world-worker.js` 43–58`). This sits on the `done` signal that unblocks box install.

**Transfer / backpressure**

- Eight credits; worker blocks at 0 until main `ack` (`world-worker.js` 9–17, 33–41`; `starter-world.js` 611`).
- Transferable buffers. Main parks on `wakeWorker` when the queue is empty (`starter-world.js` 601–606`).

**Main-thread CPU + Havok**

- Vertex interleave in `install()`.
- Havok mesh cook per collision chunk. `world-partition.js` 81–84: cooking cannot yield inside one shape; 512-triangle collision pieces.
- Authored box colliders after `done` (`starter-world.js` 616–627`).

**GPU upload**

- Storage allocate (`137–198`) and three range uploads per world block (`258–275`). Collision source meshes are GPU-disposed after cook (`306–314`).

**Frame elapsed**

- After each ≤1 ms inner loop: `await yieldToFrame()` (`starter-world.js` 613`, also 623–626 and skyline 492). Wall-clock wait grows with chunk count × frames even when a slice is short. Same yield is used so walking stays on the native render loop (`main.js` 718–720).

**Network (on this gate)**

- Starter geometry is already fetched before play (`starter-world.js` 41–63, 93). The region worker is local generation.
- Texture enhancement (`639–657`) and character texture upgrade (`main.js` 741–748`) are after `regionP` and are on `regionReady`.
- Skyline fetch (`463–508`, kicked at `main.js` 710–713`) is parallel to `regionP`; `regionReady` does not await it. Nearby foliage reads starter manifest bytes (`429–443`).

---

## Prioritized diagnosis

**P0 — gate semantics.** The long wait the user sees is `ashen.regionReady` meaning the entire background rest (combat already created, townsfolk, town hostiles, full foliage replace, material enhancement). Walkable collision for the streamed region is already installed at the end of `loadRegion`, which is also when the in-world gates drop. This is the first place to look for “why does Waiting for region collision take so long?”

**P1 — `startRegion` is still a compound job.** Even a collision-true fence today would include: worker rebuild + header, credit-stalled mixed render/collision transfers, foliage generation before `done`, then RAF-sliced box cooks. `regionP` then still awaits nearby foliage before the local `regionP` promise settles (`main.js` 729–734`).

**P2 — data source.** The far region is regenerated in the worker on every play, while the start slice and skyline already use built packets (`starter-world.js` 33, 463–476`; `world-partition.js` 1–2). That is real work on the `loadRegion` path. It is behind P0 for the menu string.

---

## Safe narrow remedies

Keep 1 ms slices and the 8-credit window. They exist so Havok/GPU install can run while the player walks (`world-partition.js` 81–83; `world-worker.js` 6–8; `starter-world.js` 608–613`).

1. **Point Jump / fly-teleport / `?at=` at collision completion.** A new signal that resolves when `loadRegion` finishes successfully (gates disposed, mesh + box colliders installed), or immediately when `world.startRegion` is absent. Leave `ashen.ready` / `ashen.regionReady` as “all of it” for existing suites (`main.js` 328–331, 768–770, 918–924`). Menu copy already describes collision.

   Limits: destinations outside `START_BOUNDS` (`world-partition.js` 3, 12–18`) need those far colliders. Do not resolve on a failed or disposed `loadRegion`. `startRegion` already nulls `regionPromise` on catch for retry (`starter-world.js` 458–461`); the signal must reset the same way. Header mismatch stays reload (`583–585`, `main.js` 725`). `finally` must still `worker.terminate()` (`634–637`). Do not dispose gates before the box loop (`616–633`). Do not recook keys in `installedCollisions` (`226–228, 203`).

2. **Split worker completion.** Send a geometry-complete message before foliage generation, and keep foliage on its own message/promise. `loadRegion` only stores `api.preparedFoliage` (`586`) and `startFoliage` consumes it later (`445–453`). Unblocking `done` from grass is safe only if `startFoliage` waits for that foliage message explicitly. `preparedFoliage == null` at replace time is a behavior change.

3. **Collision-first batch order (optional after 1–2).** Partition already tags `batch.collision` (`world-partition.js` 55, 84`). Sending collision chunks before world chunks can make the collision signal earlier.

   Limits: `install()` still uploads visible geometry in the same function. Collision-without-draw (or draw-without-collision) is a consistency hazard for ordinary walking. `jumpTo` uses authored `destination.floor` (`dev-tools.js` 83–86`) so it can stand without the mesh, but fly-pick needs a pickable surface (`124–128`). Prefer keeping a block’s collision and world install on the same key, or documenting a visible-geo catch-up before enabling walk-off-jump. Skyline already forbids collision on background blocks (`starter-world.js` 481`).

4. **Attach a collision-capable `getDevTools()` earlier** if the status pane is opened during combat setup. Today the stub makes the same wait string appear before `attachDevTools` (`main.js` 212, 317, 900). God/Fly still need `combat.hud`. Jump only needs player + collision + destinations from `world`.

---

## Build-time streamed region data

Worth considering as a follow-on to P0/P1: the partition helper is already shared with the asset build (`world-partition.js` 1–2), the start packet and skyline packet already exist, and every play currently re-runs `buildChurchyard` to reproduce the far slice plus a header equality check that exists because generator and packet can diverge (`starter-world.js` 579–585`).

It is **not** a trivial boolean-only optimization:

- Mesh records, vertex/index offsets, and `collision`/`world` flags must stay identical to the starter header or `install()` writes the wrong storage ranges.
- Foliage placements are produced in the same worker turn as geometry (`world-worker.js` 43–58`) and consumed by a later `replacePlacements` (`starter-world.js` 445–453`). A static region packet still needs a foliage story.
- Havok cook, CPU interleave, GPU range upload, 1 ms slices, credits, gate/retry/dispose, and `installedBlocks` / `installedCollisions` / `installedBoxes` remain on the main thread regardless of who authored the bytes.
- Splitting collision vs visible packets reopens the consistency limit above.
- The diagnostic full-world path never starts this worker (`main.js` 198); a packet-only fast path must leave that route able to play with collision already present.

---

## Suggested measurement cuts (parent)

Do not treat `regionMs` / `whenRegion` as collision time (`main.js` 921–924`). Useful marks already nearby: `bg-start` (`707`), worker header vs first batch vs foliage vs `done` (none today), `loadRegion` return (gate dispose), nearby foliage, `bg-foliage-end` (`771`), `hostiles-ready` (`915`), `ready` (`920`). Report worker CPU, main install CPU/Havok, GPU upload, and RAF-elapsed separately from that rest tail.

## Parent review correction

Grok 4.6/high session `01a11f19-0913-7953-b8b1-8e0b840dadcc` completed in three turns with `end_turn`; no browser or source changes. Root confirmed the lifecycle findings against current source. One detail above is inaccurate: current Fly click picking uses native Havok through `dev-surface-pick.js` / `player.raycast`, not a pickable render mesh. Matching visible geometry remains necessary for readable/safe navigation, but render-mesh pickability is not the mechanism. The priority ordering above is based on source alone; the measured receipt shows the mixed worker/install pipeline dominates this local wait, while optional work after actual collision adds only 416 ms here. The staged plan distinguishes this evidence from expected benefits.
