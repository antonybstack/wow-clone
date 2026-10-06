# Current state and immediate focus — Ashen Reach

Updated 2026-10-06. Read this before choosing work. Follow the latest user request;
historical milestone documents are evidence, not an active task queue.

## Immediate target

Restore the **public one-second startup target**. The [M10 landscape package](plans/character-mmo/results/m10-landscape-2026-10-06.md)
is functionally live: usable 568×320 and 844×390 creator layouts, reviewed motion,
repaired CDN bundle delivery and preserved HTML cache headers. **Final clean
startup still fails: p95 1,219.6 ms, worst 1,358.5 ms, 14/20 misses.** Do not call
the complete release or physical-device milestone accepted.

Next investigate actual HTTP 103 Early Hints and existing Cloudflare delivery
configuration on the custom domain. In final row 1, the document finishes at
256.4 ms and startup module requests begin at 257.8 ms. A Link header alone is
not proof of early fetching. Use the existing transport trace and native provider
features before changing game assets or adding loading infrastructure. Choose a
small discriminating check before another 20-start cohort. Then return to the
remaining concrete M6 mixed-fit risks. Elf source/licensing and physical-device
acceptance remain separate; historical region/multiplayer plans are parked.

## Current release

Production [play.sparkify.dev](https://play.sparkify.dev) runs source
**6004840807cb47a908fb47dd87848f49f39f3268**, Pages
**e39117b8-db74-4563-a6c0-b428c8d5d10e**
([deployment](https://e39117b8.fardel.pages.dev)). Preview
**b37875cf-20ea-4040-9f96-6e1f1ab3b82f** and production use the same sealed bytes.
Rollback reference: **578dd30 / b9273b21-5ee5-4d4c-acbe-a7d99f5c1877**.

All **538 served files** and two missing-file controls pass byte/MIME/cache
verification on preview and production. Missing assets return **404/no-store**.
The native Vite `assets/v2` namespace avoids previously polluted bundle URLs;
a top-level 404 disables Pages' HTML fallback. Early Hints are inserted into
existing route blocks: duplicate exact paths previously discarded Cache-Control
in Cloudflare's configuration map. HTML aliases now retain max-age=60 and Link.
The header-only follow-up changes exactly `_headers` among 539 sealed paths;
game/HTML/assets are identical to 578dd30. Twenty-three focused unit tests pass.

The creator fix gives a 338×162 preview at 568×320 (previously 338×108), keeps
camera/motion controls reachable, and preserves Close through scrolling/rotation.
Native checks cover seven viewports, touch orbit/scroll, keyboard modal navigation,
identity/race/shape changes, source motion and disposal. Preview entry/creator/
mobile/depth/WebKit and normal Havok cathedral traversal pass; public entry,
creator/mobile and traversal pass. No recorded runtime/GPU errors or recoveries.

**Final isolated performance:** M1 Max, uncapped Chromium WebGPU, native
1280×720/DPR 1, seven enemies, three 12-second bridge runs:
**244.38 / 246.20 / 250.27 FPS**, maximum p99 **5.4 ms**, worst **10 ms**, no interval
above 16.7 ms. One tracked game renderer, recording/encoding off, media explicitly
paused and guarded. Throughput is not physical display-refresh frequency.
The first final run retains a statistical cap hint despite the uncapped launch;
raw hints remain in the receipt. The prior five-route baseline remains 209.8–245.7 FPS, maximum p99 6.2 ms.

**Startup:** the final clean 20-start hood/Bastion cohort has p95 **1,219.6 ms**,
worst **1,358.5 ms**, **14 misses**, all valid grounded starts without errors.
Fresh processes/profiles, disabled HTTP cache, 50 Mbit/s down/10 up/40 ms latency;
OS/GPU-driver/CDN caches are uncontrolled. Earlier failed, disrupted and potentially
media-contaminated diagnostics remain in the [result and receipt](plans/character-mmo/results/m10-landscape-2026-10-06.md).
The [older accepted 969.4 ms result](plans/character-mmo/results/startup-catalogue-2026-10-06.md)
is historical, not today's public claim. New Telegram videos can autoplay after a
previous audit; final timing must follow delivery/review and a fresh media audit.

Reviewed motion: Telegram **868** ([568×320 VE MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/m10-landscape-2026-10-06-568x320.mp4))
and **869** ([844×390 VE MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/m10-landscape-2026-10-06-844x390.mp4)).
Exact returned dimensions, matching VE hashes and range 206. Native local playback,
Telegram Web A inline/expanded/VIDEO fullscreen and VE remote playback/fullscreen
preserve proportions. Physical phone and Telegram Desktop remain unverified.

## Scope, limits and ownership

- Active root `index.html` / `ashen-reach.html`, `src/ashen-reach/main.js`, `ASHEN`.
  Babylon Lite 1.31.1/WebGPU, Havok 1.3.14, compatible source animation.
- M5 saved identities and bounded M8 rigid-item factory proof remain implemented.
  Original/Prime bald/ponytail/Weathered bald, gear and dyes save before dressed
  first play. Catalogue v7 includes Bastion shoulders on all supported races.
  Human height 0.90–1.15/build −0.95…+0.95; Orc/Undead neutral only.
- M6 [mixed review](plans/character-mmo/results/m6-mixed-fit-2026-10-06.md) and
  [continuous clearance](plans/character-mmo/results/m6-clearance-2026-10-06.md)
  found no new gross fit failure. They do not certify all 9,072 valid combinations.
  Boot sole silhouette/aliasing, broader cloth authoring, licensed Elf source and
  physical iPhone startup/memory/thermal checks remain explicit follow-ups.
- **Owned game instances are closed:** Chrome 1643/CDP 10037, Vite 1613/1637
  on 5873, preview 13546 on 7074 and every probe context. The three ports are free;
  harness slot 7 is removed. Grok 4.6/high operations session
  `01a11217-d931-71f0-8394-6c90b41f1187` owns only final ledger association,
  no renderer. Evidence: `.cache/character-mmo/m10-landscape-2026-10-06/`.
- Owned media wrapper closed. Telegram paused, temporary play guard removed after
  final timing. The user's originally playing first Shadowglass video is restored;
  its second remains paused. User Edge/Orca preserved, no Edge game pages.
- [Grok operations workflow](reviews/workflow-2026-10-05.md#current-operating-rule--2026-10-06):
  delegate operations exclusively to Grok; root implements and reviews. Freeze
  product inputs for gates; one worker owns browser/timing. Preserve unrelated
  AGENTS.md edits and caches. Source is committed/pushed; final docs need no rebuild.
- Native goal is **active**, verified 2026-10-06. Continue between checkpoints;
  do not wait for another proceed. [Continuation limits](autonomous-continuation.md).

## References

[Character contract](character-system-north-star.md), [equipment authoring](ashen-equipment-authoring.md),
[startup](startup-load.md), [docs map](README.md), [vision](plans/character-mmo/vision-roadmap.md).
