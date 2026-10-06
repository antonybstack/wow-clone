# Current state and immediate focus — Ashen Reach

Updated 2026-10-06. Read this before choosing work. Follow the latest user request;
historical milestone documents are evidence, not an active task queue.

## Immediate target

Restore the **public one-second startup target**. Production remains `6004840`
with the historical clean failure: p95 **1,219.6 ms**, maximum **1,358.5 ms**,
14/20 misses. M10 landscape is functionally live; complete release/startup and
physical-device acceptance remain open.

The [saved-startup bundling candidate](plans/character-mmo/results/startup-bootstrap-2026-10-06.md)
uses native Rolldown to co-locate pure saved validation/descriptors and shared
fetch helpers. Source **`03dfbc7` is pushed**; opt in with
`ASHEN_SAVED_BOOTSTRAP=1` (default builds retain the released split graph).
33 tests and ten live functional checks pass; all character assets/Lite bytes
are unchanged. Local saved starts improve from 873–876 to 829–836 ms, with
about 3.6 KiB additional modelled gzip code for unsaved starts. Public paired
results are mixed. Preview **`498be045-42c7-4d89-8ee4-7580b9291ad1`** passes
537 delivery checks, but its strict twenty-start gate **fails**: p95 **952.3 ms**,
maximum **1,025.1 ms**, one miss. **Do not promote or claim the target met.**
Local `dist` contains this experimental flag-1 build, not the production build.

Three production-host diagnostics are **1,265 / 925 / 1,988 ms**. Late HTML and
one 1,157 ms body-cache MISS dominate. The response headers differ from the
immutable Pages host. Navigation is h2 while some assets use h3; CF-Ray suffixes
can identify an origin-facing cache tier, so neither a physical route nor an
HTTP/3 defect is established. The deployment token's DNS request returns 403;
Edge's Cloudflare dashboard is signed out. An optional user sign-in request is
pending in tab **1147995760**. With access, inspect the custom-domain cache/origin
rules and available request logs. No settings have been changed.

Code work can continue independently: the candidate's sole miss delays the tiny
early entry facade until 322.5 ms and body discovery until 340.3 ms. Inspect actual
browser priorities for that critical graph before trying native fetch priority.
Do not repeat large cohorts without a changed candidate. Keep source, capture
and timing windows separate; Grok owns operations and root owns implementation.

Closed investigations: [extra hints/Brotli/accessor dedup](plans/character-mmo/results/startup-transport-2026-10-06.md)
and [normal-only packing](plans/character-mmo/results/startup-normals-2026-10-06.md).
Normal rounding passes six tests/nine offline asset proofs and saves 209,829 bytes
(~33.57 ms theoretical at 50 Mbit/s), but is not integrated or published. Fixed
normal quantization would clamp morph offsets and is rejected. Normal rounding
may buy later margin; it does not explain the custom-host delivery outlier.

After startup, return to remaining concrete M6 mixed-fit risks. Elf source/licensing
and physical-device acceptance remain separate; region/multiplayer plans are parked.

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
- **All owned game instances are closed.** Final root audit finds no Chrome
  game browser and ports 5173/5873/7074/7075/10037/9337 free. Grok 4.6/high
  operations session `01a11217-d931-71f0-8394-6c90b41f1187` and asset worker
  `01a11251-865b-7961-82f2-3af28b4e96bc` are finished. Probe ownership files
  are inactive. Evidence: `.cache/character-mmo/startup-bootstrap-2026-10-06/`.
- Temporary media autoplay guards removed; prior playback restored (three Telegram
  videos and the first Shadowglass video playing). Pause/audit again before timing.
  User Edge 2931/Orca 1889 preserved. The sole owned browser follow-up is the
  signed-out Cloudflare tab 1147995760, held for optional user sign-in; no game page.
- [Grok operations workflow](reviews/workflow-2026-10-05.md#current-operating-rule--2026-10-06):
  delegate operations exclusively to Grok; root implements and reviews. Freeze
  product inputs for gates; one worker owns browser/timing. Preserve unrelated
  AGENTS.md edits and caches. Source is committed/pushed; final docs need no rebuild.
- Native goal is **active**, verified 2026-10-06. Continue between checkpoints;
  do not wait for another proceed. [Continuation limits](autonomous-continuation.md).

## References

[Character contract](character-system-north-star.md), [equipment authoring](ashen-equipment-authoring.md),
[startup](startup-load.md), [docs map](README.md), [vision](plans/character-mmo/vision-roadmap.md).
