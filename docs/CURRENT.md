# Ashen Reach — current state

Updated **2026-10-09**. Read this before choosing work. The latest user request
controls scope; historical plans/results are evidence, not an active task queue.
**Active direction: Gothic region and cathedral exploration. Mobile is backlogged.**
The active eight-hour goal continues through the focused following slices;
there is no pending user review or approval.

## Current task and next work

**G03 is complete on the sealed desktop preview; product f159ff0 is committed/pushed.**
Three keeps and detached towers have real raised rear lancets and distinct wall-side
crests/furnishings; Hollowmere has an altar/cross and corrected inward developer
facing. Connected walking found and repaired real east/west road ledges while
preserving protected terrain, landmarks and Havok. All 58 CPU checks, eight public
landmark entry/return routes, the final bridge return, eighteen developer controls
and six physical surface/Fly-off checks pass without runtime/GPU errors or recoveries.
[Actual evidence and limits](baselines/g03-region-2026-10-09/README.md),
[implementation scope](plans/gothic-exploration/g03-region-2026-10-09.md).

Fifteen separate M1 Max / uncapped Chromium WebGPU / 1280×720 / DPR1 / seven-enemy
windows observe **188.2–227.2 FPS**, p99≤6.6 ms, worst 13.8 ms, zero intervals
>16.67 ms, pacing flags, errors or recoveries. All 37,276 raw intervals are retained.
This is local RAF throughput, not a controlled production comparison.
[Sealed desktop preview](https://0db543e3.fardel.pages.dev/?dev&play&at=east-keep)
passes all 649 served checks. Reviewed motion: Telegram **895** and
[identical VE MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/gothic-exploration/2026-10-09/region.mp4).
Telegram API dimensions match; actual application inline/fullscreen is unverified.

Current next slice: **G04 useful region map**, then **G05 Eastwatch guarded
wall walk**. [Concrete following slices](plans/gothic-exploration/next-slices-2026-10-09.md).
Use existing registry/menu/minimap and architecture/ramp patterns. Do not pull
procedural geometry into the early menu or add another region, character set,
combat rewrite, multiplayer expansion or mobile diagnosis.

## Completed desktop previews

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
- **Developer reproduction and physical surface picking:** eighteen named UI
  destinations plus God/Fly/link controls; click teleport uses native Lite screen
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

G03 owned contexts, Chrome 86682 / CDP 10037, Vite 86633+86657 / 5873 and
compiled preview 75390 / 7074 are closed after acceptance. The VE review tab
1147996138 is also closed. No G03 owned renderer remains.
User Edge 2931 / fifteen nongame tabs, Chrome 13883 / New Tab, Orca and unrelated Vite 4000
10171+10205 are preserved. Before every live check/timing window audit pages/PIDs,
track each owner/port/URL/purpose and close owned contexts/browser/harnesses afterwards.
[Ownership procedure](debug-view.md#browser-ownership-and-performance-isolation).

Active root index.html/ashen-reach.html; Vite 5173; src/ashen-reach/main.js exposes
ASHEN. **Babylon Lite 1.31.1 / WebGPU, Havok 1.3.14**, compatible source motion.
[Focused Gothic plan](plans/gothic-exploration/plan.md), [docs map](README.md),
[character contract](character-system-north-star.md),
[equipment authoring](ashen-equipment-authoring.md), [startup](startup-load.md).
