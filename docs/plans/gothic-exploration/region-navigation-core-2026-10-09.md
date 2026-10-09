# Reduce the region wait without opening unsafe surfaces

**Experimental implementation complete locally after offline analysis at source9237092.
No new load-time/FPS qualification.** The existing whole-region stream remains
default; ?dev → Developer tools exposes the candidate reload toggle. Independent
source work may continue under the user's parallel-work authorization; G06's
outstanding isolated FPS gate still holds acceptance/release. The latest user asks why region collision
waits; the active Gothic direction and one-second playable-start contract remain.

## Findings and decision

The current region loader transfers one **22,401,010-byte HTTP-Brotli packet**,
consumes **158,144,000 decoded bytes in1,037 blocks**, uploads visible meshes and
installs collision, then installs the remaining entries from **681 boxes**. Only
then does it remove the starting fence, retire skyline proxies, register shadows
and allow every developer jump/click teleport. Foliage, enhancements and NPCs are
already outside this navigation gate. Streaming improved three local50Mbit/s
pairs to5.91–6.07s from7.48–7.63s; those are earlier declared local measurements,
not a current production or universal cold-start result.

Source/packet inspection reveals a smaller first experiment than destination
streaming: finish **all physical/visible terrain, roads, architecture, churchyard
bark, boxes and reduced woodland** before **full woodland detail**. Preserve every
final triangle and typed-array attribute. Do not open safe navigation merely
because a cathedral prefix has arrived.

Offline exact-block separation and Brotli quality11, matching the bake:

| Candidate member | Blocks | Decoded bytes | Encoded bytes |
| --- | ---: | ---: | ---: |
| Whole physical/visible core plus reduced trees |842|107,836,840|14,389,733|
| Full woodland detail |195|50,307,160|10,640,787|
| Combined split |1,037|158,144,000|25,030,520|

The core candidate is35.8% smaller encoded and31.8% smaller decoded than the
current single packet, but splitting loses compression reuse: **total transfer
increases2,629,510 bytes/11.7%**. Its ideal50Mbit/s transfer alone is2.30s versus
3.58s for today's packet, before latency, decode, uploads and Havok. These are
byte arithmetic and offline compression results, **not a measured speedup**.
Full-region one-second navigation is not plausible with that core at this network
rate. The user's ≤1s goal remains the playable starting area.

Do not accept the extra total transfer without a useful measured navigation gain.
If the candidate does not improve median safe-navigation time by at least20% in
the declared paired experiment, retain the existing loader and record the failure.
That20% is an experiment acceptance target, not a predicted result. Destination
packages remain a separate, more complex follow-on if needed.

## Reuse and change points

1. **`prepare-starter-world.mjs`:** after existing `partitionWorld`, split its
   unchanged optional block arrays into core/full-detail members. Use the current
   `packet()`/`writePacket()` packing and native HTTP-Brotli file/cache family.
   Keep `meshId`, `vertexOffset`, `indexOffset`, final record counts and required
   near arrays unchanged. Rebase only each member's attribute byte offsets.
   Required near packet and foliage must remain byte-for-byte exact. Include the
   two exact deferred near-tree blocks in core, preserving the skyline race.
2. **Index/version/verifier:** introduce an explicit schema1 experimental package list within the
   existing schema1 index. Continue reading the existing version1 single packet. Preserve
   the required manifest's small optional index descriptor; do not copy thousands
   of block descriptors into it. `verify-starter-geometry.mjs` checks every file,
   compression descriptor, hash, decoded ranges and aggregate GPU index/vertex
   coverage. Reject missing/overlapping blocks; retain the intentional duplicated
   near-tree blocks only under their existing same-key rule. Include every new
   member in the existing descriptor file list/pruning/served verification.
3. **`starter-world.js`:** consume core first through the existing
   `readRegionBlocks`, `install`, one-ms yielding and native Havok ownership.
   Complete its EOF/trailing-data checks and every final box before the existing
   `finishNavigation`. Only after core finishes may fences open and global
   navigation be announced. Consume detail next, then existing foliage. All
   asynchronous mutations still belong to this scene/loader; no second controller.
4. **Completion accounting:** currently `install` treats arrival of the last
   index range as record completion. For the candidate, make completion depend on exact unique index/vertex coverage,
   including initial ranges and skyline/region near-tree races.
   A last block arriving first must not retire a proxy or mark a mesh complete.
   Validate the partition once and prove its aggregate coverage at bake time, keep duplicate-key idempotence, and
   expose a cheap per-record completion query to existing woodland selection.
   Do not introduce per-frame geometry rebuilding or scans of all block arrays.
5. **`baked-woodland.js`:** retain requested detail at100m/140m with the current
   hysteresis. Separately choose the completed available representation. A near
   tile must render its completed reduced mesh while its desired full mesh is
   missing/partial. Switch both ordinary and shadow visibility together only
   after full completion, using existing Lite visibility/transform invalidation.
   Arrival must work while the menu pauses updates. Keep distant trees/shadow
   casters visible; never remove a trunk's visible representation while its
   Havok collider is active. Update diagnostic triangle counts to the actually
   drawn representation; desired/effective detail must be distinguishable.
