# Ashen Reach — current state

Updated **2026-10-08**. Read this before choosing work. The latest user request
controls scope; historical milestones are evidence, not an active task queue.
The native goal **“next 5 priorities” remains active**. Its original acceptance
requirements remain in the [five-priority plan](plans/character-mmo/five-priorities-2026-10-06.md).
Current physical-device acceptance and unexplained reliability tails are open.

## Production and accepted work

[play.sparkify.dev](https://play.sparkify.dev): source **7d00c56c06f02899e2319ffdddea97728013c0b1**,
Pages **5723a4ab-5dfd-4902-959b-7496948ea51f**
([immutable deployment](https://5723a4ab.fardel.pages.dev)). Rollback:
**6004840807cb47a908fb47dd87848f49f39f3268 / e39117b8-db74-4563-a6c0-b428c8d5d10e**.
Seal `3098125a7ecef760cffe0e1f9dd7aacce232bc9f57b6966b8f41b996239c5876`.

Accepted startup/audio/camera improvements and Fieldcoat are released. All 552
delivery checks, three entries, nine native phases and **80/80 declared cold
starts** pass. Worst first play **878.2 ms**. The fence requires selected dressed
identity, grounded Havok, a completed GPU frame, removed loader and working input;
the remaining region loads behind the temporary movement fence.

Fifteen separate settled route windows observe **202.6–232.6 FPS**, p99≤6.2 ms,
worst 11.7 ms, no intervals over 16.67 ms/errors/recoveries/pacing hints. Conditions:
M1 Max, uncapped Chromium WebGPU, 1280×720/DPR1, seven enemies, three 12-second
windows each on meadow/town/bridge/cathedral/forest, no recording or other game.
Cold starts use fresh native Chrome processes/profiles, disabled HTTP cache and
decimal 50 Mbit/s down/10 up/40 ms. OS/DNS/driver/CDN caches are uncontrolled.
Desktop mobile/depth fallback/WebKit are separate from physical iPhone acceptance.
[Release result and mixed-domain failure history](plans/character-mmo/results/production-delivery-2026-10-07.md),
[all samples](baselines/character-mmo/production-delivery-2026-10-07/receipt.json),
[native release procedure](DEPLOY.md#mixed-custom-domain-delivery).

Local committed/pushed release batch: canonical boot sole/forefoot/strap and Orc
last/plate corrections, parallel native sound buffers and canonical Bastion
shield. Production catalogue is v8; local catalogue v9 freezes v8. The shield
uses native rigid loading, evaluated sockets, transactions, rollback/retry,
saved prefetch and shared remote rendering. Maximum compact payload is
**2,170,019 bytes** (current forefoot correction; previous shield maximum 2,170,524). Its implementation is **421a889**, acceptance checkpoint
**ca60242**. Root-reviewed motion is Telegram **887** and identical VE. Seven
fits, 35 native motion chapters, nine remote chapters and three-race ordinary
Havok run/jump pass. Local shield route windows observe 203.1–237.9 FPS, p99≤6.2 ms;
six of fifteen retain possible pacing flags and do not establish clean uncapped
maximum throughput. [Canonical shield result](plans/character-mmo/results/authored-shield-canonical-2026-10-07.md).
The subsequent authored forefoot and anatomical foot coverage correction is
locally verified: the reproduced Human ankle peeks and Undead body spur are gone;
boots-off restores the complete body. All 240 character/115 equipment tests,
51-piece native bounds and fresh live motion pass. The body update initially
invalidated the strict covered-hair hash pins and raised startup payload to
2,367,719 bytes. Fresh decoded equivalence proof and exact updated pins preserve
the existing deferral/restoration path; three native restoration controls pass.
Fifteen separate corrected-maximum route windows observe **203.0–237.1 FPS**,
p99≤6.1 ms, worst 14.4 ms, zero intervals over 16.67 ms/errors/recoveries, under
the same M1 Max/1280×720/DPR1/seven-enemy conditions. Six possible 240 Hz pacing
flags remain; this is observed throughput, not clean maximum throughput.
[Forefoot result](plans/character-mmo/results/boot-forefoot-2026-10-08.md).
Implementation **989ab52** is committed/pushed; root-reviewed motion is Telegram
**888 / 889** and identical VE. Inline/expanded Telegram Web and direct VE
proportions pass; actual application fullscreen remains unverified.
Further sets, Elf, additional regions, multiplayer and crowd expansion stay parked.

## Next priorities, in execution order

The current demonstrated forefoot/ankle correction is locally complete and
delivered. The next executable slice is another reproduced armor seam in priority 3.
The native GPU-timer arm in priority 2 is complete and closed; it does not justify
a shader/geometry/scheduler change or another unchanged visit. The release outcome
stays first, but unchanged startup campaigns are exhausted until a material lead exists.

1. **Resolve the startup failure, then release the accepted batch.** Canonical
   boot preview **514fe898 / 4ad2637 is rejected**: one required texture fetch
   failure in twenty maximum-uncovered starts; default 20/20, 571 delivery checks
   and three entries pass. Remaining cohorts/native phases/FPS did not run.
   Twenty later bounded native diagnostic visits are clean; request/body cause
   remains unproved. Do not repeat unchanged cohorts or add speculative retries.
   Correct a demonstrated material request/body lead, declare a new sealed
   preview, then run served-asset/cache checks, three entries, four cold-start
   cohorts, native movement/swaps/mobile/WebKit and fifteen separate route
   windows before promotion. Preserve ≤1,000 ms first play, 144 FPS target at
   1280×720 and >120 FPS floor; retain every miss. Production 5723a4ab is rollback.
   [Rejected preview](plans/character-mmo/results/boot-sole-preview-2026-10-07.md),
   [native diagnostic campaign](plans/character-mmo/results/startup-native-capture-2026-10-07.md).
2. **Smooth background loading and explicit sound activation.** Streaming p99
   around 21.5 ms and first AudioContext construction 151–179 ms remain distinct
   from settled FPS. Parallel buffer fetch/decode saves 45.6–58.1 ms readiness,
   preserving the constructor hitch. Change demonstrated bottlenecks only.
   [Sound result](plans/character-mmo/results/audio-buffer-parallel-2026-10-07.md).
   Queue 8, silent-output and explicit-sample-rate trials remain closed. Exact
   completion epochs show long gaps after saturation; three bounded RAF-poll
   pairs fail the material p99 gain gate (+0.46%, +1.38%, −0.93%). Keep source 4 and
   its current RAF policy. [Completion result](plans/character-mmo/results/frame-completion-2026-10-08.md).
   Native early/late/observed-tail traces now distinguish main-thread task time
   from acknowledgement-to-RAF delivery; they do not measure hardware GPU time.
   Two captured gaps retain 14.8/16.1 ms after acknowledgement with only
   0.189/0.226 ms recorded main-thread work. Independent review confirms them;
   an adjacent-RAF matching error is corrected.
   [Native trace result](plans/character-mmo/results/completion-native-trace-2026-10-08.md).
   The single native timer visit now resolves all 1,652 raw readbacks. Three long
   gaps have complete preceding-work coverage: twelve marked GPU frames report
   0.918–1.442 ms while render resumes 17.1–17.2 ms after acknowledgement. This
   narrows expensive marked GPU frame execution for those cases; GPU/JS span
   disagreement prevents wall-time calibration, and outside-marker uploads,
   queue/presentation/OS cause remains unproved. The diagnostic uses the
   preserved uncovered recipe, not every outfit/current maximum. No runtime change.
   [Raw GPU result](plans/character-mmo/results/completion-gpu-raw-2026-10-08.md).
   No further repeats of either diagnostic or scheduler arm. Preserve the
   first-play fence, input/resources and independent unprofiled acceptance.
3. **Finish demonstrated armor seams.** Boot/forefoot/anatomical ankle corrections and focused mixed
   neck/waist/wrist motion are locally accepted. Knot/cuff/plate-edge overlap,
   leather pleats, proud straps and aliasing remain. Inspect a specific defect
   at Human shape endpoints and neutral Orc/Undead, correct it through the
   existing authored-piece pipeline and review live motion. Reuse accepted
   fixtures; preserve grips and covered-hair restoration. The first canonical
   authored shield is complete locally and belongs in the qualified release batch.
4. **Complete current physical iPhone acceptance when available.** Successful
   2026-10-08 inventory finds one Mac, eleven simulators and no physical iPhone.
   The user's historical iPhone 14 Pro Max ~60 FPS report does not qualify this
   current release. Test exact released covered/uncovered identities, creator
   rotation, swaps, fifteen-minute traversal and background/resume; record
   device/network/thermal conditions and frame-time tails using the
   [prepared receipt](baselines/character-mmo/iphone-acceptance.md).

Original immutable-preview 14/60 fetch failures and 362 ms post-screenshot input
upper-bound outlier stay open. Later passing starts/4.7–4.8 ms diagnostic movement
and production's worst 61.2 ms input upper bound do not establish their causes.
Native asset/Havok cause reporting, transport/policy controls, response hashes,
mutable-cache classification and bounded request/body failure reports pass.
Other cache families and local directory-walk/output failures remain follow-ups.
Shader/shadow, precision, reorder/resample, concurrent physics and inline-launcher
trials stay closed without material new evidence. No diagnostic is completion of
the full goal. While release cause and hardware are unavailable, independent
measured performance or demonstrated fit work can proceed.

## Operations and working references

Root implements and accepts. Grok 4.6/high handles bounded delegated review,
verification and operations. Freeze product inputs during sealed gates; docs-only
HEAD changes do not change the product fingerprint. Preserve unrelated
**AGENTS.md / docs/plans/character-mmo/next-ten.md** edits; no reset/stash/clean.
Commit/push completed owned changes. A visual cycle requires root-reviewed live
MP4/GIF on Telegram with verified VE delivery. Telegram Web inline/expanded and
direct VE proportions pass for the latest forefoot/restoration clips; actual app
fullscreen is unverified.

Before live work, audit pages/processes and own every browser/PID/CDP/URL. Use one
game for timing; pause reference media and exclude recording/builds/other timing
work. Close owned contexts/browsers/harnesses and restore media. User Edge 2931
and Orca 98938 remain intact, twelve nongame Edge tabs; discarded Shadowglass stays
unactivated. [Ownership procedure](debug-view.md#browser-ownership-and-performance-isolation).

Active root index.html/ashen-reach.html, Vite 5173, src/ashen-reach/main.js, ASHEN;
Babylon Lite 1.31.1/WebGPU, Havok 1.3.14 and compatible source motion. Human height
0.90–1.15/build −0.95…+0.95; Orc/Undead neutral only.
[Character contract](character-system-north-star.md),
[equipment authoring](ashen-equipment-authoring.md), [startup](startup-load.md),
[docs map](README.md), [vision](plans/character-mmo/vision-roadmap.md),
[workflow](reviews/workflow-2026-10-05.md#current-operating-rule--2026-10-06).
The [archived current-state chronology](archive/current-before-native-completion-2026-10-08.md)
preserves prior detailed checkpoints and their receipts; use it only for history.
