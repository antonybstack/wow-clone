# Concurrent native physics/world preparation — 2026-10-07

**Rejected for lack of material gain; removed.** Starting and immediately observing
`setupPlayer` before the opt-in world preparation preserves avatar initialization
and permits the original Havok promise to overlap registration/submission. Body
mounting still awaits native physics and the completed dressed/support/input gates.
The twelve native controls and twelve declared local starts pass. Main is restored
exactly to 865cf7d. No public cohort, publication or production promotion follows.

Prototype main SHA: `27864198775f4d60de9eb31de7eea92e31964b815f7ee7832147dfca47ed88f6`.
Restored SHA: `1de3121f7751377734fba5824b9a7ca537b3e5240cc2fb32f9ee49deb3265078`.
Helper and Vite are unchanged. Syntax, twenty focused checks and both flag builds pass.

| Outfit | Pair | Before | Concurrent | Change |
| --- | ---: | ---: | ---: | ---: |
| Default | 1 | 529.4 ms | 535.8 ms | +6.4 ms |
| Default | 2 | 533.2 ms | 532.9 ms | −0.3 ms |
| Default | 3 | 536.0 ms | 540.6 ms | +4.6 ms |
| Maximum | 1 | 779.7 ms | 780.1 ms | +0.4 ms |
| Maximum | 2 | 780.7 ms | 779.4 ms | −1.3 ms |
| Maximum | 3 | 777.7 ms | 779.4 ms | +1.7 ms |

Conditions: M1 Max, native Chromium WebGPU, 1280×720/DPR1, fresh process/profile,
decimal 50 Mbit/s down/10 up/40 ms. Initially empty HTTP cache with native preload
reuse; OS/driver caches uncontrolled; no tracing/forced shader-cache policy. Three
alternating pairs per outfit, declared before running. These local observations
are not the cache-disabled public qualification cohort. Every actual identity,
gear, Havok support, completed GPU and input check passes with zero recorded errors.
Both local delivery checks pass. Retain every sample; do not rerun this ordering.

Native controls include held-body release, corrupt gzip after HTTP 200, disposal,
asynchronous device loss, normal default/maximum, helper abort and flag-zero
movement. Four additional controls hold the **actual native Havok WASM response**:
release, disposal, device loss and abort. Submission occurs after physics setup
starts and while its promise remains pending. Body completion alone cannot release
play. Teardown prevents late body/controller/play continuation. Root reviewed
actual first-play, maximum and Havok-release running-pose stills, with no persistent
T-pose. No new live-motion/art acceptance is claimed for this hidden experiment.

The controlled Havok abort reveals a diagnostic gap: the overlay retains a native
`TypeError: Failed to fetch` and Emscripten stack, but does not identify the WASM URL.
There is one observed WASM request, no application retry and no unhandled page error.
This does **not** explain the original fourteen public failures. Their retained
Havok transfers all finish with HTTP 200 and about 502 KB; those old records contain
only generic error text, without an overlay stack or native loading-failure details.
Keep the historical cause open. Add exact runtime-initialization URL/native-cause
context when addressing this demonstrated diagnostic gap, preserving memoization.

The next stronger hypothesis comes from the maximum row's network waterfall:
shared pure startup module ready at **96.3 ms**, tiny external launcher ready at
**258.3 ms**, body discovered by main at **198.0 ms**. Test an async inline facade
of that existing generated module to eliminate the launcher's queue/request wait.
Preserve the shared validator/promise cache and catalogue-before-execution order;
use native bundler parsing, with no second storage decoder or loader.

## Evidence and ownership

[Tracked receipt](../../../baselines/character-mmo/startup-prime-concurrent-2026-10-07/receipt.json)
retains sources, exits, twelve native controls and all twelve marks/samples. Raw
scripts, builds, reports and reviewed captures remain under
`.cache/character-mmo/startup-prime-concurrent-2026-10-07/`.

Native Chrome **90511**, GPU **90537**, CDP **10037** and previews **90510/92045:7074**
are closed. Timing previews **13560:7074 / 13566:7075** are closed; individual Chrome
PIDs remain in each probe receipt. Final process/listener audit finds no owned
renderer. Edge's twelve user tabs contain no game; Orca has zero tabs. Temporary
`__startupPrimeConcurrent20261007` media guard is removed; prior connected playback
restored to 3/1/1/0 for Telegram/Shadowglass/X/X-other. User sessions are preserved.
The paired Grok CLI hit its five-turn cap **after** the prepared runner exited 0;
acceptance uses runner exits/artifacts. It was not rerun to finish a prose report.
