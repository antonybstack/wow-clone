# Region destination-priority source review

Independent Grok 4.6/high source-only planning review. HEAD `9237092739741ceb12e32667ef9df89546e248c8`. No browser, FPS, build, world generation, deploy, or product/docs edits. Root owns implementation and the final plan. G06 isolated FPS remains pending an unrelated user tab and is out of scope.

Read: `docs/plans/gothic-exploration/region-readiness-2026-10-08.md` (current 2026-10-09 explanation plus original 2026-10-08 findings), `docs/baselines/region-readiness-2026-10-09/README.md`, `src/ashen-reach/starter-world.js` (`install` / `startRegion` / `loadPreparedRegion` / `finishNavigation`), `src/ashen-reach/main.js` (navigation boundary), `src/ashen-reach/world-partition.js`, `scripts/ashen-reach/prepare-starter-world.mjs`, `scripts/ashen-reach/verify-starter-geometry.mjs`. Follow-up reads after the first batch: `src/ashen-reach/region-stream.js`, `src/ashen-reach/dev-destinations.js`, `src/ashen-reach/dev-tools.js` (`jumpTo` / `?at=`), `scripts/test-region-stream.mjs`, `src/ashen-reach/scene.js` collider assembly, and root metadata `.cache/region-priority-2026-10-09/distribution.json`.

Root metadata (not re-measured here): `region-c892ee93228d.br`, 22,401,010 encoded / 158,144,000 decoded bytes, 1,037 blocks, 681 boxes, 74 mesh records.

## Current gate (why jumps still wait)

`ASHEN.navigationReady` already excludes foliage, texture upgrades, and NPCs. Developer Jump, Fly click teleport, and `?dev&at=` wait on that flag (`dev-tools.js` `jumpTo` / `whenNavigation`). `regionReady` is later.

The remaining wait is still **the entire optional region geometry stream plus every remaining box**, not a selected destination.

Prepared path (`starter-world.js` `loadPreparedRegion`):

1. After first play, `checkedFetch` the region index (`http-br`), parse `schema`/`meshes`, cache `preparedRegionIndex`.
2. `checkedFetch` the single 22.4 MB geometry file at `priority:'low'`.
3. `for await (const block of readRegionBlocks(response, index.geometry)) install(block, player)` with a 1 ms budget and `yieldToFrame()`.
4. Only after the generator completes (all layouts consumed, no trailing bytes) call `finishNavigation`.
5. `finishNavigation` installs every `manifest.boxes` entry that does not intersect `START_BOUNDS` and is not already in `installedBoxes`, then disposes the start fence, sets `navigationComplete=true`, and calls `onNavigationReady`.
6. Foliage is a later independent packet. Late grass retries do not redo collision.

`main.js` `navigationReady()` then `world.retireProxies()`, `shadows.setWorld(world)`, and `navigationBoundary.reach`. Until that callback, `jumpTo` returns false and `?at=` stays queued.

The compatibility worker has the same completion shape: drain every geometry chunk, then `finishNavigation`. Packet streaming already overlaps download with install. The gate does not open on a prefix.

---

## Question 1 — Can existing packet/block ordering and bulk meshes support a safe early destination-specific navigation boundary?

**Short answer:** existing Vaelmark-first packet order is already a useful prefix, but the current meshes, fence, box pass, and `onNavigationReady` side effects cannot safely mean “cathedral jump is allowed.” A destination-specific boundary is possible only if it is a **new fail-closed flag**, kept separate from fence removal and proxy retirement, and only after an explicit destination collision+render set is installed. Bulk `Earth` / `Far earth` / `Physical mountain terrain` records and end-of-packet `Region structure collision` cannot be treated as “already ordered for nave.”

### Collision and render sources (from partition + prepare + scene + distribution)

