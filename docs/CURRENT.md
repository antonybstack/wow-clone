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

**G06 hall balcony is implemented/pushed as 1b35554; its isolated FPS gate remains open.**
[Functional preview](https://2fd14837.fardel.pages.dev/?dev&play&at=east-keep-hall-balcony),
[actual checks/limits](baselines/g06-hall-balcony-2026-10-09/README.md),
[concrete slice](plans/gothic-exploration/g06-hall-balcony-2026-10-09.md).
Supported interior balcony, guarded bridge, widened pointed doorway and closed
gables preserve the lower hall lane. Final local/public ordinary ascent/entry/
return and six guard contacts pass; 48 CPU, twenty developer landings, ordinary
map/disposal and 649 served checks pass. Telegram898/reviewed direct VE motion.
Fresh isolation is unresolved because the browser tool rejected its internal
status page; an unrelated user Shadowglass tab's current rendering state remains
unconfirmed. User clarification is pending; no G06 FPS claim or production
promotion. The user authorized independent feature development while operations
are pending; this performance gate holds acceptance/release, not all source work.
Continue isolated candidate development under the active goal, preserving the user tabs,
mobile backlog and separate production hold.

[Region-wait follow-on plan](plans/gothic-exploration/region-navigation-core-2026-10-09.md)
now has a pushed experimental implementation, product **6ea3c6a**:
[Desktop preview](https://fc70ac46.fardel.pages.dev/?dev&play&regionCore=1), Telegram **899** /
[reviewed VE MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/gothic-exploration/2026-10-09/region-core.mp4). all physical surfaces plus reduced trees first,
full woodland detail later. Candidate first payload14.4 MB versus22.4 MB, but
combined transfer rises11.7%. No runtime speedup claim; the existing whole-region
stream remains default. Candidate mode is exposed through ?dev → Developer tools
with a reload toggle and shareable spawn link. Seventy CPU checks, five native failure/default/retry/disposal cases, twenty landings,
six surface checks pass locally; five-case fault/retry checks and ordinary Eastwatch
climb/guards pass locally/publicly. All651 served artifacts pass. Both G06 FPS and
candidate paired timing/settled performance must qualify before acceptance/adoption.
[Candidate evidence and limits](baselines/region-core-candidate-2026-10-09/README.md).

**G07 Vaelmark exploration guide is pushed as 139c2d5 on a functional desktop preview.**
[Preview](https://f56f0786.fardel.pages.dev), Telegram **900** /
[reviewed VE MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/gothic-exploration/2026-10-09/cathedral-guide.mp4).
Ordinary Menu → Region map → Vaelmark exploration offers five route/level views,
matching player position, connection directions and bell ascent diagrams. It uses
existing metadata/menu/Canvas2D with no new assets or frame hook. Ten CPU checks,
six physical views, ordinary focus/pause/selection/walking/disposal, retained
region/minimap guidance and twenty developer landings pass locally. Final public
guide/physical views/map controls pass;651 served checks pass.
[G07 scope/evidence](baselines/g07-cathedral-guide-2026-10-09/README.md).
Its isolated FPS acceptance remains pending; source work does not waive the gate.
Next independent work: [G08 live region-loading progress](plans/gothic-exploration/g08-region-progress-2026-10-09.md),
answering the opaque collision-wait message with actual processing phases/counts.

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
- **Developer reproduction and physical surface picking:** twenty named UI
  destinations (including Eastwatch wall walk/hall balcony) plus God/Fly/link controls; click teleport uses native Lite screen
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

G03/G04/G05/G06/G07 and region-core candidate owned contexts/harnesses are closed.
G07 Chrome33002/CDP10037, Vite32939+32977/5873, compiled55608/7074 and
media67439/7077 stopped; review1147996186/6190 tabs closed.
Candidate Chrome74078/CDP10037, Vite74043+74067/5873, compiled88134/7074 and
media128/7077 are stopped; review1147996174/6178/6182 tabs closed. Latest G06 Chrome38823 / CDP10037,
Vite38794+38818 /5873 and compiled68298 /7074 are stopped. All review/media/Grok,
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
