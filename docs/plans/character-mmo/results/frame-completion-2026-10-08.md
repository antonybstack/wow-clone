# Frame-completion diagnosis and bounded RAF trial

2026-10-08. **Reject the RAF-poll change; runtime and production stay unchanged.**
This closes one targeted scheduling hypothesis. It does not resolve the streaming
tail, first-sound constructor hitch, rejected preview or physical-device exit.
Source is **ca60242**; product fingerprint
`11242a3e03fa872af60e887a40cee135673d8b143650ec891bf44ca12f8c6301`.
Parent implements/accepts; Grok 4.6/high independently reviews the source and
runs the prepared operators. All three workers finish normally; actual native
children exit 0. No source changes, build, Pages operation or new motion delivery.

## Reuse and diagnosis

The pinned Lite [engine contract](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/engine/engine.ts)
describes `waitForGpuIdle` as a lifecycle synchronization boundary. Native
`startEngine` maintains a RAF chain without Ashen's acknowledgement bound. Using
it directly would remove that bound. Independent review rejects the prepared
immediate-resolve bypass: it changes both scheduling and in-flight work. That
prepared bypass **never runs**.

One private copy instead injects exact scheduler epochs, preserving maxPending 4,
real `waitForGpuIdle`, lifecycle and RAF-only rendering. Its 1,781 actual render
entries match 1,781 scheduler RAF callbacks. Streaming p99 is 21.5 ms, worst
36.5 ms. All **136 intervals above 16.67 ms** and all **18 p99-tail intervals**
follow saturation. Synchronous render p99 is 5.8 ms, maximum 7.8 ms.

For those long intervals, median time from saturation to a freed slot is **1.5 ms**;
median acknowledgement-to-next-render time is **16.4 ms**. Only three long
intervals spend most of their gap waiting for a slot. These are exact observed
epochs; they do not attribute GPU execution, compositor delay or OS task delivery.
The injected timing/array overhead makes this a diagnostic, not performance
acceptance. Interior statistics omit the first premeasurement remainder and keep
the same p99/worst.

## Controlled code arm

The observed post-acknowledgement gap motivates maintaining **one pending RAF**
at saturation. `renderNow` still refuses submissions at pending 4; completions
never render. Fourteen existing lifecycle/failure tests, adapted to polling,
plus one repeated-saturation refusal control pass (**15/15**). Both private
builds have 722 identical paths; only the declared boot JS differs, by two bytes.
No trace hooks remain in either comparison arm. Diagnostic copies under old
hashed filenames are never publication inputs. An unavailable `esbuild` import
is retained as a preparation failure; the candidate then uses a pinned unique
minified control-flow replacement without installing a dependency.

Three declared alternating pairs: **gated,poll / poll,gated / gated,poll**.
M1 Max, fresh native uncapped Chrome/WebGPU process/profile, 1280×720/DPR1,
disabled HTTP cache, decimal 50 Mbit/s down/10 up/40 ms. Same saved maximum Human
outfit, held W from first play through full region/enemy readiness. One game
renderer; reference media paused; no recording, profiling, builds or competing
timing workload. Sparse 100 ms state samples and allocation-change checks are
identical across arms.

| Pair | Arm | p95 ms | p99 ms | Worst ms | Mean FPS | Input upper bound ms | Heap peak MB |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | Gated | 20.4 | 21.6 | 37.0 | 175.8 | 3.0 | 186.8 |
| 1 | Poll | 20.3 | 21.5 | 36.8 | 178.2 | 4.3 | 189.0 |
| 2 | Gated | 20.3 | 21.7 | 35.9 | 175.9 | 4.0 | 175.0 |
| 2 | Poll | 20.4 | 21.4 | 24.8 | 177.7 | 3.5 | 183.2 |
| 3 | Gated | 20.1 | 21.5 | 36.2 | 177.9 | 4.1 | 182.4 |
| 3 | Poll | 20.5 | 21.7 | 36.1 | 175.5 | 4.0 | 195.5 |

Declared integration gate requires >10% p99 improvement in every pair, lower
worst tails, bounded input change, heap peak increase ≤20% and exact functional
resources. P99 changes **+0.46%, +1.38%, −0.93%**: all three fail the material
gain gate. Other declared gates pass. Five of six visits retain an interval
above 33.33 ms. Do not convert the single lower worst interval into a stable fix.
Approximate JavaScript heap samples do not measure GPU queue depth or memory.

All six visits preserve selected identity/morphs/native clips, actual locomotion,
Havok, zero recoveries/errors, seven enemies, 71 world records/210,049,236 bytes,
152 meshes/71 casters, and checked woodland/shadow membership. Root inspects
actual post-timing baseline/candidate screenshots. They are review aids, not a
new visual acceptance cycle or representative settled route FPS. No new public
startup or release qualification is claimed.

## Next productive work and cleanup

Keep source maxPending 4 and its existing RAF policy. Do not repeat this unchanged
trial, queue-eight or the immediate-resolve bypass. The new evidence narrows the
investigation to observed acknowledgement-to-RAF delivery, but simple RAF polling
does not fix it. Before another runtime change, capture a **bounded native Chrome
trace** correlating RAF, main-thread tasks, presentation and GPU events during the
same streaming epoch. Reuse existing native tools. Native Lite GPU timing is an
EMA with delayed readback and an extra submission; its HUD value alone cannot
attribute an individual tail. If the native trace lacks the required events,
record that limit instead of inferring GPU/compositor cause. Compare a demonstrated
fix in separate unprofiled windows; preserve the dressed/grounded/completed-frame
first-play fence and existing resource/input checks.

The startup failure still requires a material request/body lead, then a new
sealed release qualification. Accepted boots/audio/shield remain a local release
batch. Physical iPhone acceptance awaits a current device; independent confirmed
armor seam work may proceed. Production remains **7d00c56 / Pages 5723a4ab**.

All seven owned Chrome/context/GPU-helper instances and preview servers close;
7074/10037 are free. Twelve nongame user Edge tabs and Orca remain intact. The
three Telegram videos stay paused throughout timing; root closes its temporary
viewer and restores both previously playing inline videos afterwards.

[Receipt and declared gates](../../../baselines/character-mmo/frame-completion-2026-10-08/receipt.json)
and [compressed raw evidence](../../../baselines/character-mmo/frame-completion-2026-10-08/evidence.json.gz)
retain every native interval, exact epoch, controls, independent review,
operators, source variant, byte inventory and ownership. Ignored working files:
`.cache/character-mmo/frame-completion-review-2026-10-08/` and
`.cache/character-mmo/raf-poll-comparison-2026-10-08/`.
