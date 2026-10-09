# Ashen Reach — current state

Updated **2026-10-08**. Read this before choosing work. The latest user request
controls scope; historical milestones are evidence, not an active task queue.
**Latest user direction: Gothic region and cathedral exploration; mobile is backlogged.**
The reported castle click-teleport defect is corrected on the new preview: the old terrain
height march ignored architecture. The replacement uses Lite's native screen
ray and a self-filtered Havok query against the nearest physical surface.
The 1 mm query probe is allocated lazily and owned/disposed with player physics;
default gameplay raycasts and collision filters remain unchanged.
Twelve CPU/native Havok tests and six actual-menu/Fly/mouse checks pass: parapet,
gallery, nave, ground, sloped cathedral roof and sky miss, plus elevated Fly-off.
No runtime/GPU errors or recoveries; no new FPS/load claim.
[Native receipt](baselines/dev-surface-2026-10-08/local-report.json) and
[reproduction procedure](debug-view.md#reproduce-developer-navigation-from-the-ui).
Implementation **aa8f92e** is committed/pushed. The
[corrected preview](https://67e791f7.fardel.pages.dev/?dev&play&at=cathedral-parapet)
passes the same six native click controls and all 646 served checks. Root-reviewed
motion is Telegram **892** and
[identical VE MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/dev-surface/2026-10-08/aa8f92e.mp4).
[Full result and limitations](baselines/dev-surface-2026-10-08/README.md).
Owned game/test/media instances are closed; production remains unchanged.
Developer reproduction is now a required part of each new in-game helper:
provide a named control under **?dev → Esc/Menu → Developer tools**, using the
same handler as any shareable URL parameter. The new destination selector covers
18 locations, including **Vaelmark — nave** and **Vaelmark — undercroft**, and
exposes God/Fly toggles and copyable **?dev&play&at=…** spawn links. Jumps wait for
complete region collision and use the existing Havok player controller.
[UI procedure and ongoing rule](debug-view.md#reproduce-developer-navigation-from-the-ui).
All 18 native floor/placement checks, walking/input/focus, spawn-link dev gating
and elevated-floor Fly-off pass with no runtime/GPU errors.
[Local receipt](baselines/dev-destinations-2026-10-08/local-report.json).
This is a reproduction/UI check, not a new performance measurement.
The [new sealed preview](https://375faa2a.fardel.pages.dev/?dev&play&at=cathedral-nave)
includes this menu and direct nave spawn; all 18 public-preview placement/control
checks and 646 served checks pass. Reviewed live demo: Telegram **891** and
[identical VE](https://ve.sparkify.dev/wow-clone/ashen-reach/dev-destinations/2026-10-08/menu.mp4).
[Release/ownership receipt](baselines/dev-destinations-2026-10-08/README.md).
Owned test browsers, servers and media tab are closed; the user's Edge preview
is preserved. Production remains unchanged under its existing hold.
[G01: Vaelmark undercroft](plans/gothic-exploration/results/undercroft-2026-10-08.md)
is complete locally and on the [sealed desktop preview](https://f51c7bcb.fardel.pages.dev/?play&clean):
guarded west-chapel descent, pointed vault, memorial circuit and ordinary-control
return. Implementation **ce0fd03**, benchmark correction **7698295**, committed/pushed.
All 22 CPU checks, six local Havok return routes, 646 served preview checks and
the native preview circuit pass. Reviewed live motion is Telegram **890** and
[identical VE MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/gothic-exploration/2026-10-08/undercroft-ce0fd03.mp4).
Separate unprofiled M1 Max/1280×720/DPR1/seven-enemy windows observe **195.3–235.0 FPS**
across five region routes and **198.4–198.8 FPS** in the undercroft, three 12-second
runs each, no pacing flags, p99≤6.5 ms. One undercroft interval is **21.3 ms**;
all other worst frames≤13.6 ms. It is retained as a tail follow-up, not hidden.
Required near packet remains exact; optional skyline grows 89 bytes.
Production remains unchanged under the separate startup release hold.
The next focused slice is **G02: bridge/portal composition and masonry hierarchy**
against the preserved Gothic references. Existing chapels/gallery/towers/parapet
already exist; the [Gothic plan](plans/gothic-exploration/plan.md) owns this direction.
The [mobile backlog](backlog/mobile-2026-10-08.md) preserves the user's known
iPhone 14 Pro Max / iOS 26.7.1 / Safari / Low Power Mode off specifications,
successful startup/walking/rotation/background-resume checks and the newly reported
hood → dye → ponytail → unequip graphics-device loss. Full physical acceptance
is unverified. Mobile diagnosis, performance work and overlay correction are deferred;
they do not prevent independent desktop gameplay development.

The earlier native **“next 5 priorities”** goal still reports blocked; its original
requirements remain in the [five-priority plan](plans/character-mmo/five-priorities-2026-10-06.md).
That historical package is not the active task queue. Production 5723a4ab / 7d00c56
and the accepted local batch remain intact. Do not repeat exhausted campaigns.

## Production and accepted work

[play.sparkify.dev](https://play.sparkify.dev): source **7d00c56c06f02899e2319ffdddea97728013c0b1**,
Pages **5723a4ab-5dfd-4902-959b-7496948ea51f**
([immutable deployment](https://5723a4ab.fardel.pages.dev)). Rollback:
**6004840807cb47a908fb47dd87848f49f39f3268 / e39117b8-db74-4563-a6c0-b428c8d5d10e**.
Seal `3098125a7ecef760cffe0e1f9dd7aacce232bc9f57b6966b8f41b996239c5876`.

Accepted startup/audio/camera improvements and Fieldcoat are released. Original
qualification passed 552 delivery checks, three entries, nine native phases and
**80/80 declared cold starts**. Worst first play **878.2 ms**. The fence requires selected dressed
identity, grounded Havok, a completed GPU frame, removed loader and working input;
the remaining region loads behind the temporary movement fence.

Fifteen separate settled route windows observe **202.6–232.6 FPS**, p99≤6.2 ms,
worst 11.7 ms, no intervals over 16.67 ms/errors/recoveries/pacing hints. Conditions:
M1 Max, uncapped Chromium WebGPU, 1280×720/DPR1, seven enemies, three 12-second
windows each on meadow/town/bridge/cathedral/forest, no recording or other game.
Cold starts use fresh native Chrome processes/profiles, disabled HTTP cache and
decimal 50 Mbit/s down/10 up/40 ms. OS/DNS/driver/CDN caches are uncontrolled.
Desktop mobile/depth fallback/WebKit are separate from physical iPhone acceptance.
Measurement correction on October 8: the historical region helper inserted an
empty `gpuTiming` parameter, which enables timestamp queries. Recorded receipts
with that URL remain observed throughput with queries enabled. The corrected
helper removes it and asserts disabled queries; the accepted unprofiled G01
measurements are recorded separately and are not a controlled old/new build pair.
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

## Accepted batch and deferred follow-ups

The current demonstrated forefoot/ankle correction is locally complete and
delivered. A subsequent private Orc strap trial is rejected: fewer rest-space
ray hits do not establish a visible improvement. Canonical assets remain unchanged;
the blind offset trial is closed. Further fit work requires a reproduced visible
defect. [Strap trial result](plans/character-mmo/results/boot-strap-clearance-trial-2026-10-08.md).
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
   A demonstrated reporting defect is now corrected locally: a failed secondary
   texture could be named as its surface's primary albedo. The correction names
   the actual sampler URL and retains Lite's native cache/cause. Twenty tests,
   both build configurations and seven native controls pass; all world payloads
   are exact. Historical failed-map/request/body cause remains unproved, so this
   does not reopen unchanged qualification or lift the release hold.
   [Attribution result](plans/character-mmo/results/material-texture-attribution-2026-10-08.md).
   The expanded delivery gate separately finds one deployed cache conflict:
   bundled WASM inherits both one-year and 60-second lifetimes. Source now limits
   the short rule to the legacy root binary. Thirty-two checks, both builds and
   native local Pages matching pass. The public check retains 552 decoded matches,
   two valid 404 controls and this one failed policy; production is unchanged.
   No link to the historical texture failure is established. Include the header
   correction in the qualified batch; local matching does not qualify a release.
   [Policy result](plans/character-mmo/results/release-policy-coverage-2026-10-08.md).
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
   neck/waist/wrist motion are locally accepted. Source leather pleats and tied
   bows are intentional; proud straps and thin-edge aliasing alone are not an
   established fit defect. Plate-edge standoff remains a separate review limit.
   The private Orc +3 mm strap trial reduces five rest-ray hits to two but has no
   established visible gain and is rejected. Inspect a specific visible defect
   at Human shape endpoints and neutral Orc/Undead, correct it through the
   existing authored-piece pipeline and review live motion. Reuse accepted
   fixtures; preserve grips and covered-hair restoration. The first canonical
   authored shield is complete locally and belongs in the qualified release batch.
4. **Physical iPhone acceptance — backlogged by the user.** The current user-run
   Safari report proves successful startup/walking/rotation/background-resume but
   also reports graphics-device loss during hood/dye/ponytail changes. See the
   [deferred findings and retained specifications](backlog/mobile-2026-10-08.md).
   When resumed, test exact released covered/uncovered identities, creator
   rotation, swaps, fifteen-minute traversal and background/resume; record
   device/network/thermal conditions and frame-time tails using the
   [prepared receipt](baselines/character-mmo/iphone-acceptance.md).

Original immutable-preview 14/60 fetch failures and 362 ms post-screenshot input
upper-bound outlier stay open. Later passing starts/4.7–4.8 ms diagnostic movement
and production's worst 61.2 ms input upper bound do not establish their causes.
Native asset/Havok cause reporting, transport/policy controls, response hashes,
mutable-cache classification and bounded request/body failure reports pass.
Declared cache families, entry aliases and world response encoding/MIME are now
covered. Nondeclared default cache policies and local directory-walk/output
failures remain follow-ups.
The [default-cache observation](plans/character-mmo/results/default-cache-investigation-2026-10-08.md)
finds 213 zero-second and 57 four-hour responses among the 270 unclassified rows,
all with exact decoded bytes. Native zone inventory confirms a 14,400-second
browser TTL; rule/transform reads are forbidden, so effective policy attribution
remains incomplete. No cache mutation or new delivery/startup campaign follows.
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
direct VE proportions pass for the undercroft and forefoot/restoration clips; actual app
fullscreen is unverified.

G01 preview source **7698295 / f51c7bcb**, seal
`7b366bd57343545f69a51b4b9148dda699e8774ce87b8ef3630935a89841ccaf`.
All owned G01 game browsers, controllers, Vite servers and review tabs are closed.
Grok's final preview owned Chrome **24817**, Vite **24772** (CDP10037/Vite5873),
now stopped. Freeze source **and prepared public inputs** throughout native checks;
run preparation before build, not concurrently. [Full receipt and ownership](plans/gothic-exploration/results/undercroft-2026-10-08.md).

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
