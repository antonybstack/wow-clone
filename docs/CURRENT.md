# Current state and immediate focus — Ashen Reach

Updated 2026-10-05. Read this before choosing work. Follow the latest user request;
historical milestone documents are evidence, not an active task queue.

## Immediate target

The [focused 12-hour plan](plans/character-mmo/next-12-hours-2026-10-05.md) owns
current order: **release the saved Human creator**, then prove the structural
shoulder-item factory if time remains. The factory is conditional on an accepted
creator release. [Workflow review](reviews/workflow-2026-10-05.md) records the
changes to reduce repeated checks and context use. [Next-ten](plans/character-mmo/next-ten.md)
remains the broader queue.

## Local candidate — accepted locally, production pending

Catalogue v6 retains the approved original Human, Prime bald/ponytail and
Weathered bald. Identity, height/build, gear and dyes save/reload before first
play. Preserve the approved head direction; these are authored presets.

The [M5 release result](plans/character-mmo/results/m5-shared-human-release-2026-10-05.md)
owns implementation and evidence: shared back/foot coverage, stable Havok
support on elevated floors, and a scheduler that admits renders only through
native animation-frame callbacks. The prior terrain correction sank through
bridges/towers; the final midpoint sphere sweep ignores the player's body and
refuses downward correction from embedded platforms. No sole inflation or
unverified sole-art edit is included.

**Final native Pages gates pass:** character 221/221, equipment 113/113,
ground/lifetime 14/14, scheduler 14/14, seal 4/4; all 519 served artifacts;
five cathedral ascent/return routes, four contact fixtures, 18 height routes,
eight saved identity, eight mobile, eight injected-depth and four WebKit cases.
120 fresh-process/cache-disabled local starts: cohort p95 **828–986 ms**, no
one-second misses (50 Mbit/s / 40 ms, 1280×720, DPR 1).
45 isolated route runs: **210–249 FPS**, maximum p99 **6.1 ms**, worst **11.6 ms**,
M1 Max / uncapped Chromium WebGPU / native 1280×720 / seven enemies.
Eleven statistical pacing hints are retained and independently resolved through
launch controls, native callback admission, a calibrated 60 Hz control and a
falsifying row in each cohort. The original collector failure is retained;
no acceptance row was rerun or detector threshold relaxed.

**Public release is blocked on startup:** functional gates and all 519 artifacts
pass, but the default 20-run cache-disabled cohort has p95 **1,018.7 ms**,
maximum **1,620.9 ms**, and three one-second misses (runs 1, 14, 16). The first
row includes a 775 ms GPU-completion cost; subsequent latency is before world
loading finishes. Original-largest and hooded ponytail public cohorts have not
run. Retain every failed row. M5 remains **open**. Next: test build-derived
response preload headers without changing readiness or benchmark conditions,
then complete the affected public startup gates and motion delivery.

## Production and rollback

Production is [play.sparkify.dev](https://play.sparkify.dev), **M5 candidate / catalogue v6**,
source **99acaba9e03661d5ab3208669c67d4efbf90668c**, Pages
**6272e037-01ea-4e8c-963e-5a2313564891**. The exact sealed upload is complete;
public default startup acceptance failed; functional checks pass. All 519 public bytes/cache policies and
the versioned Havok binary already match. Rollback target:
**b3fdafd8-c343-4147-ae2e-760a155c8d06** / source `4063f49` (M7 / catalogue v5).
Do not mark M5 complete until movement, public startup and Telegram delivery pass.

## Scope, limits and ownership

- Active root `index.html` / `ashen-reach.html`, Vite 5173, `src/ashen-reach/main.js`,
  global `ASHEN`. Pinned Babylon Lite 1.31.1 / WebGPU, Havok 1.3.14 and source animation.
- Human height 0.90–1.15/build −0.95…+0.95; Orc/Undead neutral only. The 6,048 valid
  mixed combinations are not all visually accepted. Elf needs a licensed source.
  Multiplayer hosting, world expansion and combat redesign are outside this window.
- Browser-cache-disabled starts do not reset OS, GPU-driver or CDN caches. Historical
  first-use GPU outliers remain limitations. Physical iPhone startup/memory/thermal
  acceptance is separate from desktop emulation/WebKit and older user ~60 FPS feedback.
- Telegram Desktop/native OS fullscreen are unavailable; verify Web A inline/expanded/
  full-window and VE playback. Boot sole silhouette and sampling aliasing remain art follow-ups.
- Root owns Chrome 51793/CDP 10037, Vite 5873 and native Pages 7175; one game renders at a
  time. Owned contexts close after each helper. User reference videos and Telegram are
  paused for measurements; restore only the two originally playing references afterward.
  [Ownership procedure](debug-view.md#browser-ownership-and-performance-isolation);
  dated inventory `.cache/character-mmo/m5-moving-fit-2026-10-05/ownership.md`.
- Claude terminal `term_d4cf5b10-02ae-4b08-abfb-9c35d86ef78b`, selected Opus 5.5 / high,
  completed bounded scheduler/review/receipt tasks, owns no renderer and is idle.
- Preserve unrelated checkout/user sessions, including the pre-existing AGENTS.md edit.
  Commit/push completed work, deliver live MP4 via `tg file`, and follow [release gates](DEPLOY.md).
- User authorizes autonomous continuation. The native goal reports `blocked`; ongoing
  work remains authorized, but hooks cannot guarantee continuation after runtime exit.
  [Continuation limits](autonomous-continuation.md).

## References

[Character contract](character-system-north-star.md), [equipment authoring](ashen-equipment-authoring.md),
[startup](startup-load.md), [docs map](README.md), [long-term vision](plans/character-mmo/vision-roadmap.md).
[Archived prior state](archive/state/CURRENT-before-focused-release-2026-10-05.md) preserves history.
