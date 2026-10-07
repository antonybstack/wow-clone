# Queue-budget comparison and complete release failure reports

2026-10-07. Production remains qualified **7d00c56 / Pages 5723a4ab**.
The local queue trial is rejected under its declared streaming-p99 gate. Release
QA now retains request/body failures and continues to a complete artifact report.
No runtime rebuild, new deployment, quality change or settled-FPS claim.

## Controlled native queue comparison

All 551 files match the accepted release seal before the experiment. Two isolated
local copies differ at one byte in `assets/v2/ashen-boot-CRAdTtnV.js`:
`maxPending:4` becomes `maxPending:8`. The actual native scheduler reports and
asserts the intended budget before/after every visit. These diagnostic bytes are
never published under the original hashed filename. Source remains four.

Three alternating fresh-process pairs run in order **4,8 / 8,4 / 4,8**. Conditions:
Apple M1 Max, native uncapped Chrome WebGPU, 1280×720/DPR1, disabled HTTP cache,
decimal 50 Mbit/s down/10 up/40 ms. One rendering game; reference media paused;
no CPU sampling, GPU API wrappers, capture, builds or other timing workload.
Identical sparse 100 ms state observations and checks at world-allocation changes
run in both variants. Normal held W movement runs from first play until full
region/enemy readiness. These approximately ten-second streaming observations
are separate from production's qualified fifteen settled route windows.

| Pair | Budget | p95 ms | p99 ms | Worst ms | Mean uncapped FPS | First displacement upper bound ms | Sampled JS heap peak MB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 4 | 20.5 | 21.5 | 53.5 | 174.2 | 3.3 | 189.6 |
| 1 | 8 | 7.9 | 21.1 | 34.3 | 215.7 | 2.8 | 300.1 |
| 2 | 4 | 20.5 | 21.7 | 37.8 | 175.1 | 3.1 | 194.2 |
| 2 | 8 | 7.9 | 20.9 | 35.3 | 216.4 | 2.9 | 302.0 |
| 3 | 4 | 20.4 | 21.5 | 37.3 | 176.2 | 3.0 | 181.3 |
| 3 | 8 | 8.2 | 21.0 | 36.0 | 214.6 | 2.6 | 260.0 |

**Reject integration under the declared gate:** require more than 10% streaming
p99 reduction in every pair, lower worst tails and no worse input/resources/
correctness. P99 improves only **1.86 / 3.69 / 2.33%**. This is not a delivered
fix for the approximately 21 ms tail. P95, mean throughput and the frequency of
long intervals do improve consistently; do not describe the trial as having no
material benefit. Every visit still contains an interval above 33.33 ms. The
first four-slot 53.5 ms singleton is not a stable signature of that budget.

Sampled transient `performance.memory` heap peaks are higher with eight; final
samples converge to approximately 135–152 MB. World storage stays exactly
210,049,236 bytes. These are approximate JavaScript heap observations, not GPU
queue memory or proof that pending command buffers cause the difference. The
p99 miss alone is sufficient to reject under this experiment's declared rule.

All six native visits pass: exact saved equipment/dyes, native selected facial/
ponytail meshes and Human morph weights, height scale, 65 bones and playable clip
interface; observed Sprint clock and movement; seven enemies; Havok active;
zero recoveries/errors; final 71 world records/155 scene meshes/71 shadow casters;
no missing shadow or wrong woodland-detail membership at observed allocations.
Root reviews actual post-timing four/eight game captures. These stills do not
prove a new complete motion/fit cycle, and their rolling HUD is not the recorded
window statistic. No visual product change or new Telegram delivery is claimed.

Measurement epochs and every native interval are retained in the
[receipt](../../../baselines/character-mmo/queue-comparison-2026-10-07/receipt.json).
The first interval can include a premeasurement remainder; end readiness is
observed at one RAF resolution. Input is the first RAF observation of movement
over 0.001 m after the real keydown, not physical/display input latency. Sparse
pending snapshots cannot attribute GPU execution or compositor cause. The
original preview's 14/60 fetch failures and 362 ms input upper bound remain open.

## Implemented release QA

`verify-pages-release.mjs` catches each artifact's local-read, fetch, expected
decode, response-body and validation exceptions. Failed rows identify the stage,
preserve the bounded native cause chain and known response metadata, and remain
failed. All other files and both missing-path controls finish before the sorted
JSON report is written and the gate asserts. No retries or partial-body hashes.
Source bytes have a separate hash; expected decoded hash is known after response
encoding; actual hash/byte count stay null when consumption fails.

Native `AbortSignal.timeout` bounds each request and its body at **30 seconds**;
`ASHEN_VERIFY_TIMEOUT_MS` accepts a positive integer override. Local directory
walk and output-file failures remain outside the per-artifact report guarantee.
Documentation references in comments link to the
[Fetch body contract](https://fetch.spec.whatwg.org/#concept-body-consume-body)
and [native timeout](https://dom.spec.whatwg.org/#dom-abortsignal-timeout).

Missing required immutable/Havok cache headers now evaluate explicitly false.
Previously a nullable check could escape the final `!== false` gate. Existing
bytes/status/executable MIME/Brotli WASM/five mutable-manifest/missing-path rules
remain enforced. Other previously unclassified cache families remain follow-ups;
this is not an exhaustive cache-policy qualification.

**Thirteen actual HTTP/CLI controls pass**, including real disconnected sockets,
an interrupted HTTP 200 body, a stalled body, failed missing-path requests and
absent immutable/Havok cache headers. One read-only canonical production check
passes **552/552 rows**, all five mutable manifests and both missing controls.
Independent Grok review and native subprocess exits are retained separately from
CLI turn-cap status; worker prose does not establish acceptance.

## Cleanup and next action

All six owned Chrome/GPU-helper processes and six preview servers are closed;
7074/10037 are free. Twelve nongame user Edge tabs and zero Orca embedded tabs
remain; discarded Shadowglass stays unactivated. Root removes the media guard
and restores the one previously playing reference without failure.

Raw native logs, operator, sparse clip observations and reviews are under
`.cache/character-mmo/queue-comparison-2026-10-07/`; the tracked receipt preserves
all intervals, per-visit conditions/input/correctness/resource state and ownership
history. Reconstruct the local variants only from the matching release seal and
the declared one-byte replacement; they are diagnostics, never publication inputs.

Move to the retained boot sole silhouette and targeted mixed-outfit motion.
Keep the streaming/audio cause, original reliability tails and physical iPhone
exit open. Do not repeat the unchanged four/eight or silent-output trials.