Partition (`world-partition.js`) splits each authoring batch into near-start vs rest using triangle centroid vs `START_BOUNDS` `{-16..16, -16..24}`. Collision chunks are 512 triangles; render chunks are 4,096. There is **no destination AABB, no per-block bound, and no route tag**. `vertexOffset` / `indexOffset` pack sequentially per mesh. Packet order is independent of those storage offsets.

Prepare (`prepare-starter-world.mjs` 66–71) builds one region packet:

1. Initial deferred `Bare woodland` world/non-collision blocks (near tree render duplicated with skyline).
2. All non-initial blocks, stable-sorted so names starting with `Vaelmark` come first.

Distribution first/last block indices for that packet:

| Mesh | world | collision | blocks | decoded bytes | triangles | first–last block |
| --- | --- | --- | ---: | ---: | ---: | --- |
| Bare woodland | yes | no | 13 | 8,842,680 | 49,126 | 0–152 (not contiguous) |
| Vaelmark masonry | yes | no | 4 | 2,831,040 | 15,728 | 2–5 |
| Vaelmark cathedral | yes | no | 13 | 9,334,800 | 51,860 | 6–18 |
| Vaelmark roof | yes | no | 1 | 104,040 | 578 | 19 |
| Vaelmark foundation | yes | no | 1 | 73,440 | 408 | 20 |
| Vaelmark collision | **no** | **yes** | 27 | 2,440,080 | 13,556 | 21–47 |
| Earth | yes | yes | 89 | 8,179,200 | 45,440 | 48–136 |
| Bell towers | yes | no | 1 | 146,160 | 812 | 153 |
| Region structure collision | no | yes | 22 | 1,992,960 | 11,072 | 996–1017 |
| Far earth | yes | yes | 335 | 30,843,720 | 171,354 | 430–764 |
| Physical mountain terrain | yes | yes | 231 | 21,213,360 | 117,852 | 765–995 |

`scene.js` installs cathedral collision as its own hidden mesh (`colliders.push({type:'mesh', mesh:cathedralCollision})`), region structures and region-world collision as separate hidden batches, and far earth/mountains as mesh colliders. Tree trunks, fences, and similar volumes are **boxes on the required manifest**, not region-packet triangles.

Exact cathedral **mesh** collision is therefore `Vaelmark collision` (13,556 triangles), matching the G02 collision count in CURRENT.md. Exact cathedral **visible** structure is the five Vaelmark world meshes (masonry, cathedral, roof, foundation, plus collision which does not draw). Bell-tower render is a different mesh name, so the Vaelmark sort does **not** pull `Bell towers` forward.

### Final boxes

681 boxes live in the **required** starter manifest (`manifest.boxes`). `intersectsStart` keeps overlapping start boxes for first play. `finishNavigation` installs the rest after the **whole** region stream. Boxes are not downloaded with the 22.4 MB packet. Sequencing them after the stream is a completeness policy, not a data dependency.

A named floor jump (`dev-destinations.js` reads `cathedral.route`, chapels, gallery, parapet, towers, undercroft, landmarks, `regionStructures.destinations`) lands on authored coordinates. Those floors are intended to sit on mesh collision. Distant tree-trunk boxes are not required to stand in the nave. Click-teleport (`pickTeleportSurface` / Havok) **does** need every surface the cursor might hit; enabling Fly click at cathedral-ready would be unsafe if far earth/mountain/structure collision is still missing.

### Terrain

`Earth` is one world+collision record covering all far-from-start earth triangles in source order, chunked 512 at a time. Its mesh AABB is the whole batch. Blocks 48–136 arrive **after** Vaelmark collision. Cathedral approach/bridge may need some of those triangles; interiors may not. That ownership is **not proven from source names alone** (unverified: which `Earth` chunks overlap nave, bridge, undercroft, Eastwatch).

`Far earth` and `Physical mountain terrain` are the bulk of decoded collision (combined ~52 MB / 289k triangles) and sit in the second half of the packet. They are irrelevant to a nave jump and fatal to an early **walk-out** if the start fence is removed.

