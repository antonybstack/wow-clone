# Region navigation readiness — local implementation evidence

The old Developer tools label covered the whole region, including grass, texture
upgrades and NPCs. The separately recorded [diagnosis](../../plans/gothic-exploration/region-readiness-2026-10-08.md)
observed 18.3 seconds elapsed but only 0.55 seconds in synchronous static collider
calls. That observation is not a controlled comparison with this implementation.

## Implemented contract

`ASHEN.navigationReady` / `whenNavigation` opens only after every structural/render
block and mesh/box collider is installed, the temporary physical fence is removed,
and native shadow registration/proxy retirement completes. Developer Jump, Fly
surface click and `?dev&at=…` use this boundary. `ready`, `regionReady`, `whenRegion`,
first play and combat keep their existing meanings. Tools attach after first play,
so optional combat imports do not gate the menu. The UI distinguishes solid routes
from optional details. Ordinary movement still belongs to the existing Havok player.

The compatibility worker sends geometry completion before preparing full grass.
A late grass failure retries grass only, preserving collision and open routes.
The prepared path uses the existing deterministic authoring, partitioner, attributes,
storage uploads and Havok installation. Native HTTP Brotli decoding feeds native
`ReadableStream` blocks while download and bounded installation overlap. It retains
no complete 158 MB geometry ArrayBuffer. Collider CPU arrays own their exact ranges;
all measured variants retain the same 31,414,648 bytes in collider CPU backing arrays
(largest 641,752 bytes), rather than pinning an entire region download.

Required near packet is byte-identical: `near-ccb9dc565ff6.br`, 149,963 encoded
bytes. Optional skyline is also unchanged: `skyline-13acff0beec6.br`, 593,696 bytes.
Added optional geometry: 22,399,654 encoded / 158,354,856 decoded bytes; index:
80,523 / 1,124,682 bytes; foliage: 4,410,809 / 9,379,360 bytes. Only small index and
dependency metadata enters the required manifest. All region requests start after play.
The index keeps the 1,034 block descriptors outside the required manifest. All exact
storage ranges, bounds, normals, local indices and duplicated near-tree ranges are
validated by preparation; native runtime rejects inconsistent headers and bad stream
ranges/lengths. Pages' existing starter `*.br` policy covers all three asset families.

## Bounded equivalent comparisons

Both servers deliver the same frozen built app and near assets. The worker server
removes only the optional region descriptor from its natively compressed manifest.
One fresh context/game at a time, M1 Max, uncapped Chromium WebGPU, 1280×720/DPR1,
seven enemies, normal meadow simulation, no recording or timestamp queries.

| Path | Fresh HTTP-cache-disabled navigation | Complete region | First play |
| --- | --- | --- | --- |
| Compatible worker | 7,476.7–7,626.4 ms | 9,677.9–9,816.7 ms | 340.5–358.9 ms |
| Native prepared stream | 5,909.5–6,067.7 ms | 8,114.2–8,263.7 ms | 340.0–344.4 ms |

Three alternating pairs, decimal 50 Mbit/s down / 10 up / 40 ms via native CDP
network emulation. Paired navigation gains are 20.3–22.5%. Browser/profile/OS/GPU
caches are uncontrolled; these are bounded local comparisons, not release cohorts,
CDN timings or fully fresh process/profile cold starts. Streaming RAF p99 is
17.6 ms versus worker 17.7 ms; worst 17.8 ms for both, so no material cold-stream
frame-tail improvement is claimed. All rows preserve grounded Havok and zero errors
or recovery teleports. [Every fresh sample and interval](fresh-comparison.json).

The first prepared prototype used whole-response `arrayBuffer()` and concurrent
grass download. It regressed all three fresh pairs: navigation 8,812.1–8,901.5 ms
versus worker 7,481.1–7,561.5 ms. That prototype is rejected. The final stream overlaps
network and installation and waits to fetch optional grass until routes are safe.
[Rejected measurements retained](rejected-buffered-comparison.json).

