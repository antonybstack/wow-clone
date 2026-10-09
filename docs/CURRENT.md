# Ashen Reach — current state

Updated **2026-10-09**. Read this before choosing work. The latest user request
controls scope; historical plans/results are evidence, not an active task queue.
**Active direction: Gothic region and cathedral exploration. Mobile is backlogged.**
The active eight-hour goal continues through the focused following slices;
there is no pending user review or approval.

## Current task and next work

**G05 Eastwatch wall walk is complete on a sealed desktop preview; product c3419d4 is pushed.**
A visible 33-tread courtyard stair/smooth Havok ramp reaches a guarded U-shaped
route and the raised hall window. Ordinary climb, all turns, three guard contacts
and gate return pass locally/publicly. Nineteen developer destinations, six
surface checks, ordinary map/disposal and 649 served checks pass. A connected
public tour enters/returns all eight destinations and returns to the initial
bridge, with nine connecting legs, Havok active, Fly off and zero recoveries/errors.
[Evidence and limits](baselines/g05-wall-walk-2026-10-09/README.md).

Fifteen separate M1 Max / uncapped Chromium WebGPU / 1280×720 / DPR1 / seven-enemy
windows observe **189.9–229.0 FPS**, p99≤6.5 ms, worst 9.9 ms, zero intervals
>16.67 ms, pacing flags, errors or recoveries. All 37,619 raw intervals are retained;
map closed/no selection, local RAF throughput, not a production comparison or timed
wall-walk/capture result. [Preview](https://ae9f12cc.fardel.pages.dev/?dev&play&at=east-keep-wall-walk).
Reviewed motion: Telegram **897** / [verified VE MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/gothic-exploration/2026-10-09/wall-walk.mp4).
Actual direct VE playback passes; Telegram application inline/fullscreen remains unverified.

**Next: G06 connected Eastwatch hall balcony.** [Concrete slice](plans/gothic-exploration/g06-hall-balcony-2026-10-09.md).
Reuse the existing stair/rear walk, connect its pointed opening to a supported
interior balcony, preserve the lower hall route and qualify ordinary entry/return.
Continue the active goal without waiting for user review; mobile and independent
production hold remain deferred. [Following slices](plans/gothic-exploration/next-slices-2026-10-09.md).

## Completed desktop previews

- **G04 region map:** 9d5d4fe / [4f787280](https://4f787280.fardel.pages.dev/?play&clean).
  All eight names/routes, well detour, player heading and independent destination
  minimap guidance; ordinary selection/pause/focus/disposal pass. No frame-loop
  hook or changed world assets. [Results](baselines/g04-map-2026-10-09/README.md), Telegram 896/VE.
  Separate 189.2–228.0 FPS, p99≤6.5 ms/worst 10 ms; no recoveries/errors.
- **G03 regional circuit:** f159ff0 / [0db543e3](https://0db543e3.fardel.pages.dev/?dev&play&at=east-keep).
  Distinct hall/tower lancets, crests/furnishings and Hollowmere altar/inward facing.
  Real east/west road-fork ledges repaired. 58 CPU checks, all eight public landmark
  entry/returns and final bridge return, eighteen developer controls, six surface
  checks and 649 served checks pass. [Results](baselines/g03-region-2026-10-09/README.md), Telegram 895/VE.
  Separate 188.2–227.2 FPS, p99≤6.6 ms/worst 13.8 ms; no recoveries/errors.

- **Navigation readiness:** 375aaca / [8caba37c](https://8caba37c.fardel.pages.dev/?dev&play&at=cathedral-nave).
  Three native local pairs at 50 Mbit/s: safe routes 5.91–6.07s vs 7.48–7.63s;
  local first play 340–344 ms, no new universal cold-start qualification.
  [Results](baselines/region-readiness-2026-10-09/README.md), Telegram 893/VE.
  One first-meadow 219.9 ms interval remains unexplained; later clean runs do not fix it.
- **G02 bridge/portal:** 990bb4a / [a14e927b](https://a14e927b.fardel.pages.dev/?dev&play&at=cathedral-bridge).
  Pointed portal, recessed lancets/warm trim; 53,398 render / 13,556 collision triangles.
  [Results](baselines/g02-approach-2026-10-09/README.md), Telegram 894/VE.
- **G01 undercroft:** ce0fd03 / qualification 7698295 / [f51c7bcb](https://f51c7bcb.fardel.pages.dev/?play&clean).
  Guarded west-chapel descent, pointed vault/memorial circuit and ordinary return.
  [Result](plans/gothic-exploration/results/undercroft-2026-10-08.md), Telegram 890/VE.
  Existing chapels/gallery/bell stairs/parapet already exist; do not rebuild them.
- **Developer reproduction and physical surface picking:** nineteen named UI
  destinations (including Eastwatch wall walk) plus God/Fly/link controls; click teleport uses native Lite screen
  rays and a self-filtered Havok query, including roofs and elevated floors.
  [UI procedure](debug-view.md#reproduce-developer-navigation-from-the-ui),
  [destination result](baselines/dev-destinations-2026-10-08/README.md),
  [surface result](baselines/dev-surface-2026-10-08/README.md), Telegram 891/892.

Required near geometry remains exact at 149,963 encoded bytes. Optional whole-region
geometry is 22.4 MB encoded/~158 MB decoded; developer jumps wait for safe collision,
independent of later grass/texture/NPC work. [Why the wait occurs](plans/gothic-exploration/region-readiness-2026-10-08.md).

## Production and independent hold

[play.sparkify.dev](https://play.sparkify.dev) remains source
**7d00c56c06f02899e2319ffdddea97728013c0b1**, Pages
**5723a4ab-5dfd-4902-959b-7496948ea51f** ([immutable](https://5723a4ab.fardel.pages.dev)).
Rollback **6004840807cb47a908fb47dd87848f49f39f3268 / e39117b8-db74-4563-a6c0-b428c8d5d10e**.
Existing release qualified 80/80 declared cold starts, worst first play 878.2 ms,
552 delivery checks, three entries and nine native phases.
[Production result/conditions](plans/character-mmo/results/production-delivery-2026-10-07.md).

The locally accepted boot/forefoot/shield batch and Gothic previews are **not a
new production qualification**. Preview 514fe898/4ad2637 failed one required texture
request in twenty maximum-uncovered starts; later diagnostic passes do not establish
cause. Texture-attribution/header-policy corrections are local; the original
request/body cause remains open. Do not repeat exhausted unchanged campaigns,
add speculative retries or promote from desktop preview gates alone.
[Hold and deferred evidence](plans/character-mmo/five-priorities-2026-10-06.md),
[detailed retained state](archive/current-before-g03-closeout-2026-10-09.md).
That older five-priority native goal is blocked and is not the active task queue.

## Mobile and operating rules

[Mobile backlog](backlog/mobile-2026-10-08.md): user reports **iPhone 14 Pro Max,
iOS 26.7.1, Safari, Low Power Mode off**; startup/walking/rotation/background-resume
work, but hood→dye→ponytail→unequip caused graphics-device loss. Physical acceptance
is incomplete and mobile investigation remains explicitly deferred.

Root implements/accepts; **Grok 4.6/high** handles bounded delegated review/operations.
Preserve unrelated **AGENTS.md / docs/plans/character-mmo/next-ten.md** edits.
Commit/push completed owned work; every visual cycle needs root-reviewed motion
on Telegram via `tg file` plus verified VE. Do not equate API dimensions, tests or
an offline render with actual playback/visual acceptance.

G03/G04/G05 owned contexts/harnesses are closed. Latest G05 Chrome2789 / CDP10037,
Vite2740+2784 /5873 and compiled35177 /7074 are stopped. All review/media/Grok,
capture/encoding/delivery processes are done. No owned game renderer remains.
User Edge2931 / fifteen existing tabs, Chrome13883 / New Tab, Orca and unrelated
Vite4000 10171+10205 are preserved. Before every live check/timing window audit
pages/PIDs, track owner/port/URL/purpose and close owned contexts/browser/harnesses
with each completed milestone. [Ownership procedure](debug-view.md#browser-ownership-and-performance-isolation).

Active root index.html/ashen-reach.html; Vite 5173; src/ashen-reach/main.js exposes
ASHEN. **Babylon Lite 1.31.1 / WebGPU, Havok 1.3.14**, compatible source motion.
[Focused Gothic plan](plans/gothic-exploration/plan.md), [docs map](README.md),
[character contract](character-system-north-star.md),
[equipment authoring](ashen-equipment-authoring.md), [startup](startup-load.md).
