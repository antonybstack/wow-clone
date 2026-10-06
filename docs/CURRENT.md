# Current state and immediate focus — Ashen Reach

Updated 2026-10-05. Read this before choosing work. Follow the latest user request;
historical milestone documents are evidence, not an active task queue.

## Immediate target

The [focused 12-hour plan](plans/character-mmo/next-12-hours-2026-10-05.md) owns
current order: **release the saved Human creator**, then prove the structural
shoulder-item factory if time remains. **M5 is accepted on production.** Next is the conditional shoulder-item factory
and one verified content update, using the remaining working budget.
[Workflow review](reviews/workflow-2026-10-05.md) records delivery improvements;
[next-ten](plans/character-mmo/next-ten.md) remains the broader queue.

## Current release

Production [play.sparkify.dev](https://play.sparkify.dev) is source
**69342921618baaf1286d922e942facd1f4440494**, Pages
**f82f8e2e-0b77-4fff-a5bf-a8e2544aac0b**. The exact tested 523-file sealed
build is uploaded and all public gates pass. Immediate rollback is Pages
**b07d7028-9015-43de-a857-c281f2cfc455** / `24dbaa4`; it loads and traverses
correctly but failed the public hood timing gate. New loading and movement pass;
rollback was not needed.

Catalogue v6 preserves the original Human and adds approved Prime bald/ponytail
and Weathered bald presets. Identity, height/build, gear and dyes save/reload
before the first dressed playable frame. The [M5 result](plans/character-mmo/results/m5-shared-human-release-2026-10-05.md)
owns detailed implementation, failed controls and evidence. Shared back/foot
coverage is repaired through original triangle partitions. Havok grounding uses
the existing midpoint sphere sweep, excluding the player's body and refusing
downward correction from embedded platforms. The scheduler admits renders only
through native animation-frame callbacks.

Startup reuses native texture promises and overlaps existing Havok setup with
body transfer. Identity bodies have high fetch priority, clothes low. Required
world geometry is **149,963 bytes**. Exact near branches and 44 distant skyline
proxies load in the optional **593,607-byte** packet. A required 521-triangle
conservative Meshopt preview keeps trunks visible; it retires when its exact
blocks arrive. Starting collision/foliage and all 324 old geometry ranges remain
byte-exact; settled scene geometry is unchanged.

**Final local gates:** all 120 fresh-process/cache-disabled starts pass, cohort
p95 **649–867 ms**, maximum **884.8 ms**, zero one-second misses. Conditions:
M1 Max, 50 Mbit/s down / 10 up / 40 ms latency, native 1280×720, DPR 1.
Native 522 served files/cache policies, four install/retry/retire/dispose cases,
bridge/tower return, saved eight, mobile eight, depth eight and Weathered WebKit
four pass. The fresh 15-run hooded-ponytail route confirmation measures
**210.5–245.1 FPS**, maximum p99 **6.2 ms**, worst **11.7 ms**, no interval above
16.7 ms. Statistical pacing hints remain recorded and independently resolved
against launch flags, calibrated callback controls and same-cohort hard-ceiling
counterexamples. Unchanged suites and settled dependencies retain their recorded
passes; the receipt distinguishes reused evidence from fresh measurements.

Reviewed creator/bridge motion is Telegram **859 / 860**, with correct Web A
inline/expanded/fullscreen proportions. Final progressive startup is Telegram
**862**, returned 1280×720 dimensions, and [VE](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/m5-near-tree-startup-2026-10-05-98fac6371083.mp4).
Source frames and direct VE normal/full-window playback are reviewed. Telegram
862 has correct Web A inline, expanded and actual browser video fullscreen
proportions (1280×720 source, contain scaling with side letterboxing). Square pixels, zero rotation and capture timestamps
preserve proportions and elapsed time. Recording HUD/timing is excluded from
benchmark claims.

**Final public startup:** 60 fresh-process/cache-disabled starts pass: default
p95 **780.7 ms**, original largest **922.5 ms**, hooded ponytail **946 ms**;
maximum **960.1 ms**, zero one-second misses or validation failures. Conditions
match the local prescription. All 522 public files/cache policies, bridge/tower
round trips, saved eight, mobile eight, depth eight and Weathered WebKit four pass.
Earlier public misses and first-use GPU outliers remain retained in the receipt.

## Scope, limits and ownership

- Active root `index.html` / `ashen-reach.html`, Vite 5173, `src/ashen-reach/main.js`,
  global `ASHEN`. Pinned Babylon Lite 1.31.1 / WebGPU, Havok 1.3.14 and source animation.
- Human height 0.90–1.15/build −0.95…+0.95; Orc/Undead neutral only. The 6,048 valid
  mixed combinations are not all visually accepted. Elf needs a licensed source.
  Multiplayer hosting, world expansion and combat redesign are outside this window.
- Browser-cache-disabled starts do not reset OS, GPU-driver or CDN caches. Historical
  first-use GPU outliers remain limitations. Physical iPhone startup/memory/thermal
  acceptance is distinct from desktop emulation/WebKit and older user ~60 FPS feedback.
- Telegram Desktop is unavailable. Telegram Web A actual browser video fullscreen
  is verified. Direct VE fullscreen control did not enter fullscreen; normal/full-window
  contain playback is reviewed.
  Boot sole silhouette and sampling aliasing remain recorded art follow-ups.
- Root owns Chrome 51793/CDP 10037, Vite 5873 and native Pages 7175; one game renders
  at a time. Public helpers own sequential temporary contexts/fresh processes and close
  them. User reference videos and Telegram remain paused during measurements; restore
  only the two originally playing references afterward. [Ownership procedure](debug-view.md#browser-ownership-and-performance-isolation);
  dated inventory `.cache/character-mmo/m5-moving-fit-2026-10-05/ownership.md`.
- Existing Claude terminal `term_d4cf5b10-02ae-4b08-abfb-9c35d86ef78b`, selected Opus
  5.5 / high, completed bounded implementation and read-only reviews; owns no renderer.
  Effective internal effort is not independently verified. Preserve its existing draft.
- Preserve unrelated checkout/user sessions, including the pre-existing AGENTS.md edit.
  Commit/push completed work, deliver live MP4 via `tg file`, and follow [release gates](DEPLOY.md).
- User authorizes autonomous continuation. Native goal status is `blocked`; authorized
  work continues, but hooks cannot guarantee continuation after runtime exit.
  [Continuation limits](autonomous-continuation.md).

## References

[Character contract](character-system-north-star.md), [equipment authoring](ashen-equipment-authoring.md),
[startup](startup-load.md), [docs map](README.md), [long-term vision](plans/character-mmo/vision-roadmap.md).
[Archived prior state](archive/state/CURRENT-before-focused-release-2026-10-05.md) preserves history.