Three additional pairs first seed each context's native cache with a full visit,
close that page, then measure a fresh page without throttling. Worker navigation:
7,115.0–7,187.0 ms; stream: 3,936.8–4,135.6 ms. Native resource timing confirms index
and grass cache hits, **but the 22.4 MB geometry packet is fetched again in every
stream row**. These are seeded-cache/unthrottled observations, not a fully cached
geometry benchmark. Stream p99:17.2–17.4 ms; worst:17.7–35.2 ms (one 35.2 and one
24.4 ms interval retained). Worker p99:17.8 ms; worst:17.8–17.9 ms. No smoother-tail
claim. [Every seeded-cache sample](seeded-cache-comparison.json).

## Controls and review

Nine actual native controls pass: early tools before held combat, disabled early
Jump, both worker/packet navigation before deliberately held foliage/enhancement,
nave jump/walk and surface click, undercroft spawn link, both header failures,
both late grass failure/retry paths, disposal with geometry held, and the full-world
diagnostic. Grouped control count is nine; individual assertions are not separate
traversal claims. No runtime/GPU errors in successful cases or recoveries; deliberate
HTTP503/header/worker failures are retained as expected evidence.
[Control receipt](local-controls.json), [pending-details UI](routes-ready-details-pending.jpg).

29 focused CPU checks pass across startup assets, prepared packet validation, streamed
body boundaries/cancellation/errors, native surface selection and matching route
collision. The independent initial source review found the late grass retry and
whole-packet retention issues, now corrected. It also raised two unconfirmed concerns:
boundary failures after resolution are no-ops and existing Pages wildcard headers
already cover the added files. [Initial review](initial-source-review.md).
[The focused follow-up source review](stream-source-review.md) has no remaining blockers; it is source review,
not independent live/performance acceptance.

## Remaining limitations / delivery gates

The large optional download can lose to worker generation on slower links. Current
acceptance targets the declared 50 Mbit/s desktop conditions; it establishes no
universal network benefit. Native cache did not retain the large geometry response
in these seeded visits. Splitting immutable geometry into bounded cacheable packets
is a follow-up candidate requiring its own size/latency/frame-tail comparison.
Do not introduce a network guess or custom cache merely to hide that limitation.
First playable remains independently useful while the region loads.

Fifteen separate settled windows (five routes, three 12-second runs each) observe
194.1–232.1 FPS, p99≤6.4 ms, no pacing flags or runtime/GPU errors/recoveries. These
are uncapped M1 Max/1280×720/DPR1/seven-enemy measurements without recording or GPU
timestamp queries. They are not a controlled old/new settled-FPS pair.
**One first-meadow interval is 219.9 ms**; the other fourteen windows have worst
frames≤9.8 ms. This remains a serious unexplained tail and is not filtered away.
[All settled windows](settled-fps.json). Two bounded CPU/GC diagnostic visits
(prepared and worker) then fail to reproduce it: worst gameplay frames8.9/9.4 ms,
no observed native long tasks. No cause is established, and profiling visits do not
replace unprofiled acceptance. [Diagnostic receipt](spike-trace-report.json).
No repeated unchanged diagnostic campaign or speculative scheduler change follows.

The reported FPS/control evidence predates only the final loading-status copy
correction and native stream error-attribution wrapper. Geometry/install budgets,
world/shadow/character/render paths and prepared assets are unchanged. Final built
native controls and reviewed motion are being recorded before sealing.
The final built app passes all18 actual developer destination placements/controls,
spawn links, input/focus and elevated Fly-off ([receipt](built-destinations.json)).
A separate compiled native visit deliberately withholds grass/texture details:
Jump remains disabled before navigation, then enables, reaches the nave, walks and
clicks its physical floor while full readiness remains false. The final banner
reads “Adding region details…” ([receipt](built-held-details.json)). These are
native controls, not a new FPS measurement. The held-detail motion recording is
1280×720, square pixels,7.878705 seconds,H.264,rotation0. Capture source dimensions
and timestamps match the encoded file ([manifest](capture-manifest.json)). Root
reviewed sampled source frames and replayed the actual MP4 in the owned Edge tab
1147996123; it is closed. Actual Telegram application fullscreen is unverified.
Sealed preview, VE and Telegram delivery/public checks are being recorded next.
Production remains under the existing independent startup hold; no production
promotion or new physical iPhone acceptance is claimed.