### Render / GPU constraints

`install()` on first block of a world record calls `allocateRecord()`, which allocates the **full** vertex/index/shadow storage for that mesh (`record.vertices * 64`, `record.indices * 4`, shadow `vertices * 16`) and `addToScene`s a mesh whose `indexCount` is the complete record. Later blocks `updateStorageBufferRange` into holes. Until every block of that record is written, the GPU mesh contains unfilled ranges. The mesh is already in the scene.

Consequences:

- Early-installing one `Earth` block allocates the entire Earth GPU buffer and can draw uninitialized ranges. Destination-safe render for bulk terrain requires **all blocks of that record**, or a partition that keeps destination terrain in its own mesh record.
- Vaelmark world meshes are small (1–13 blocks) and contiguous in the packet. Completing those five records before opening a cathedral **view** is realistic.
- Collision-only records (`Vaelmark collision`, `Region structure collision`) never allocate world storage. They cook Havok from sliced CPU arrays (`sharedPacket` → `array.slice()` so the 158 MB backing is not pinned), `installStaticColliders`, then `releaseCollisionSource` immediately. Keys `installedCollisions` / `installedBlocks` prevent duplicate cooks on retry.

### Fence, shadows, proxies

The temporary fence is four Havok boxes + a visible railing around `START_BOUNDS`. It is the walk-out guard. `onNavigationReady` currently **removes it** and **retires every remaining proxy**, then rebuilds shadow registration.

`install()` already hides a proxy when its target record is complete, or when `requiresBlocks` are present (near-tree previews). Calling `retireProxies()` at cathedral-ready would delete far woodland/terrain stand-ins before exact meshes exist, which breaks the preserved proxy-shadow contract.

### Fail-closed / disposal (observed)

| Event | Behavior |
| --- | --- |
| HTTP error / schema mismatch | throw; `reloadRequired` skips retry; other errors retry via `main.js` `regionP` loop |
| Truncated or trailing stream | `readRegionBlocks` throws; `finally` `reader.cancel()` if incomplete |
| Dispose / abort | `disposed` checks in install loop, box loop, and packet reads; `regionAbort.abort()`; scene dispose aborts skyline+region and terminates worker |
| Mid-stream failure | `navigationComplete` still false; fence stays; `regionPromise` cleared; retry refetches the whole geometry URL; `installedBlocks`/`installedCollisions` skip duplicates |
| `finishNavigation` dispose during boxes | throw **before** `navigationComplete`; some extra boxes may already be live; fence still up |
| `onNavigationReady` throw after boxes | **hole:** `navigationComplete=true` and gates already disposed, then `deviceLost` throw happens **before** `navigationBoundary.reach`. Retry sees `navigationComplete` and **skips** `finishNavigation` / `onNavigationReady`. Jumps stay closed; the walk fence is already gone |
| Post-resolve `navigationReady()` | no-op if `ashen.navigationReady` already true |
| `whenRest` catch | `navigationBoundary.fail` — fail-closed for waiters |
| GPU upload throw after collision cook | collision key already set; retry will not recook that block |

`readRegionBlocks` refuses to complete on a prefix: the `for` consumes every block layout, then asserts no trailing bytes. `install` of prefix blocks can happen, but `finishNavigation` never runs until that completeness check.

**Verdict for Q1:** packet order already puts Vaelmark render+collision in blocks ~2–47, after some duplicated near-tree bytes. That is **not** a safe destination boundary under the current API. Bulk meshes (`Earth` 89 blocks, `Far earth` 335, mountains 231) and `Region structure collision` at 996–1017, plus fence/proxy side effects on the same callback, block a “just open navigation earlier” change. A separate per-destination ready signal can reuse `install()`, Havok keys, and Vaelmark-first order if it does not drop the fence or retire proxies.

---

## Question 2 — Split independently validated packages vs reorder one stream?

