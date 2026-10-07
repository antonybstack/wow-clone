# Current state and immediate focus — Ashen Reach

Updated 2026-10-06. Read this before choosing work. Follow the latest user request;
historical milestone documents are evidence, not an active task queue.

## Immediate target

**Next priorities:** startup reliability and meaningful one-second headroom;
release accepted improvements through the existing gates; a new skinned
Fieldcoat through the factory; current physical iPhone acceptance. The
[five-priority plan](plans/character-mmo/five-priorities-2026-10-06.md) preserves
the active goal. Progress independent cloth work while the startup release hold
is open; do not spend another turn repeating unchanged cold cohorts.

**Resumed diagnostic checkpoint:** 29 focused tests, the flag-1 build, all three
entry aliases, four built-game failure controls and default/maximum full-region
movement pass. Request/decode errors now name the asset URL and failed operation while retaining
the native cause, including decoding after HTTP 200. Six correctly pinned
maximum-outfit diagnostics pass on production/candidate; the original public
failure remains unexplained. The earlier production probe used the wrong local
catalogue and is explicitly invalid. Reorder and animation resampling are
rejected; unpublished position rounding saves only 82,440 maximum-outfit bytes,
about 13.2 ms of theoretical transfer. No new public release gate or production
promotion has occurred. [Result and receipt](plans/character-mmo/results/startup-resume-2026-10-06.md).
Local `dist` is rebuilt from the diagnostic source with `ASHEN_SAVED_BOOTSTRAP=1`;
old preview seals do not describe it. Current physical-device inventory has no
connected iPhone.

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

The native-priority hypothesis is closed: two instrumented visits show the early
facade, shared store, renderer and body already request at High priority, without
priority changes. Do not add ineffective `fetchpriority` attributes or replace the
failed gate with these diagnostics (968.8/887.6 ms).

