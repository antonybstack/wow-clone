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

## Local candidate — incremental skyline startup

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

The new frozen candidate moves 44 distant, non-colliding skyline proxies to an
optional background packet. Required geometry falls **717,693 → 275,386 bytes**;
the optional skyline is 447,199 bytes. All 324 attribute ranges, starting
collision/foliage and settled geometry remain byte-exact. First play intentionally
shows the churchyard before the distant skyline arrives. Lite's native texture
promise cache overlaps the sky load; removing discarded warm fetches eliminates
eight duplicate downloads. No loader, animation or collision system is replaced.

**Latest local gates:** 120 fresh-process/cache-disabled starts pass, cohort p95
**681–903 ms**, maximum **908.5 ms**, no one-second misses (50 Mbit/s down,
10 Mbit/s up, 40 ms, 1280×720, DPR 1). Each required texture downloads once.
All 522 served files/cache policies match. Native install, one shadow refresh,
retry, late retirement and dispose checks pass with no duplicate meshes or GPU
errors. Eight injected-depth and four Weathered WebKit checks pass. The fresh
15-run hooded-ponytail confirmation passes **210.6–244.6 FPS**, maximum p99
**6.1 ms**, worst **10.9 ms**, no frame over 16.7 ms. Six pacing hints retain
their strict collector failure and are resolved by native callback/launch/control
evidence and five same-cohort rows over the inferred hard ceiling. Progressive
startup is reviewed on VE at native 1280×720 and in a full-window container;
Telegram861 returned matching1280×720 dimensions; new Web A playback review is pending.

Unchanged creator/grounding/scheduler tests and saved, mobile, contact, height and
cathedral traversal checks retain their recorded passes. The earlier 45 settled
route rows are **210–249 FPS** at native 1280×720, seven enemies, M1 Max/uncapped
Chromium WebGPU. Exact settled dependencies justify reuse; `ready` waits region,
foliage and textures after proxies retire. Statistical pacing hints, failed
controls and contaminated rows remain recorded in the result/measurement receipt.
Reviewed creator/bridge MP4s are Telegram **859 / 860**, with matching dimensions
and correct Web A inline/expanded/fullscreen proportions. New startup motion
and public timing are required for this changed candidate. A single paired
early-background diagnostic has 18–19 ms tails with and without skyline
installation; its 0.3 ms maximum difference does not establish a new skyline spike.

**M5 remains open:** the latest skyline production hood p95 is **1,038 ms**,
maximum **1,656.6 ms**, four one-second misses in20. All522 public bytes/cache
policies, bridge/tower return, saved/mobile/depth/WebKit checks pass. The manager
stopped at the failed hood cohort; original/default have not run on this release.
Earlier failures remain retained. Local timing alone does not close the release.

The next local candidate overlaps Havok setup with body transfer, gives selected
identity bodies priority over clothes, and defers exact near tree detail behind a
required conservative tree preview. Collision and settled geometry remain unchanged.
All120 local cold starts pass (p95649–867ms, max884.8ms, zero misses).
Native522 bytes, four lifecycle cases, bridge/tower return, saved8, mobile8,
depth8 and Weathered WebKit4 pass. Final15hood FPS is210.5–245.1 (maxp996.2ms,
worst11.7ms, no16.7ms frame). Native/VE motion is reviewed; Telegram 862 returned matching 1280×720 dimensions.
Commit and sealed public upload are next; M5 stays open until public cold checks and Web A playback pass.

## Production and rollback

Production is [play.sparkify.dev](https://play.sparkify.dev), **M5 candidate / catalogue v6**,
source **24dbaa41eeb96e3779a7cbd1a95cb311182e66fe**, Pages
**b07d7028-9015-43de-a857-c281f2cfc455**. The exact 523-file sealed upload is
complete; all522 public bytes/cache policies and functional checks pass. The
public hood cold check fails. Previous production for immediate rollback is
**bdc10f74-8a12-41e3-a078-935d4d7611a4** / `63433ac`. Historical M7 target
**b3fdafd8-c343-4147-ae2e-760a155c8d06** / `4063f49` has the older elevated-floor
correction defect; use the immediate preceding63433ac for loading/movement rollback.
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
  completed bounded implementation and read-only compaction/preload/critical-chain
  reviews; owns no renderer. Effective internal effort is not independently verified.
- Preserve unrelated checkout/user sessions, including the pre-existing AGENTS.md edit.
  Commit/push completed work, deliver live MP4 via `tg file`, and follow [release gates](DEPLOY.md).
- User authorizes autonomous continuation. The native goal reports `blocked`; ongoing
  work remains authorized, but hooks cannot guarantee continuation after runtime exit.
  [Continuation limits](autonomous-continuation.md).

## References

[Character contract](character-system-north-star.md), [equipment authoring](ashen-equipment-authoring.md),
[startup](startup-load.md), [docs map](README.md), [long-term vision](plans/character-mmo/vision-roadmap.md).
[Archived prior state](archive/state/CURRENT-before-focused-release-2026-10-05.md) preserves history.