6. **Failure/retry/disposal:** core failure retains the fence and closed jumps.
   Detail failure after core must retain safe navigation and completed reduced
   trees; retry only unfinished detail/foliage. Do not recook installed bodies,
   reupload completed blocks, allocate a record twice, or resurrect a disposed
   scene. The compatibility authoring worker keeps its existing full-geometry
   readiness behavior unless explicitly extended and qualified separately.
7. **Public APIs/UI:** reuse the existing `navigationReady`/`whenNavigation` and
   `regionReady` states. This candidate still opens the whole region at once.
   Existing ?dev destination jumps, shareable links and surface click picking
   remain the reproducible controls; expose the experimental mode through a
   Developer tools reload toggle and preserve `regionCore=1` in spawn links.
   Ignore that mode without ?dev. Accurately distinguish safe routes from
   optional detail loading. No hidden shortcut, auto-travel or coordinate clamp.

## Why the simpler cathedral-prefix proposal is insufficient

The independent source review correctly identifies the global final-box/fence/
proxy dependency. Its proposed Vaelmark-only destination boundary is **not yet
safe to implement**: cathedral floors, bridge approaches and surrounding terrain
need an explicit coverage proof, and the starting-area fence cannot contain a
player who has jumped to a remote cathedral. Slow or failed remainder transfer
could let that player walk onto missing surfaces. Any later destination-first
slice must qualify a safe enclosure and its ordinary exits, matching terrain,
visible geometry, box collision and temporary physical barriers. Merely leaving
`navigationReady=false` for other controls does not protect normal WASD movement.
Do not infer geometry coverage from mesh names or bounding boxes alone.

## Focused verification and acceptance

- CPU/packet tests: exact near/foliage bytes; every final block/attribute unchanged;
  per-member ranges and aggregate coverage; wrong index version/schema, missing,
  duplicate/overlapping ranges, truncated/trailing data; last-block-first and
  near-tree races; retry/disposal without duplicate GPU/physics ownership.
- Woodland controller checks: missing/partial full while reduced complete,
  requested/effective detail, menu-paused arrival,100/140m hysteresis, both shadow
  and ordinary visibility, completion/disposal and bounded transition behavior.
- Native functional checks before timing: hold/miss full-detail requests while
  core finishes; ordinary movement and all developer landings/surface picking
  remain physically safe with visible trunks. Core failure keeps jumps closed;
  detail failure preserves routes. Exercise actual retry and scene disposal.
- Baseline/variant: one owned renderer, same M1 Max/uncapped WebGPU/1280×720/DPR1,
  same seven enemies/assets/cache and50Mbit/s network profile, three independent
  cold local pairs. Record first play, index/first-block/core navigation/detail
  timings, encoded transfer and worst install/frame tails. Run no encoding,
  build, compression or review concurrently. Preserve existing ≤1s first-play
  measurement conditions; a local localhost start alone is not public cold proof.
- Review a real MP4 of moving while reduced trees arrive, walking around trunk
  colliders, full-detail arrival and100/140m transitions/shadows; correct specific
  visible faults. Starting meadow/cathedral/Eastwatch/forest views matter.
- Separate settled performance: existing five routes, three12s runs each, all
  raw intervals and pacing flags, >120FPS floor/144FPS target. Isolate unrelated
  renderers before claiming results. G06's deferred gate is not waived.
- Accept only if safety/visual/error/performance gates pass and the declared
  paired median navigation gain reaches20%. Otherwise keep the existing default,
  preserve the candidate evidence, and avoid unchanged reruns or speculative
  retry tricks. Commit/push, sealed desktop preview, served/native verification,
  root-reviewed VE/Telegram MP4 and ownership cleanup remain required. Production
  promotion has its independent recorded qualification; mobile stays backlogged.

## Documentation references and evidence

Existing native APIs provide the pieces; no new engine, Brotli decoder, pathfinder
or hashing dependency is proposed:

- [Response.body](https://developer.mozilla.org/en-US/docs/Web/API/Response/body)
  exposes the native readable response stream used by `readRegionBlocks`.
- [RequestInit priority and cancellation](https://developer.mozilla.org/en-US/docs/Web/API/RequestInit)
  describe scheduling hints and AbortSignal; a priority hint alone does not remove
  bytes or establish destination readiness.
- [Pinned Lite mesh generators](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/docs/lite/architecture/10-mesh-generators.md)
  and the existing storage-buffer creation/update/scene ownership paths remain.
- [Native digest](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest)
  needs its entire input; do not add a whole107MB allocation just to claim streamed
  hashing. Encoded packet hashes differ from native HTTP-decoded bytes. Preserve
  existing bake/served hash checks and runtime range/EOF validation; any later
  decoded digest requires an explicit bounded-packet design and cost measurement.
- [Byte distribution, reproducible offline estimate and independent review](../../baselines/region-navigation-analysis-2026-10-09/).
  Grok4.6/high reached its ten-turn cap with an actionable source-only artifact;
  its reserved metadata probe was unfinished. Root accepted source dependencies
  and rejected unsafe early-exit assumptions. No source review is live acceptance.

[Experimental implementation and actual functional evidence](../../baselines/region-core-candidate-2026-10-09/README.md).
