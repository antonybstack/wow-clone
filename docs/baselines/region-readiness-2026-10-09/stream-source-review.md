# Region stream source review (2026-10-09)

Reviewer: Grok 4.6/high. Focused read of `src/ashen-reach/region-stream.js`, `loadRegion` / `finishNavigation` / `loadPreparedRegion` in `src/ashen-reach/starter-world.js`, and `src/ashen-reach/world-worker.js`. No browser, builds, benchmarks, source edits, or timings. Parent owns live controls (9, including both late retry paths), 29 CPU tests, and the 50Mbps pair (stream nav 5.91–6.07s vs worker 7.48–7.63s). Cached/settled FPS pending. Prior review point 3 (`boundary.fail` after reach) and point 4 (Pages `*.br` headers) are closed as not defects.

## Late foliage retry

No remaining fence or geometry reinstall in these functions.

Worker and prepared retries still re-enter `loadRegion` (`starter-world.js` 467–469), but:

- Gates are created only when `!gates && !navigationComplete` (542).
- `finishNavigation` returns immediately when `navigationComplete` (656) and sets that flag only after fence disposal (665–667).
- Prepared geometry stream runs only inside `if (!navigationComplete)` (691–704); a late foliage failure then `await readPacket(index.foliage)` only (707–712), with `preparedRegionIndex` reused (686–690).
- Worker retry posts `foliageOnly: navigationComplete` and scene lights/footprints (615–616). `geometryDone` starts true (583). The drain loop is skipped. `world-worker.js` 27–29 uses empty batches and does not `postMessage` header, batches, or `geometryDone`.

`install()` still no-ops an already-keyed block (206) and skips a live Havok mesh via `installedCollisions` (209, 237). Late foliage does not reach those paths.

## Streaming offsets, EOF, trailing

`readRegionBlocks` requires `Object.entries` order to be packed: each `attribute.offset === expected`, then `expected += length * 4`, covering `packet.rawBytes` exactly (`region-stream.js` 8–22). Yields are per-block `Uint8Array(length)` with `Uint32Array` indices / `Float32Array` other attributes at **block-relative** offsets (40–45), `sharedPacket: true`.

Truncation is `reader.read()` with `done` before a block is filled (33). Trailing bytes in the current chunk (48) or a later non-empty chunk (50–52) throw **before** `finishNavigation` (starter-world 701–703). Incomplete consume cancels the reader (55–59).

Foliage stays a whole `arrayBuffer()` plus `readBlock` (starter-world 672–678, 707–711). That packet is the small optional grass payload, not the region mesh stream.

## Cancellation / disposal

Disposed install throws inside the `for await` (696–697); the generator `finally` cancels unless `complete` (region-stream 55–59). `loadPreparedRegion` aborts `regionAbort` in its `finally` (713) and `dispose` aborts the same controller (738 from the earlier map). Worker `finally` terminates (650–653); the foliage wait wakes and throws on `disposed` (642–649). A new worker is created per `loadRegion`; foliage-only retry does not keep a geometry-generating worker.

## CPU-buffer lifetime

Prepared collision views are `array.slice()` when `sharedPacket` is set (`install` 215–221); worker transfers keep their own buffers. World upload copies into new interleaved/position arrays (241–266) and does not store the yielded views. Each stream block’s backing `bytes` is collectable after that `install()` returns. The previous whole-packet pin through Lite CPU geometry after `disposeMeshGpu` is not present in this path.

`pending` is the current fetch chunk and is not compacted (`region-stream.js` 25, 34). If the UA delivers a large decoded chunk, JS can hold that remainder **during** install only. The generator finishes before foliage and before the navigation callback returns to the rest of `loadPreparedRegion`, so that chunk is not retained for the optional-grass wait.

## Findings

No remaining source blockers in this focused review.

Parent still owns constrained-network cached/settled FPS and any delivery clip. This reviewer did not measure and does not claim those results.
