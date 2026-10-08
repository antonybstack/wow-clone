# Native completion trace — two observed delivery gaps

2026-10-08. Two captured ~21 ms render intervals spend most of their gap **after
a slot is acknowledged, with very little recorded main-thread task time**.
This narrows those cases away from a long JavaScript render/world-install task.
It does not establish hardware GPU, compositor or OS cause, or explain all p99
intervals. No runtime change or production promotion; source **5250e7e** and the
current real four-slot policy remain unchanged. The previous
[bounded RAF-poll arm](frame-completion-2026-10-08.md) remains rejected.

## Declared attempts and conditions

| Attempt | Native child exit | Selection | Native window result |
| --- | ---: | --- | --- |
| Initial | 1 | Category inventory before navigation | Empty inventory stops the overly strict gate; no game/trace starts |
| Corrected early | 0 | 1,500 ms after first play; six world records | 266 marker-counted renders, 265 complete intervals; no long interval |
| Late | 0 | 71 world records, then 500 ms | 169 marker-counted renders, 168 complete intervals; no inside long, six afterward |
| Final triggered | 0 | 71 records plus three >16.67 ms intervals in latest 24 renders | 173 marker-counted renders, 172 complete intervals; two long intervals |

The initial inventory result does not establish missing trace capability. The
corrected operator requests the same pinned categories directly and validates
the emitted events. Chromium's [built-in category registry](https://chromium.googlesource.com/chromium/src/+/main/base/trace_event/builtin_categories.h)
and the existing successful project operators support that request. All failed
and clean attempts remain retained; no release cohort is repeated or cleared.

All three actual game visits use M1 Max, fresh native uncapped Chrome/WebGPU,
1280×720/DPR1, disabled HTTP cache, decimal 50 Mbit/s down/10 up/40 ms, the same
maximum uncovered Human outfit and held W. Private scheduler hooks record exact
epochs without changing policy. One game renderer; reference media paused;
no recording, CPU sampler, GPU API wrappers, builds or competing timing work.
Each native trace requests 1,000 ms and a 64 MB buffer. All emitted traces report
**dataLossOccurred=false**, with native task/RAF/compositor/GPU-service events.
Actual compressed sizes are 4,039,750 / 3,177,571 / 3,625,919 bytes.
Tracing and diagnostic hooks can perturb timing; none is performance acceptance.

## Captured gaps and independent correction

Final trigger: three actual deltas **21.6 / 21.5 / 21.1 ms** at 8,479.5–8,566.7 ms.
Native window **8,583.3–9,586.5 ms**; region-ready false and hostiles-ready true at
both markers. Native/JS clock offsets match exactly at **359915420987 µs**.
Counter bounds exclude partly observed intervals and rounded epoch ties.

| Submission | Render interval ms | Saturation to release ms | Release to render ms | Recorded main-thread task ms | Share of post-release gap |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1608 | 21.3 | 3.2 | 14.8 | 0.189 | 1.28% |
| 1625 | 21.5 | 2.3 | 16.1 | 0.226 | 1.40% |

Native compositor BeginFrame spacing is **16.914 / 17.319 ms**, with declared
16,666 µs intervals. The earlier tick precedes acknowledgement in each case;
the next tick follows it. This correlation alone does not establish cause.
Native `WebGPU`/`GPUTask` durations describe CPU service work in the GPU process,
not hardware execution. Main-thread unioned spans likewise do not measure OS
scheduling or unrecorded work.

An independent Grok 4.6/high review re-derives the clocks, counter bounds and task
unions from native gzip. It confirms those narrow observations and identifies
one real analysis error: choosing the shortest RAF span within ±0.2 ms admits
adjacent callbacks (15 ambiguous matches in 172 intervals). Root corrects the
matcher to require a unique callback enclosing **both scheduler entry and render
return**. All 172 complete intervals then match uniquely; native callback durations
for the two cases are 3.749 / 3.652 ms. Task-union/gap statistics are unchanged.
Earlier analyses are retained, including the rejected 0.089 ms match for 1625.

The early and late windows cannot prove a tracing-caused improvement. Their clean
windows differ in stage and no randomized tracing on/off comparison exists. The
triggered traced window still has two long intervals. Do not use its complete
window throughput as a new settled FPS or startup result.

All three game visits preserve identity/morphs/source clips, actual locomotion,
Havok, zero errors/recoveries, seven enemies, final 71 world records/210,049,236
bytes, and checked shadow/woodland membership. Root reviews the actual final
post-timing game still. No visual product change or new motion acceptance claim.

## Next bounded diagnostic

Stop this native tracing approach; no further same-policy trace, queue-eight,
RAF-poll or immediate-completion bypass. Use the existing public
`ASHEN.metrics.setGpuTiming` and pinned Lite [native frame timer](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/engine/gpu-timer.ts)
for one private raw timestamp-query diagnostic:

1. Keep the exact accepted product and scheduler inputs. Adapt only the private
   native timer's readback instrumentation; record the timestamp difference before
   its EMA with a submission identity captured when that resolve is requested.
2. Preserve native marker passes, two-query set, resolve buffer, MAP_READ pool,
   in-flight limit, extra resolve submission, unmap and retirement. Count skipped,
   rejected, late and missing readbacks. Add no production debug API or GPU API
   wrapper; confirm support through the existing metrics interface.
3. Capture a bounded world-71/observed-tail window without Chrome tracing. Keep
   exact render/submission/fence identities and native raw timestamps. A gap
   **precedes the next submission**: inspect the preceding fenced/outstanding
   work, rather than attributing it to the next frame's later GPU duration.
4. Stop after that visit. Missing coverage or disappearance of the tail makes
   attribution inconclusive; do not raise the native in-flight limit merely to
   obtain samples. Short frame-pass durations cannot exclude unmeasured uploads,
   queue backlog, presentation or clock-domain effects. A long GPU frame can
   implicate execution but does not by itself prove the full scheduling cause.
5. Implement only a demonstrated bottleneck, with a separate declared unprofiled
   comparison, startup/input/resource checks and reviewed motion for delivery.

This qualifies the independent review's useful timing recommendation; its
suggestion to infer cause from the following frame's duration, or repeat with a
higher private in-flight cap, is not accepted as a causal/acceptance rule.

## Device, cleanup and release hold

Successful **2026-10-08** `xcrun xctrace list devices` inventory again lists one
Mac, eleven simulators and no physical iPhone. No pairing/settings/permissions
change. The current physical acceptance exit remains open, independently of the
historical user report. Identifiers are omitted from tracked device evidence.

Four owned preview/Chrome/GPU-helper groups close, including the pre-navigation
failure. Ports 7074/10037 are free. Root closes its temporary Telegram viewer and
restores both previously playing inline videos; twelve nongame user Edge tabs
and Orca remain intact. All six Grok CLI tasks end normally; native child exits
remain distinct from CLI status. Production stays **7d00c56 / Pages 5723a4ab**.
The rejected preview, original fetch failures/input outlier and sound hitch remain
open. No new sealed qualification, Pages operation or public startup/FPS claim.

[Receipt](../../../baselines/character-mmo/completion-native-trace-2026-10-08/receipt.json)
and its adjacent compressed evidence retain all native events, intervals,
operators, original/corrected analyses, independent review, declarations and
ownership. Detailed old CURRENT chronology is preserved in the
[archive](../../../archive/current-before-native-completion-2026-10-08.md).
