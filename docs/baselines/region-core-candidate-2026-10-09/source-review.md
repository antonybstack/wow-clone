# Region-core candidate — live source review

Reviewer: Grok 4.6/high. Source-only. No native run, FPS, bake, or generated-asset acceptance. Plan `docs/plans/gothic-exploration/region-navigation-core-2026-10-09.md` is guidance, not proof. First batched read: `scripts/ashen-reach/prepare-starter-world.mjs`, `src/ashen-reach/region-stream.js`, `src/ashen-reach/starter-world.js`, plus grep hits in `main.js` / `menu.js` / `dev-tools.js`. Unread at this write: `verify-starter-geometry.mjs`, `baked-woodland.js`, `menu.js` body, `dev-tools.js` body, `main.js` jump/gate body, focused tests.

Root implements an optional candidate. Default remains the existing single region stream. No release or performance claim.

## Risk 1 — core packet metadata, physical gates, retry/disposal

### Observed: default packet identity is preserved in the baker

`prepare-starter-world.mjs` still builds `region` from the unchanged `optionalBlocks` list (`72`) and writes `regionPacket` independently (`209`). Core/detail are extra members (`77–79`, `211`). Required `near` / `skyline` / foliage packing is not reordered around the split. Index JSON stays `schema:1` with an added `experimentalCore` object (`215–217`). Manifest `geometry.region` keeps the existing index descriptor and adds `experimentalCore:true` plus `core`/`detail` filenames (`264`).

Default `loadPreparedRegion` still consumes `index.geometry` when `coreLoading` is false (`starter-world.js` `720–721`). A client that ignores `experimentalCore` therefore still sees the single-stream packet.

Byte-for-byte near/region/foliage identity versus a pre-candidate bake is **unchecked** here: this session did not compare encoded files, and `verify-starter-geometry.mjs` is unread.

### Observed defect: runtime partition proof is metadata-only and offset-blind

`validateRegionCore` (`region-stream.js` `103–118`) keys ranges by `meshId:indexOffset` and compares

```
[meshId, indexOffset, vertexOffset, sorted [attributeName, length]]
```

It does not compare attribute **byte offsets**, file/sha/rawBytes, or decoded coverage. That matches the baker’s rebased member offsets (`prepare-starter-world.mjs` `36–52`, `77–79`), but it cannot prove the core/detail packets contain the same typed arrays as `index.geometry`. Plan item 2 assigns that proof to `verify-starter-geometry.mjs`, which is **unread**.

It does classify detail as `Woodland … full` and rejects a colliding or non-world detail mesh (`112`). The baker never calls `validateRegionCore`. A colliding `Woodland * full` mesh would be placed in `detail` (`77–79`) and only fail when a `?dev&regionCore=1` session parses the index (`starter-world.js` `704–706`). Default single-stream path would still install it.

### Observed: navigation opens on core-packet EOF, not per-mesh completion

`loadPreparedRegion` (`720–724`) consumes the whole core (or default region) stream, then `finishNavigation`. `readRegionBlocks` (`region-stream.js` `47–53`) refuses truncation and trailing bytes before that consume returns. `finishNavigation` (`starter-world.js` `668–680`) then installs every remaining `manifest.boxes` entry, disposes the four start-fence colliders/mesh, sets `navigationComplete`, and fires `onNavigationReady`.

Physical walk/jump therefore wait for:

1. core (or default region) packet EOF
2. all  box colliders from the required manifest
3. fence removal

They do **not** wait for `createBlockCompletion.complete` on every physical mesh. A core packet that passes EOF with a hole that still tiles `rawBytes` would open the fence and jumps with incomplete GPU surfaces. Whether the verifier forbids that hole is **unchecked** (`verify-starter-geometry.mjs` unread).

Boxes live on the required manifest, not in the streamed packets. Opening after core therefore installs every box, including trunks whose full-detail mesh is still absent. That matches the plan’s “all physical surfaces plus reduced trees first” **if** no colliding mesh was classified into detail. The collision-in-detail case is the validate-only-at-candidate-runtime gap above.

### Observed: last-block-first proxy retirement is fixed only on the candidate path

Default `install` still treats arrival of the tail index range as record completion (`starter-world.js` `294–298`):

```
if (!completion&&block.indexOffset + b.indices.length === record.indices)
```

`completion` is created only when `coreLoading` (`134`). Candidate installs instead `mark` and retire the proxy only when summed unique ranges equal the record (`301–304`, `region-stream.js` `89–95`). A last block arriving first on `?regionCore=1` cannot retire that record’s proxy. The default stream still can.

`createBlockCompletion` does not pre-register the expected range union (plan item 4). Completeness is “arrived unique index/vertex counts equal the mesh record.” Duplicate same-key ranges are idempotent (`77–80`, `90`). Overlap throws (`82–84`). The intentional skyline/region near-tree duplicate is a cross-packet same key; `install`’s `installedBlocks` set (`209–211`, `300`) keeps a single GPU/Havok owner. `validateRegionCore` would throw if that duplicate appeared twice inside `index.geometry.blocks` (`109`). Baker puts deferred near trees once in `optionalBlocks` (`66–72`) and separately in skyline (`62`), so the same-key rule is cross-packet, not an in-packet duplicate.

