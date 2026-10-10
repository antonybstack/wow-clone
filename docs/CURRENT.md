# Ashen Reach — current state

Updated **2026-10-10 PDT**. Read this before choosing work. Latest user direction
controls scope; historical milestone lists are evidence, not an active queue.
**Current focus: combat feel and an interacting fire-caster kit in the Gothic region.**
The [12-milestone combat overhaul plan](plans/combat-overhaul/plan-2026-10-10.md)
has C01 baseline evidence and C02–C04 implemented: authoritative action timing,
input buffering, moving/airborne instants, contact deadlines, readable cooldowns
and persistent combat bindings. [C03](baselines/combat-c03-2026-10-10/README.md)
is pushed (`e2d4d2f`, test/delivery follow-up `fae4e9e`), Telegram **914** / verified VE.
[C04](baselines/combat-c04-2026-10-10/README.md) is pushed (`f955297`), Telegram **915** / verified VE: **60 CPU tests**, build, native
HUD/keybinding/reload/source-switch checks and mortal contact pass. Isolated
M1 Max / uncapped Chromium WebGPU / 1280×720 DPR 1 / seven enemies: three
12-second runs per dummy/pack, **165–188 FPS**, **6.5–8.6 ms p99**, matched
median throughput change under 0.2%. Counts/tails/raw intervals are retained.
C01's independent RAF callback FPS is not a comparable submitted-frame baseline.

**Next: C05 sustainable combat and Ashen Brand**, followed by procs, safe area
damage, enemies/utilities, presentation and the Gothic encounter. Full native
100-action chain, mortal chapel traversal, clear source/equipment silhouette
review, death/blur/soak and production release gates remain open. Opus VFX code
is an unconnected prototype with known lifetime/double-flare/height issues;
review it before integration. Production is unchanged; mobile remains backlogged.

## Completed expedition

The [24-hour plan](plans/gothic-exploration/next-24-hours-2026-10-09.md) completed
its G09–G18 desktop-preview branch. G09 bounded startup diagnosis yielded no
supported fix; G10–G16 implement the saved inscription → west bell → reliquary →
Hollowmere episode and seven optional regional readings/map knowledge. Existing
route availability, Havok movement, compatible animation and lighting budget remain.
Added detail: 758 render triangles, zero collision; near packet 149,963 bytes.

**[Play Vaelmark in production](https://play.sparkify.dev/?dev&play&at=cathedral-nave)**.
The [matching desktop preview](https://1c84608d.fardel.pages.dev/?dev&play&at=cathedral-nave)
remains available for comparison.
Pages **1c84608d-a319-4a30-aa84-a5d05099441c / source 4799023** uploads the exact
649-file sealed build, with 652 public artifact/MIME/cache/entry/404 checks passing.
For the same initial placement, `?dev` → Menu → Developer tools → Destination →
Vaelmark nave → Jump. The subsequent complete episode and Bell Watch return pass
with ordinary controls, God/Fly off, Havok active, zero recoveries/runtime/GPU
errors. Actual reloads and a torso swap retain progress.

G17: 71 CPU tests, native journal/map/watchman/core failure checks, bounded Grok
4.6/high source review, 1,201-second local crypt soak/110 circuits/ten revisits and
disposal pass. Isolated M1 Max, uncapped Chromium 155 WebGPU, 1280×720/DPR 1, seven
enemies, three 12-second windows per seven routes: **178.9–240.5 FPS**, maximum
route p99 **6.6 ms**, worst **13.1 ms**, no interval over 16.67 ms. Raw intervals
retained; no material matched-baseline regression. These are RAF throughput: standard moving fixtures use diagnostic placement/God
immunity; stationary interior fixtures are mortal.
Capture-free action timing is separate; public desktop touch/depth fallback and
WebKit smoke checks also pass. Physical iPhone acceptance remains incomplete.

[Full live journey](https://ve.sparkify.dev/wow-clone/ashen-reach/gothic-exploration/2026-10-09/vaelmark-expedition.mp4),
[short presentation](https://ve.sparkify.dev/wow-clone/ashen-reach/gothic-exploration/2026-10-09/vaelmark-presentation.mp4).
Root-reviewed live playback, exact VE bytes/MIME/range/play/seek and Telegram
**911/912** matching 1280×720 pass; application inline/fullscreen remains unverified.
[Final result and retrospective](plans/gothic-exploration/results/expedition-release-2026-10-10.md),
[raw receipts](baselines/vaelmark-expedition-2026-10-09/README.md),
[long-term vision](plans/gothic-exploration/vision.md).

## Production (user-directed, startup unqualified)

[play.sparkify.dev](https://play.sparkify.dev) serves sealed Pages
**94db62ac-9d58-43ad-ad52-5d0001a6f3a1 / source a7df082**
([immutable](https://94db62ac.fardel.pages.dev)), 649 files / seal
`6ef7b8ef9bf46d6f336cb708aea1eb441b18eeeaf1cf2a02d66f7e24f1943517`.
Rollback **5723a4ab / 7d00c56**. User-directed promotion of the desktop
preview under the new explicit deployment request; the 1 s startup target
remains unmet. This release does not establish startup qualification. 652/652
integrity checks pass on the immutable URL and the custom domain. Public
default entry walks with Havok; 26323 ms is ready+navigation+hostiles, not
first play. Native expedition/Hollowmere/Bell Watch, actual reload and
torso swap pass after a retained first helper abort on regenerating mana
(109.5304 → 109.5968). [Production result](plans/gothic-exploration/results/production-deployment-2026-10-10.md),
[receipts](baselines/gothic-production-2026-10-10/README.md).

Startup backlog unchanged: valid cold miss 1,140.1 ms; diagnostic
**8,841.1 ms first play**; historical required-texture failure open. Do not
retry unchanged 80-start cohorts. Next attributed startup work still needs
fresh-process adapter/cache/trace context. [Release contract](DEPLOY.md),
[retained hold evidence](baselines/gothic-production-2026-10-09/README.md).

## Ownership and operating rules

Root closed the user Edge 5173 game tab with explicit authorization. All root
C03/C04 game contexts and slot 8 Chrome45113/Vite45088 (CDP10137/Vite5973) are
closed/stopped after measurement. C04 local/VE video tabs and preview 7075 are also closed; final browser inventory shows no game or review tabs. Other user tabs and
Vite29712/5173 and Vite4000 10171/10205 remain intact. Grok source review/encode
workers and Opus VFX are finished/idle with no browser ownership.

Root implements and accepts. Grok handles bounded operations/review; the latest
user request explicitly permits Opus 5.5 for parallel combat VFX work. Preserve unrelated
AGENTS.md / docs/plans/character-mmo/next-ten.md edits. Commit/push completed owned
work; review actual motion and send via tg file/verified VE. Benchmark an isolated
owned game instance and close it afterward. [Ownership/capture](debug-view.md).
Active root index.html / ashen-reach.html, ASHEN, Babylon Lite 1.31.1/WebGPU/Havok 1.3.14.
[Previous detailed state](archive/current-before-expedition-closeout-2026-10-09.md).

[Mobile backlog](backlog/mobile-2026-10-08.md): **iPhone 14 Pro Max, iOS 26.7.1, Safari,
Low Power Mode off**. Startup/walking/rotation/background resume work;
hood → dye → ponytail → unequip caused graphics-device loss. Explicitly deferred.