**Current candidate:** compact normal precision, source **`cf43894` pushed**,
preview **`5f312add-f747-477d-bc8a-9b583028e2a0`**
([immutable preview](https://5f312add.fardel.pages.dev)). Native meshoptimizer
rounds eligible compact normals offline; the GLB loader is unchanged. Full
assets, protected hood, rigid pieces and non-normal source attributes remain
exact. 61 asset/proof tests, ten prefetch checks, eleven compact-identity live
cases and 536 public delivery checks pass. Reviewed motion is on Telegram **870**
and [VE](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/startup-normal-2026-10-06-prime-ponytail.mp4).
Telegram inline/expanded and VE inline playback preserve proportions; this
browser rejected fullscreen requests, so fullscreen is not re-verified.

The historical hood/cloth/Bastion fixture saves **180,324 bytes** and is now
**1,986,208 bytes**. It was incorrectly described as the largest outfit.
The new catalogue-derived fixture enumerates 9,072 valid loadouts across four
Human profiles: Prime ponytail, hood, Duskguard chest/boots/gloves, Graveweaver
skirt and Bastion shoulders total **2,300,424 compact asset bytes**. Procedural
staff/book are retained. Three fixture tests and independent sums pass.
The maximum payload is not necessarily the slowest rendering workload.

**Latest public gates:** entry, normal traversal, mobile touch/depth and WebKit
pass. Maximum-outfit routes measure **201–244 FPS**, p99 <=6.2 ms, worst 11.2 ms,
no >16.67 ms intervals. Possible 240 Hz pacing hints remain explicit; these are
not confirmed uncapped limits. The two strict twenty-start cold gates fail:
maximum outfit p95 **1,001 ms**, worst **1,177.1 ms**, 2 misses; historical outfit
p95 **936.9 ms**, worst **1,220.9 ms**, 1 miss. All forty starts are grounded,
dressed and responsive without recorded errors. **Do not promote.**

**Latest preview is rejected:** source **`1de0bba`**, immutable
[05f75b6e](https://05f75b6e.fardel.pages.dev), changes only the two HTML aliases.
The neutral preload now precedes blocking CSS; 23 focused tests, ten prefetch
cases and local/public held-CSS discovery checks pass. All 536 delivery checks
pass. However bare-root entry times out, and cold cohorts record **14 failed
starts out of 60**, each with `TypeError: Failed to fetch`: default 6, maximum 5,
historical 3. Valid-row worst times are 1,704.4 / 1,954.9 / 2,227.7 ms respectively;
these exclude failed starts and do not qualify the cohorts. Production is unchanged.

**Diagnostic checkpoint:** three entry aliases, six alternating fresh contexts
on the old/new previews and six new browser processes now load successfully.
The fresh-process diagnostic is **705.7–882.6 ms**, grounded and responsive with
no recorded errors; it does not replace the failed release cohorts. Root reviewed
its actual starting-area capture. An intentionally failed local fetch verifies
that both updated probes retain the failing URL, native network error and loading
stack, exit nonzero in under one second, and clean up. No runtime patch is justified
by the current evidence; the public failure has not reproduced and remains unexplained.

**Next bounded investigation:** if the failure recurs, use the retained overlay
stack and failed-request URL to isolate its actual loader/transport path. Do not
add speculative retries or claim that subsequent successful diagnostics fix it.
A new release still requires complete clean entry and declared startup gates;
production has not changed. Evidence:
[candidate result](plans/character-mmo/results/startup-normal-release-2026-10-06.md),
[failed cohorts](baselines/character-mmo/startup-normal-release-2026-10-06/css-public-failure.json),
[diagnostic receipt](baselines/character-mmo/startup-normal-release-2026-10-06/fetch-diagnostic.json).

Closed investigations: [extra hints/Brotli/accessor dedup](plans/character-mmo/results/startup-transport-2026-10-06.md).
The [normal investigation](plans/character-mmo/results/startup-normals-2026-10-06.md)
is historical offline evidence; its integration is reopened because the bundling
preview's remaining miss is 25 ms, rather than the original 100–220 ms gap. Fixed
normal quantization would clamp morph offsets and remains rejected.

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
- **Browser cleanup complete:** resumed comparison worker
  `01a114a1-6ad7-7172-a27e-552436cda52c` closed all six fresh-process probes.
  Resource worker `01a114b2-9e82-73d3-bc12-794666993e79` owned slot 7: Chrome
  909/CDP 10037, Vite 857/880 on 5873 and compressed preview 787 on 7074.
  All live contexts closed. Root audited the remaining about:blank page, stopped
  that harness and exact preview PID, then confirmed no owned Chrome/probe/preview
  process or listener on any of those ports. The report-only continuation
  finished; the independent source review found no consequential defect.
  Offline position worker
  `01a114b6-b6d9-7831-a8c2-8ed0716858af` started no renderer and is terminal.
- VE review tab 1147995772 and wrapper server 5966 remain closed. Temporary
  Telegram/Shadowglass playback guards were removed after diagnostics. Original
  connected media received their prior playback state; Shadowglass is restored,
  Telegram's own playback behavior leaves two videos playing/two paused. One
  old Telegram node had detached and was not replaced or manipulated.
  User Edge 2931 and current Orca 98938 remain intact (old Orca 1889 has exited).
  Cloudflare tab 1147995760 remains signed out for optional user sign-in.
- [Grok operations workflow](reviews/workflow-2026-10-05.md#current-operating-rule--2026-10-06):
  delegate operations exclusively to Grok; root implements and reviews. Freeze
  product inputs for gates; one worker owns browser/timing. Preserve unrelated
  AGENTS.md edits and caches. Source is committed/pushed; final docs need no rebuild.
- Native goal reports **active** on the resumed tool read; all five priorities
  are not complete. User authorization remains autonomous implementation and
  verification. [Continuation limits](autonomous-continuation.md).

## References

[Character contract](character-system-north-star.md), [equipment authoring](ashen-equipment-authoring.md),
[startup](startup-load.md), [docs map](README.md), [vision](plans/character-mmo/vision-roadmap.md).
