# Native GPU readbacks — short marked frames before three long gaps

2026-10-08. All twelve preceding outstanding frames for three captured long
render gaps have valid native-timer readings of **0.918–1.442 ms** inside Lite's
markers. Each gap retains **17.1–17.2 ms after acknowledgement**. These samples
do not show a long marked GPU frame explaining those gaps. They do not exclude
outside-marker uploads, queue backlog, presentation, compositor or OS effects.
No shader, geometry, scheduler or runtime change is justified by this result.

The single declared native timer visit is complete; **this arm is closed**.
No higher cap, unchanged repeat or new speculative scheduling trial follows.
Next implement one demonstrated armor-fit correction. Production remains
**7d00c56 / Pages 5723a4ab**, and the rejected preview/reliability and physical
iPhone acceptance exits remain open.

## Native implementation and conditions

Reuse the existing `ASHEN.metrics.setGpuTiming` and pinned Lite
[native timer](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/engine/gpu-timer.ts)
through the game's existing module graph. The private instrumented build keeps
the earlier exact scheduler hooks and changes only the native timer's readback
logging against that baseline. All other **721 of 722 files** are byte-identical.
Product source **afbe0c3**, fingerprint
`11242a3e03fa872af60e887a40cee135673d8b143650ec891bf44ca12f8c6301`
and real four-slot/RAF-only/GPU-completion policy remain unchanged.

The private logger captures the synchronous submission identity in each resolve
closure, then records the BigInt timestamp difference **before the native EMA**.
Native two-query set, marker dispatches, resolve buffer, MAP_READ pool,
`inFlight > 3` skip, extra resolve submission, unmap and retirement are preserved.
Six offline controls compare actual API calls and resulting state against the
stock function: captured identity, fourth readback, skipped fifth, rejected map,
invalid timestamp and inactive logging. Both script/runtime syntax checks pass.

One fresh native uncapped headless Chrome/WebGPU visit, M1 Max, 1280×720/DPR1,
disabled HTTP cache, decimal 50 Mbit/s down/10 up/40 ms and real held W. The
preserved v9 fixture is tall/slender Prime Human with ponytail, Duskguard
cuirass/greaves/vambraces, Graveweaver skirt/staff and Bastion shoulders; helmet
and offhand are empty. It is the same uncovered recipe as the earlier completion
diagnostics, not proof of the current catalogue's maximum payload or all outfits.
One game renderer; reference media paused, no recording/build/CPU sampler/Chrome
tracing/GPU API wrapper or competing timing work.

Native timer enables after the playable fence. At 71 world records and three
>16.67 ms deltas in the latest 24 actual renders, a requested 1,000 ms window
runs **8,664.6–9,668.4 ms**. Region-ready is false and hostiles-ready true at both
boundaries; full readiness follows at 10,924.6 ms. The original trigger deltas
21.8/21.9/21.7 ms are retained separately from the inside-window cases.

## Coverage and captured intervals

All **1,652 requests resolve valid**: zero skips, rejections, invalid timestamps
or pending readbacks. Four map after window end and before the final report.
Every captured identity matches the synchronous render span in which the native
resolve was requested. Stored query values lie on 65,536 ns steps in this capture;
their decimal representation is not sub-microsecond precision.

The window has **184 marker-counted renders / 183 complete interior intervals**.
Counter bounds exclude partly observed intervals. All twelve preceding outstanding
frames and all three release-fence submissions have complete valid raw coverage.
The following frame's GPU duration is explicitly excluded from explaining the
gap before that submission.

| Next submission | Gap ms | Acknowledgement to render ms | Preceding outstanding IDs | Raw GPU range ms | Release-fence ID / GPU ms |
| --- | ---: | ---: | --- | ---: | --- |
| 1623 | 22.0 | 17.2 | 1619–1622 | 0.918–1.049 | 1619 / 1.049 |
| 1633 | 21.6 | 17.1 | 1629–1632 | 1.049–1.442 | 1629 / 1.049 |
| 1646 | 21.6 | 17.2 | 1642–1645 | 0.918–1.245 | 1642 / 1.180 |

Marked GPU intervals for the 184 window frames have median **0.983 ms**, p99
**1.835 ms**, maximum **2.818 ms**. These instrumented intervals include native
marker work and are not inverse-FPS throughput estimates. Raw differences and
unchanged EMA calculations are checked directly from the retained timestamps.
Independent review finds a **14,420.8 ms** first-GPU-begin to last-GPU-end span,
against **8,883.7 ms** between their JavaScript resolve requests. Root verifies
both directly. Neither absolute clock mapping nor rate calibration is established;
do not rescale by an arbitrary span ratio or treat the native `/1e6` readings as
calibrated wall execution cost.

The earlier [Chrome trace](completion-native-trace-2026-10-08.md) measured small
recorded main-thread task time in two other gaps. Its task spans cannot be
transferred to this separate visit's three cases. Together these diagnostics
narrow expensive marked frame execution as a hypothesis; they do not establish
the remaining scheduling cause or clear every streaming p99 interval.

## Functional checks, review and cleanup

Native controller **61942 exits 0**, report passes with zero errors. Actual
locomotion/source clocks, identity/morphs, Havok, zero recoveries, seven enemies,
final 71 world records/210,049,236 bytes and shadow/woodland checks pass. Root
inspects the actual post-timing game still. No visual product change or new
motion acceptance claim. Complete visit intervals are retained as diagnostics,
not new settled FPS/public startup qualification.

The operator Grok CLI reaches its **12-turn cap after writing the completed
native report and result**: actual CLI exit **1**, `stopReason=cancelled`.
This is retained separately from the successful native child; no game rerun or
worker resume is needed. Independent Grok 4.6/high review completes normally
(18 turns / CLI exit 0), re-derives every count, identity, timestamp difference,
EMA and preceding-work set, and finds no consequential logger/queue-order error.
Root accepts its narrow finding and adds the observed clock-span limitation.
Review and parent adjudication are retained in the adjacent evidence.

Preview **61949**, Chrome **61950** and GPU helper **61976** close; ports
7074/10037 are free and all four native controller/owned process IDs are gone.
Root closes the temporary Telegram viewer and verifies both originally playing
inline videos resume. Twelve nongame user Edge tabs and zero embedded Orca tabs
are preserved. No Pages operation, new release cohort or Telegram send.

[Receipt](../../../baselines/character-mmo/completion-gpu-raw-2026-10-08/receipt.json)
and adjacent compressed evidence retain the declaration, all raw timestamps and
actual render/fence intervals, stock/private logging, operators, controls,
independent review, build inventory, actual exits and ownership/cleanup.