### Observed: detail failure retries only unfinished work; core failure keeps the fence

`startRegion` nulls `regionPromise` on any throw (`480–482`). After a successful core consume, `navigationComplete` is already true (`679`). Retry then skips core (`720`) and, while `regionDetailComplete` is false, consumes detail only (`730–733`). Foliage is after that flag (`737–742`), so a foliage throw retries foliage only.

Core throw leaves `navigationComplete` false, so fences stay (`555–593`, `678`). Retry re-fetches the core packet. Already-installed keys return at `install` `211` without a second Havok cook (`214–243` sets `installedCollisions` after the live body). Duplicate completion ranges do not throw (`77–80`).

`loadPreparedRegion`’s `finally` always `abort()`s `regionAbort` (`743`), including after success. A later retry allocates a new controller (`683`).

Disposal sets `disposed`, aborts region/skyline, terminates the authoring worker (`764–770`). Consume checks `disposed` per block (`713`). `readRegionBlocks` cancels an incomplete native reader (`55–59`).

**Unchecked:** whether a GPU upload throw after `installedBlocks.add` (`300`) but during `completion.mark` / `woodland.meshArrived` can leave a marked-complete mesh whose woodland visibility is stale. `mark` is synchronous and `check` already ran at `210`, so a throw there is unlikely unless `meshArrived` throws. `baked-woodland.js` unread.

**Unchecked:** `verify-starter-geometry.mjs` coverage of new members, index version, missing/overlapping ranges, and pruning of `region-core` / `region-detail` files. Baker lists those files on the required region descriptor (`264`) and calls `verifyStarterGeometry` before writing `manifest.json` (`268`).

**Unchecked:** `main.js` jump/`whenNavigation` actually waits for `onNavigationReady` before developer teleport. Grep shows only the `regionCore` query gate at `main.js` `198`.

## Risk 2 — completed-range tracker, reduced/full fallback, pause, 100/140 m

### Observed: tracker exists and is wired only for the candidate

`createBlockCompletion` (`region-stream.js` `68–96`) plus `starter-world.js` `134`, `210`, `301–304`, `394`. Woodland receives `name => completion.complete(recordIds.get(name))` only when `coreLoading` (`389–395`). Default woodland therefore has no completion predicate.

`allocateRecord` still calls `woodland?.meshArrived(record.name)` on first block (`204`), including a first block of an incomplete `Woodland * full` record. If woodland treats `meshArrived` as “this mesh is drawable” without `complete(name)`, last-block-first full detail can become visible with a hole. Whether `baked-woodland.js` consults the predicate before switching ordinary/shadow visibility is **unread** and is the live question for this risk.

`complete(id)` on an unknown name (`recordIds.get` undefined) is false (`95`). A full mesh that has not arrived stays incomplete.

### Unchecked (files unread)

- `baked-woodland.js` hysteresis at 100/140 m (`woodland-tiles.js` grep: `distance<100` full, `>140` reduced, else previous).
- reduced remaining visible while desired full is missing/partial
- ordinary and shadow visibility switching together
- arrival while menu pause skips `world.update`
- diagnostic triangle counts using the drawn representation
- `scripts/test-region-stream.mjs` last-block-first / overlap / duplicate-key cases (`54–62` exist; bodies unread)
- `scripts/test-baked-woodland.mjs` late full/reduced + hysteresis (`6`)

No woodland visibility defect is asserted until that source is read. The tracker itself will not mark complete on last-block-first; the remaining hazard is `meshArrived` at allocation time (`starter-world.js` `204`).

## Risk 3 — UI query, dev gate, reload spawn link

### Observed from grep (bodies unread)

`main.js` `198`: `regionCore: params.has('dev') && params.get('regionCore')==='1'`. Without `?dev`, `regionCore=1` does not enable the candidate.

`dev-tools.js` `153–157`: `regionCoreAvailable` / `regionCoreLoading` from the world; `regionLoadingURL` deletes `regionCore` when already loading, else sets `regionCore=1`.

`menu.js` `200–205`, `340`: Developer-tools button label/disabled state; `location.assign(tools.regionLoadingURL(destinationSelect.value))` only if `regionCoreAvailable`.

`regionCoreAvailable` is `manifest.geometry.region?.experimentalCore===true` (`starter-world.js` `430`). After this baker that flag is always true (`prepare-starter-world.mjs` `264`), so any `?dev` session can offer the reload. A pre-candidate manifest without the flag keeps the button disabled (`menu.js` `204` grep).

**Unchecked until menu/dev-tools/main bodies are read:** whether the toggle is only on the Developer tools panel; whether `regionCore=1` is preserved on destination spawn links; whether any non-dev path, auto-travel, or coordinate clamp was added; default `startRegion` still using the full packet.

## Questions for root (stop after three)

1. Should `validateRegionCore` (or the unread verifier) reject a colliding `Woodland * full` mesh at bake time, rather than only when a candidate session parses the index?
2. Is `woodland.meshArrived` on first-block allocate (`starter-world.js` `204`) required to no-op until `complete(name)`, or does woodland already ignore incomplete full records?
3. Is default last-block-first proxy retirement (`294–298`) accepted as unchanged, with the tracker required only for `coreLoading`?

No native, FPS, or transfer claim. Generated packets currently on disk are stale relative to this source and are not evidence.
