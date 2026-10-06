# Current state and immediate focus — Ashen Reach

Updated 2026-10-06. Read this before choosing work. Follow the latest user request;
historical milestone documents are evidence, not an active task queue.

## Immediate target

[Startup goal](plans/character-mmo/startup-goal-2026-10-06.md) achieved under the
recorded conditions: largest saved hood/Bastion outfit **969.4 ms p95**, all 20
production starts below one second, with unchanged art/physics and over 120 FPS.
[M6 mixed-fit checkpoint](plans/character-mmo/results/m6-mixed-fit-2026-10-06.md)
adds **864 reviewed live views, 18 mixes, eight profiles** and Telegram **866**
([motion](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/m6-mixed-fit-2026-10-06.mp4)).
No new gross fit failure reproduced; reusable validation only, no product changes.
Next: targeted continuous hood/coat/robe/Bastion and exposed-cuff motion at Human
shape corners. M6's broad visual exit stays open; preserve the startup baseline.

The [focused 12-hour plan](plans/character-mmo/next-12-hours-2026-10-05.md) delivers
its primary saved Human creator release and bounded rigid shoulder factory proof.
M5 and the bounded M8 proof are accepted on production.
[Workflow review](reviews/workflow-2026-10-05.md) records useful parallel work and
avoidable retries; [next-ten](plans/character-mmo/next-ten.md) retains broader open exits.

## Current release

Production [play.sparkify.dev](https://play.sparkify.dev) is source
**08f9bbe5391fde6b3fd74b4756470e43300bd139**, Pages
**b80c188b-c5a0-422b-9d57-c9201d8a740f**. Build-verified identity runtime JSON in
HTML removes a dependent catalogue fetch while reusing the validated shared loader.
The complete authoring audit remains published separately. All **537 served files**
match the sealed build; **281 character/world/physics assets** are unchanged.
Havok retains native HTTP Brotli delivery (501,493 encoded bytes).
Rollback: **0d577d2**, Pages **f6265788-d4fd-45fe-abae-76f9c3d23247**.
[Startup result](plans/character-mmo/results/startup-catalogue-2026-10-06.md) and
[receipt](baselines/character-mmo/startup-catalogue-2026-10-06/receipt.json) own evidence.
Unit 20, native entry three, saved identity eight, mobile eight, depth-fallback eight,
WebKit four and cathedral round trip pass. Keep actor-before-first-register ordering;
the rejected world-only warmup remains absent from production and HEAD.

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
**242.6–246.8 FPS**, maximum p99 **5.5 ms**, worst interval **9.9 ms**, seven enemies.
The earlier M8 five-route performance matrix above remains the broader baseline.

**Startup:** fixed production cohorts of 20 each have p95 **743.1 / 851.2 / 969.4 ms**
for default/original-largest/new hood, **zero one-second misses in all 60 starts**.
Hood maximum is **984.2 ms**. Conditions: M1 Max, fresh Chromium processes/profiles,
HTTP cache disabled, decimal 50 Mbit/s down, 10 up, 40 ms latency, native
1280×720/DPR 1. OS/GPU-driver/CDN caches are not reset. The result retains all slower
exploratory cohorts, including an unexplained first-use GPU completion stall.

Reviewed released motion is Telegram **865**, returned 1280×720, and
[VE video/mp4](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/startup-catalogue-08f9bbe.mp4).
The 18.448-second timestamped capture preserves square pixels and zero rotation.
Telegram Web A inline/expanded/actual VIDEO fullscreen and VE-hosted normal/native
fullscreen playback retain proportions. VE used a local HTML wrapper loading the
remote MP4 after direct document inspection stalled. Telegram Desktop and physical
iPhone acceptance were not verified this pass. Recording is not a benchmark.

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
- **Owned instances are closed:** latest M6 Chrome 44590/CDP 10037 and Vite
  44560 on 5873, all probe contexts and the temporary media review tab. No owned
  game listeners/processes remain. Telegram is paused; user Edge/Orca preserved.
  No FPS benchmark was performed for this validation-only change.
  [Ownership procedure](debug-view.md#browser-ownership-and-performance-isolation),
  inventory `.cache/character-mmo/m6-mixed-fit-2026-10-06/ownership.md`.
- Existing Claude terminal `term_d4cf5b10-02ae-4b08-abfb-9c35d86ef78b`, selected Opus
  5.5/high, completed bounded implementation/docs and adversarial reviews; no renderer.
  Effective internal effort is not independently verified. Preserve its existing draft.
- Preserve unrelated checkout work, especially the pre-existing AGENTS.md edit and
  local caches. Product source is committed/pushed and released. Final receipts/docs
  do not require another build or performance matrix.
- User authorizes autonomous continuation. Native continuation-goal state remains
  `blocked` on the 2026-10-06 recheck. Resume in the goal progress row is required
  to reactivate the scheduler; available tools cannot resume it, and Computer Use
  access to the Codex app was denied. Checkpoints do not require user review or a
  new “continue.” Hooks cannot guarantee continuation after runtime exit. There is no
  access blocker for the work just delivered. [Continuation limits](autonomous-continuation.md).

## References

[Character contract](character-system-north-star.md), [equipment authoring](ashen-equipment-authoring.md),
[startup](startup-load.md), [docs map](README.md), [vision](plans/character-mmo/vision-roadmap.md).