**Short answer:** **split** the optional region into independently fetched, tiled, content-addressed `http-br` packages. Reordering the existing 22.4 MB body is already done for Vaelmark and does not change the completion contract, retry ownership, or cache behavior. A partially downloaded **single** stream is not a validated package.

### What a partial stream is and is not

`region-stream.js` already uses native `fetch` + `response.body.getReader()` (HTTP Brotli decoded by the browser; no JS decoder). Tests in `scripts/test-region-stream.mjs` pin: first block can yield before the remainder arrives; arbitrary chunk sizes; truncated body cannot complete; trailing bytes cannot complete; invalid metadata refused before body read; leaving install cancels the reader; transport errors propagate.

Runtime does **not** SHA-256 the geometry body. Completeness is:

- sequential attribute offsets tiling `packet.rawBytes` (same tiling rule as `verify-starter-geometry.mjs` `assertTiled`)
- every layout filled
- no trailing bytes

A prefix that happens to contain Vaelmark blocks is **installable**, but:

1. It is not an independently hashed artifact. The filename/`sha256`/`encodedBytes` on the index describe the **whole** encoded file.
2. HTTP `Content-Encoding: br` range requests on encoded bytes are not independently decodable without a custom decoder (explicitly out of scope). Retry is a new GET of the entire URL.
3. `loadPreparedRegion` `finally` aborts the controller. Failure/retry ownership is the whole packet: `checkedFetch` + stream + `regionP` retry. Prefix progress is only the in-memory `installed*` sets.
4. Native cache did not retain this 22.4 MB response in the sealed seeded-cache pairs (`docs/baselines/region-readiness-2026-10-09/README.md`). One stream keeps that cache unit.
5. The generator **must not resolve** today until the trailing-byte check. Opening jumps from a prefix would be a new contract: “these destination records are complete” while the same reader is still live. A later truncation would then be a **post-jump** failure of the remainder, with retry re-downloading 22.4 MB including bytes already installed.

### Why split matches existing machinery

The repo already has independently validated packages: `near-*.br`, `skyline-*.br`, `region-index-*.br`, `region-*.br`, `foliage-*.br`. `writePacket` / `verifyPacket` already do content-addressed names, SHA-256, encoded/raw lengths, and exact attribute tiling. The index already indirection-lists `geometry.file` and `foliage.file`. Near stays out of the required path except a tiny index descriptor (`geometry.region.files`).

A destination package would be another `writePacket('vaelmark'|…)` entry in the index, verified the same way, fetched with the same `checkedFetch` + `readRegionBlocks` (one packet per response). Failure retries **that** URL. `installedBlocks` still dedupe. Grass stays last.

### What must not be invented

No JS Brotli, no `arrayBuffer()` of 158 MB, no second Havok path, no custom cache, no HTTP range decoder. Worker path remains the compatibility fallback when `manifest.geometry.region` is absent.

### Insufficient reorder-only story

Vaelmark-first sort is already in prepare. Cathedral jump wait is the **all-blocks gate**, duplicated near-tree prefix bytes in the same body, and `finishNavigation` after EOF. Reorder cannot skip downloading woodland/far-earth/mountain for a nave jump while they share one HTTP resource. Split can fetch a Vaelmark package first and overlap the rest.

---

## Question 3 — Bounded next implementation slice and acceptance gates

Goal: substantially shorten **cathedral developer jump** wait, keep exact near, first play ≤1 s, trees, proxy shadows, and existing routes. No measured-timing claim, no physical-mobile claim, no new production qualification.

### Recommended slice (one change set)

**Name:** destination-package fetch + destination navigation flag. Do not redefine `navigationReady` as a prefix.

**Bake (`prepare-starter-world.mjs`, `verify-starter-geometry.mjs`):**

