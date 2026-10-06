# Current state and immediate focus — Ashen Reach

Updated 2026-10-06. Read this before choosing work. Follow the latest user request;
historical milestone documents are evidence, not an active task queue.

## Immediate target

[Active startup goal](plans/character-mmo/startup-goal-2026-10-06.md): largest saved
hood/Bastion outfit below one second p95 in a fixed isolated production cohort,
with unchanged art/physics and over 120 FPS. Implementation and verification are
in progress; the current release below remains the accepted baseline.

The [focused 12-hour plan](plans/character-mmo/next-12-hours-2026-10-05.md) delivers
its primary **saved Human creator release** and conditional **rigid shoulder factory/content
release**. M5 and the bounded M8 proof are accepted on production. Next: attribute
and improve the largest hooded outfit's startup headroom, then return to M6's boot
sole and mixed-outfit visual evidence. Do not expand the startup payload first.
[Workflow review](reviews/workflow-2026-10-05.md) records useful parallel work and
avoidable retries; [next-ten](plans/character-mmo/next-ten.md) retains broader open exits.

## Current release

Production [play.sparkify.dev](https://play.sparkify.dev) is source
**0d577d27cc53bca05b2f695c45922458cf54c0b0**, Pages
**f6265788-d4fd-45fe-abae-76f9c3d23247**. Havok's identical WASM now uses native HTTP
Brotli: **501,493 bytes**, 21.8% smaller than the previous production transfer.
All **537 served files** match the exact sealed build. Native streaming/preload,
cathedral round trip, mobile eight, depth-fallback eight and WebKit four pass.
Rollback: M8 source **5fba4d8**, Pages **63b6e02b-c93f-4b85-aebf-f2ae79bfb8a6**.
[Startup result](plans/character-mmo/results/startup-headroom-2026-10-05.md) and
[receipt](baselines/character-mmo/startup-headroom-2026-10-05/receipt.json) own evidence.
The one-second largest-outfit target remains **open**. A faster world-only warmup
was rejected for bind-pose/GPU regressions and is absent from production and HEAD.
Keep actor-before-first-register ordering; investigate the existing validated body
fetch dependency next, then return to M6. Do not repeat the rejected warmup.

Catalogue v7 adds Bastion shoulders for Human, Orc and Undead, preserving frozen
v1–v6 save registries. The [factory](equipment-factory.md) reuses Blender, glTF
Transform, Meshoptimizer, existing shape/coverage/native bounds and publication.
Four artifacts repeat byte-for-byte on this host. Actual Armory, seven fits,
source motion with sword/greatstaff, Havok run/turn/jump/Fire Blast, dyes, save,
failure/retry, cancellation and disposal pass 17 native cases. The gameplay actor
queue now permits the existing loader to cancel obsolete same-slot intent, and
refuses unauthorized online edits before invalidating admitted work.

The approved original, Prime bald/ponytail and Weathered bald Human identities,
height/build, gear and dyes remain saved before dressed first play. 258 existing asset files
are unchanged, with no missing or changed existing asset binary. [M5 result](plans/character-mmo/results/m5-shared-human-release-2026-10-05.md)
records repaired shared back/foot coverage, elevated Havok support, native RAF-only
render admission and progressive world readiness. Starting collision and all
324 original world geometry ranges remain exact.

**Final native performance:** M1 Max, uncapped Chromium WebGPU, native 1280×720/DPR 1,
seven enemies, three 12-second runs on each of five routes, largest hooded Bastion
save. All 15 runs measure **209.8–245.7 FPS**, maximum p99 **6.2 ms**, worst interval
**11.4 ms**, none above 16.7 ms. No >5% loss against the recorded Warden control.
Recording/encoding/media playback are excluded. Statistical pacing hints stay
recorded and are independently resolved; these are not physical display-refresh claims.

**Latest bridge check:** three isolated native runs on the new release measure
**242.6–247.8 FPS**, maximum p99 **5.5 ms**, worst interval **9.7 ms**, seven enemies.
The earlier M8 five-route performance matrix above remains the broader baseline.

**Startup:** 20 final local hood starts have p95 **885.8 ms**. Public 20 per profile
have p95 **746.2 / 881.9 / 1,021.6 ms** for default/original-largest/new hood.
The hood misses one second twice (runs 9 and 11); no claim of completing that target.
Conditions: fresh Chromium processes/profiles, HTTP cache disabled, decimal
50 Mbit/s down, 10 up, 40 ms latency, native 1280×720/DPR 1. See the result for
retained exploratory, first-use GPU, local emulator and rejected-warmup failures.

Reviewed released motion is Telegram **864**, returned 1280×720, and
[VE video/mp4](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/havok-startup-2026-10-05.mp4).
The 19.449-second timestamped capture preserves square pixels and zero rotation.
Telegram Web A inline/expanded/actual VIDEO fullscreen and direct VE normal
playback have correct proportions. VE fullscreen for this clip, Telegram Desktop
and physical iPhone acceptance were not verified this pass.

## Scope, limits and ownership

- Active root `index.html` / `ashen-reach.html`, `src/ashen-reach/main.js`, global `ASHEN`.
  Pinned Babylon Lite 1.31.1 / WebGPU, Havok 1.3.14 and source-compatible animation.
- Human height 0.90–1.15/build −0.95…+0.95; Orc/Undead neutral only. The 9,072 valid
  mixed catalogue combinations are not all visually accepted. Factory proof covers
  rigid armor; cloth, arbitrary proportions and Elf source/licensing remain open.
  Public multiplayer hosting and world/combat expansion are outside this package.
- Browser-cache-disabled starts do not reset OS, GPU-driver or CDN caches. Physical
  iPhone startup/memory/thermal acceptance remains separate from emulation/WebKit
  and the user's earlier ~60 FPS feedback. Boot sole silhouette and sampling
  aliasing remain art follow-ups. M6 and the full M9/M10 exits are not closed.
- **Owned instances are closed:** Chrome 80497/CDP 10037, Vite 5873, compressed
  preview 7074, Pages 7175, every probe browser and temporary media tab. User
  Edge/Orca sessions remain; only the two originally playing references are
  restored. Telegram/other X stay paused; temporary media guards removed.
  [Ownership procedure](debug-view.md#browser-ownership-and-performance-isolation),
  inventory `.cache/character-mmo/startup-headroom-2026-10-05/ownership.md`.
- Existing Claude terminal `term_d4cf5b10-02ae-4b08-abfb-9c35d86ef78b`, selected Opus
  5.5/high, completed bounded implementation/docs and adversarial reviews; no renderer.
  Effective internal effort is not independently verified. Preserve its existing draft.
- Preserve unrelated checkout work, especially the pre-existing AGENTS.md edit and
  local caches. Product source is committed/pushed and released. Final receipts/docs
  do not require another build or performance matrix.
- User authorizes autonomous continuation. Native continuation-goal state remains
  `blocked`; hooks cannot guarantee continuation after runtime exit. There is no
  access blocker for the work just delivered. [Continuation limits](autonomous-continuation.md).

## References

[Character contract](character-system-north-star.md), [equipment authoring](ashen-equipment-authoring.md),
[startup](startup-load.md), [docs map](README.md), [vision](plans/character-mmo/vision-roadmap.md).
