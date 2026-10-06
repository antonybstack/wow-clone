# One-second saved-outfit startup — 2026-10-06

The focused [startup goal](../startup-goal-2026-10-06.md) passes on production:
largest saved hood/Bastion Human **969.4 ms p95**, **984.2 ms maximum**, zero
one-second misses in the fixed 20-start cohort. This is acceptance under the
recorded conditions, not a universal hardware/network guarantee.

Source **08f9bbe5391fde6b3fd74b4756470e43300bd139** is committed and pushed.
Production Pages **b80c188b-c5a0-422b-9d57-c9201d8a740f**, created 2026-10-06
13:35:50 UTC, serves the exact tested build. Rollback is previous Havok release
**0d577d2**, Pages **f6265788-d4fd-45fe-abae-76f9c3d23247**. No rollback needed.
[Receipt](../../../baselines/character-mmo/startup-catalogue-2026-10-06/receipt.json)
contains all final rows, conditions, prior experiments and artifact hashes.

## Change

Game HTML carries the build-verified Human identity runtime catalogue as inert
`application/json`. It sits after resource-discovery hints and before the early
async module, so cached JavaScript cannot outrun the HTML parser. The existing
loader shares one catalogue promise and retains provenance, schema, selected
preset, shape and coverage checks. Missing blocks use the existing fixed-URL
fetch. Malformed data rejects; no storage-derived URL or hand-written recipe
validator was added. The saved-body request no longer waits for a separate
catalogue response; all 20 public hood starts confirm zero catalogue requests.

Only the authoring source-file audit list (`provenance.inputs`) is omitted from
HTML. The build still verifies it, and the complete audit remains at the standalone
manifest URL. Aggregate SHA, schema and every preset/asset/coverage descriptor stay
exact. Measured gzip HTML is **11,992 bytes**, versus 5,382 before this change;
the first full-catalogue candidate was 14,346 bytes. Default-page overhead is
explicitly included in the controls.

All **281 character, world and physics assets** are byte-identical to the prior
release. Actor installation, Havok support, source animation and first-frame
registration/fences are unchanged. The rejected world-only warmup remains absent.

## Gates and measurements

All **537 served artifacts** match on final preview and production, including
headers/cache policy and decoded Havok. Native entry three, saved-identity eight,
mobile eight, depth-fallback eight and WebKit four pass; 20 focused unit tests pass.
Preview and production cathedral round trips have Havok active, zero recoveries
and no runtime/GPU errors. Physical iPhone acceptance was not repeated.

M1 Max, native 1280×720/DPR 1; fresh Chromium process/profile each cold row, HTTP
cache disabled, decimal 50 Mbit/s down, 10 up and 40 ms latency. OS, GPU-driver and
CDN caches are not reset. Cohorts ran serially without recording, encoding,
uploading, media playback or another active game page:

| Production cohort | p95 | Maximum | One-second misses |
|---|---:|---:|---:|
| Largest hood/Bastion | **969.4 ms** | 984.2 ms | 0/20 |
| Default | 743.1 ms | 833.0 ms | 0/20 |
| Original-largest/Bastion | 851.2 ms | 876.2 ms | 0/20 |

Prior production hood p95 was 1,021.6 ms with two misses. The observed p95 difference
is 52.2 ms; sequential network cohorts do not establish a paired causal estimate.

Three isolated 12-second bridge runs, seven enemies, uncapped native Chromium
WebGPU, measure **242.6 / 242.8 / 246.8 FPS**. Maximum p99 **5.5 ms**, worst interval
**9.9 ms**, none over 16.7 ms. Statistical pacing hints remain in the receipt; native
RAF throughput is separate from physical display refresh. M8's prior five-route
matrix remains the broader world baseline.

## Retained failures and review

The first exploratory full-catalogue preview had p95 1,348.6 ms and maximum
11,068.3 ms. Its first run spent about ten seconds between submitted frame and GPU
completion; the cause is unconfirmed. Another row waited on body transfer. A Grok
4.6/high five-turn read-only review found a real async parser-order race; root fixed
it and added production insertion/order/escaping guards and tests.

The parser-corrected full-catalogue preview had p95 1,084.9 ms, max 1,956.2 ms,
three misses with late body availability. These rows remain in the receipt. The
final payload refinement removes only the verified authoring audit list; the
production cohort was declared before execution and none of its rows were dropped
or replaced. The earlier local full-catalogue cohort (p95 890.2 ms) did not establish
a local CPU startup gain. Initial shared-promise unit failure was fixed by preserving
immediate fallback fetch timing. Review suggestions to silently replace malformed
data or add a default-path DOMContentLoaded wait were not adopted.

## Delivery and next work

Final production native motion is Telegram **865**, with returned **1280×720**
dimensions matching the square-pixel, zero-rotation, 18.448-second source.
[VE video/mp4](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/startup-catalogue-08f9bbe.mp4)
returns `video/mp4` and a valid HTTP 206 range. Reviewed Telegram Web A inline,
expanded and actual VIDEO fullscreen retain proportions. VE-hosted playback and
native VIDEO fullscreen pass through a local HTML wrapper loading the remote MP4;
the direct MP4 document hit the browser tool's paused-response limitation.
Telegram Desktop and physical iPhone were not checked. The video is capture
evidence, not the source of load-time/FPS measurements.

All owned game/preview processes and review tabs are closed. User Edge/Orca
sessions are preserved, media guards removed, and only the originally playing
Shadowglass reference resumed. Cleanup evidence is in the receipt.

M6 boot-sole and mixed-outfit visual evidence is next. Keep its work scoped to the
current approved character direction and existing source assets. The one-second
result is a measured baseline to preserve, including default-page overhead and
frame-time tails. No networking/MMO population or historical world-expansion
milestone is closed by this task.

Local raw evidence, failed cohorts, captured frames, review and ownership logs:
`.cache/character-mmo/startup-catalogue-2026-10-06/`. The tracked receipt preserves
results and hashes if local caches are cleared. The native goal API still owns an
older unfinished blocked broad goal; it rejected a replacement, so only this
focused documented goal is completed. The older objective was not falsely closed.