- Keep `near-*.br` byte-identical (existing `verifyPacket('near', …)` and encoded 149,963-byte contract).
- Split current `region-*.br` into at least two immutable `http-br` packages listed by the existing region index:
  - **Vaelmark package:** all `Vaelmark*` world blocks + `Vaelmark collision` + `Bell towers` (bell landings share cathedral destinations). Exclude duplicated near `Bare woodland` ranges that already exist in skyline/near.
  - **Remainder package:** Earth, far earth, mountains, woodland, region structure collision, other render.
- Extend `verifyStarterGeometry` so each new package tiles, hashes, and names like today’s packets; the **union** with required near blocks still covers every mesh `vertices`/`indices` exactly once (same gap/overlap proof as now). Skyline duplicate-tree equality stays on the remainder or a dedicated tree range, not on the Vaelmark package.
- Do not put destination packages in the required manifest; only add file names to `geometry.region.files` for the pruner.

**Runtime (`region-stream.js` unchanged per packet; `starter-world.js` `loadPreparedRegion`):**

- Fetch+install the Vaelmark package first with current `readRegionBlocks` / `install` / 1 ms yield.
- When every Vaelmark+bell record in that package has `installedBlocks` covering its blocks **and** `Vaelmark collision` keys are in `installedCollisions`, call a new `onDestinationReady('vaelmark')` (or equivalent). **Do not** dispose the start fence. **Do not** call `retireProxies`. **Do not** set `navigationComplete`.
- Install remaining region boxes that overlap a conservative cathedral AABB **or** skip extra boxes for named floor jumps (floors are mesh-backed). Leave the full box pass in `finishNavigation` for Fly click + walk-out.
- Then fetch remainder (+ existing foliage-after-routes rule).
- `finishNavigation` still means: remainder geometry complete, **all** leftover boxes, fence down, `navigationComplete`, current `onNavigationReady`.

**Boundary (`main.js`, `dev-tools.js`, `menu.js`):**

- Add `whenDestination` / `destinationReady` (id or family) without changing `whenNavigation` / `whenRegion` / `whenPlayable` meanings.
- `jumpTo` / `?at=` for `cathedral-*` ids wait on the Vaelmark destination flag. Eastwatch / landmarks / Fly click / walk-out keep waiting on full `navigationReady`.
- Menu: enable the cathedral options when the destination flag is up; keep a waiting state for the others. Do not label this as full collision ready.
- Fail-closed: destination flag only sets if the Vaelmark package fully validated and installed; dispose/deviceLost/HTTP/header failure must not set it; retry of that package only; if remainder fails after destination-ready, keep cathedral jumps, fail remainder/full navigation, keep the start fence until remainder succeeds.

**Worker path:** leave as full-geometry-then-`finishNavigation`. Destination-ready is prepared-path only, or emit the same destination callback when those meshIds have been installed from worker chunks (optional, not required for the slice).

### Acceptance gates (no new timing numbers)

CPU / source (extend existing focused checks, do not generate the world in this review):

- Near packet file+hash unchanged.
- Each new package: `http-br`, tiled attributes, sha256/name, no gap/overlap in the union.
- Stream tests reused per package: truncate/trailing/cancel.
- `install` keys still prevent duplicate Havok on Vaelmark retry.
- Destination callback cannot fire if collision keys for `Vaelmark collision` are incomplete.
- `retireProxies` still only from full `navigationReady`.
- Fence still present until `finishNavigation`.

Native controls (root-owned live, not this review):

- `?dev&play&at=cathedral-nave` (and entrance/chapels/gallery/parapet/undercroft/bells as claimed) jumps once the Vaelmark package is in, while remainder/grass/textures are deliberately held.
- Start meadow ordinary movement unchanged; walking out still hits the fence until full navigation.
- Eastwatch wall-walk / hall-balcony / Fly click stay disabled until full navigation.
- Vaelmark package 503/header failure: no cathedral jump, fence up, retry does not duplicate colliders.
- Remainder failure after destination-ready: cathedral jump remains; full navigation stays closed; disposal cancels both fetches.
- Skyline proxies remain until their exact records complete; shadow registration at destination-ready is **not** a full `setWorld` retirement.
- First playable still uses only required near; region requests still start after play.
- Settled FPS / frame tails measured only in a later isolated window; this slice must not claim them. G06 FPS gate remains a separate hold.

