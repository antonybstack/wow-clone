# Region-readiness source review (2026-10-09)

Reviewer: Grok 4.6/high. Independent source read of the frozen diffs named in the task. No browser, tests, builds, deployment, messages, subagents, or source edits. Parent owns live acceptance, FPS, and constrained-network comparison. This review does not claim a speedup.

Inspected: diffs of `src/ashen-reach/{main,dev-tools,menu,starter-world,world-worker}.js`, `scripts/ashen-reach/{prepare-starter-world,verify-starter-geometry}.mjs`, `vite.config.js`, plus the new `scripts/test-prepared-region.mjs` and `scripts/ashen-reach/check-region-readiness.mjs`, against `docs/plans/gothic-exploration/region-readiness-2026-10-08.md`. Stopped before a full reread of `pruneStartupAssets`, `boundary()`, production `public/_headers`, and the later `sharedPacket` slice in `install()` (parent-applied after this read).

Parent later reported seven native controls passing on prepared packet and worker fallback, twenty CPU/prepared-asset tests passing, and capped local visits of navigation ~10.8s packet vs ~18.1s worker. Those are parent observations. Constrained-network built-bundle comparison is still pending. New packets are ~22.4MB encoded / ~158MB decoded geometry and ~4.4MB encoded foliage; a slow link can dominate the remaining wait.

## Contract match (source)

Navigation is a separate flag/promise (`navigationReady` / `whenNavigation`). `finishNavigation` installs remaining box colliders, removes the temporary fence, then runs `onNavigationReady`, which retires proxies, re-registers shadows, and reaches the navigation boundary. Jump, click teleport, `?dev&at=…`, and the Developer tools copy key off that boundary. `ready` / `regionReady` / `whenRegion` still wait for foliage, textures, and the rest of the background path.

Tools bind after the playable fence with `getCombat: () => combat`, so HUD messages follow the combat module when it arrives. Worker posts `geometryDone` after every geometry `postMessage` and before grass generation; the main drain waits on `geometryDone` and the queue, then keeps the same worker until `done` plus foliage. Prepared region uses native `http-br` (`Content-Encoding` on the Vite middleware), `checkedFetch` + `arrayBuffer()`, existing `readBlock` / `install()` / 1ms yields. Manifest keeps block/tile descriptors in the optional index; `manifest.geometry.region.files` lists the two immutable packets for the pruner. Near-tree ranges are copied into the region packet so a failed skyline cannot leave holes; `install()` already skips a duplicate `meshId:indexOffset`.

## Remaining consequential defects

### 1. Foliage retry re-enters the gate after navigation is open

`startRegion` still owns both phases. On failure it nulls `regionPromise` so `main.js` retries the whole `startRegion`. `finishNavigation` already disposed `gates`. The next `loadRegion` sees `!gates` and builds a new visible/Havok fence, then walks geometry again (worker rebuild, or prepared re-fetch + `install()` no-ops over every block).

That re-boxes a player who was already allowed to jump, and it couples optional foliage/network failure to a second collision pass. `install()` / `installedBoxes` prevent duplicate Havok bodies on the happy retry; the fence return is the defect.

Narrow correction: after `onNavigationReady`, retry only the foliage wait (reuse the live worker or the in-flight `foliageP`). Refuse to construct gates once they have been removed for this visit. Keep `regionPromise` reset for true geometry failures only.

### 2. Prepared 158MB packet stays reachable until foliage settles

`loadPreparedRegion` holds `bytes` and the `blocks` view list across `await foliageP`. Parent’s later `sharedPacket` slice stops `createMeshFromData` pinning that buffer on the meshes; the function locals still pin it for the whole optional-grass wait.

Narrow correction: drop `bytes` / `blocks` (and abort the geometry fetch) immediately after `finishNavigation`, before awaiting foliage. Confirm `sharedPacket: true` is set on every prepared geometry block and is unset on native worker arrays. Buffer-ownership proof remains the parent’s.

### 3. `whenRest` failure still fails the navigation boundary

`ashen.whenRest.catch` calls `navigationBoundary.fail` together with combat/hostiles/region. A foliage/texture/NPC failure after navigation has reached must not revoke jumps. This review did not reread `boundary()`. If `fail` after `reach` is a no-op, there is no user-visible break; if it rejects late waiters or clears the flag, that is a contract break.

Narrow correction: omit `navigationBoundary.fail` when `ashen.navigationReady` is already true (still fail `regionBoundary`).

### 4. Production Brotli headers were not in the frozen diff set

`vite.config.js` extends the starter `Content-Encoding: br` matcher to `region|region-index|foliage`. The frozen `git status` did not include `public/_headers`. Runtime `readPacket` asserts decoded `rawBytes`. On Pages, compressed bytes without that header fail the prepared path with no worker fallback (`loadRegion` takes `manifest.geometry.region` when present).

Narrow correction: add the same three prefixes to the Pages `_headers` family that already serves `near` / `skyline`, or accept that production must keep using the worker until that file is updated. Parent should confirm current `_headers` before a sealed preview.

## Test scope (source, not a rerun)

`scripts/test-prepared-region.mjs` covers native Brotli index/geometry/foliage coverage, several corrupt shapes, and one corrupted index digest. It does not exercise `files` vs index mismatch, skyline duplicate-range equality, or schema≠1.

`scripts/ashen-reach/check-region-readiness.mjs` does the right native controls for early tools, held combat/texture, worker/packet foliage hold, Jump/walk/nave click, header mismatch, dispose, and `legacyStart`. The undercroft `at=` case does not hold foliage; the name claims a hold the setup does not perform. Dispose uses `packet: true` with no hold, so a fast local packet can fulfill `whenNavigation` before `ASHEN.dispose()`. Neither harness retries foliage after navigation, so defect (1) is untested.

Parent’s later seven live controls and twenty CPU tests sit outside this review.

## Acceptance limits

- No independent timing, FPS, or network claim. Do not treat ~10.8s vs ~18.1s as a review result or as evidence the 22.4MB packet is faster on a constrained link.
- First-play download: the required manifest only gained small region-index metadata plus a `files` list; `loadPreparedRegion` runs after the playable fence. This review did not read `pruneStartupAssets` to prove it walks `manifest.geometry.region.files`.
- Exact geometry/Havok/shadows: source order matches the contract; live identity is the parent’s.
- Worker `geometryDone` ordering matches HTML message-port order in the cited comment; this review did not re-audit the transfer-credit loop after the drain condition changed.

Reviewer finished. Parent owns remaining live/network acceptance.