### Concrete file/API list

- `scripts/ashen-reach/prepare-starter-world.mjs` — multiple `writePacket` region geometry members; index `geometry` becomes a list or `{packages:[{id,file,blocks,…}]}`; keep foliage packet.
- `scripts/ashen-reach/verify-starter-geometry.mjs` — verify each package + union coverage; refuse Vaelmark package that includes colliding `Earth`/`Far earth` unless explicitly specified.
- `src/ashen-reach/starter-world.js` — `loadPreparedRegion` sequential package loop; `onDestinationReady`; fence/`navigationComplete` unchanged until last geometry package.
- `src/ashen-reach/main.js` — destination boundary object alongside `navigationBoundary`.
- `src/ashen-reach/dev-tools.js` / `menu.js` — per-id enablement; `?at=` uses destination waiter for cathedral ids.
- `scripts/test-region-stream.mjs` plus a small package-index unit test. No new decoder.

`world-partition.js` can stay unchanged for this slice if packages are **filters of existing blocks**. Repartitioning `Earth` by destination AABB is a later slice if bridge/approach jumps fail without far-earth triangles.

### Risks that invalidate the proposal

1. **Nave/undercroft/gallery floors are `Earth` or boxes, not `Vaelmark collision`.** Then a Vaelmark-only package drops the player through the floor. Must be disproved by overlaying destination coordinates on `Vaelmark collision` bounds (metadata probe below; live confirmation is root’s).
2. **`allocateRecord` drawing of a partial `Earth` mesh** if the slice panics and includes Earth blocks “just in case.” Do not install any Earth block until the remainder package is ready to complete that record, or split Earth at bake time.
3. **Calling `retireProxies` / fence dispose on destination-ready** restores today’s all-or-nothing wait or walks the player onto missing mountain collision.
4. **Putting destination geometry in the required near packet** breaks the exact-near / ≤1 s start contract.
5. **Enabling Fly click at destination-ready** because Havok will miss far surfaces.
6. **One stream, early `onNavigationReady`** without changing that callback’s proxy/fence meaning.
7. **Custom Brotli or byte-range decoder** to fake packages inside the 22.4 MB file.
8. **Assuming the 20.3–22.5% stream gain plus a prefix fraction equals a jump-time budget.** Encoded prefix size is not elapsed time; RAF yields, contention, and decode still apply. No number in this review is a prediction.

### Honest unverified areas

- Encoded byte length of a Vaelmark-only package (Brotli of a subset is not a prefix of `region-c892ee93228d.br`). Decoded Vaelmark*+collision+roof+foundation+bell is knowable from the index; encoded size is not, without a bake.
- How many `Bare woodland` blocks sit in packet slots 0–1 vs later 152; decoded prefix through block 47 is not summed in this pass (index probe reserved).
- Whether `cathedral-bridge` waypoints sit on `Vaelmark collision`, `Earth`, or boxes.
- Whether undercroft/gallery/parapet/bell landings are entirely inside `Vaelmark collision` + `Bell towers` render.
- Box AABBs overlapping those destinations (681 boxes, authored in `scene.js` / cathedral builder).
- Whether incomplete GPU records currently draw, clip, or only exist after `indexCount` uploads (Lite storage mesh behavior not executed here).
- Worker-path destination signaling.
- Cache retention of smaller packages (the 22.4 MB miss is documented; smaller files are a hypothesis).
- G06 FPS, physical mobile, production Pages promotion.

---

## Probe status

First-batch findings are above. One allowed metadata probe remains: decompress the existing region index only (not the 22.4 MB body, not a world bake) to sum decoded prefix bytes through `Vaelmark collision` and list meshIds in order. Results will be appended. No tests or `prepare-starter-world` run.
