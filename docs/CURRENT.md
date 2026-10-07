# Ashen Reach — current state

Updated **2026-10-07**. Read this before choosing work. The latest user request
controls scope; historical milestones are evidence, not an active queue.

## Active priorities

Native goal **active**: “resume. complete all 5 priorities autonomously.” The
[five-priority plan](plans/character-mmo/five-priorities-2026-10-06.md) remains authoritative.

1. **Reliable startup:** retain the original 14/60 failed public starts. They have
   not reproduced or been explained. Existing asset URL/operation/native-cause
   diagnostics and failure controls pass. A real Havok abort exposes one remaining
   gap, now corrected: exact WASM URL/operation and original cause appear on real
   native abort/corrupt200 failures. The native factory/cached promise are retained;
   abort makes one request, corrupt200 retains the package's two-request fallback.
2. **One-second first play:** require the selected dressed character, Havok support,
   a completed GPU frame and working input. Preview 43730b3e has 60 valid/error-free
   starts but two misses (default 1,053.5 ms; maximum 1,036.4 ms). Early helper
   discovery is retained default-off. Concurrent physics and inline launcher trials
   are closed without material gain. Current deferred-buffer trial reserves
   16.3 MB/5 world records before play rather than 210.0 MB/71; all native controls,
   final geometry/shadow membership and twelve local starts pass. Local gains are
   0.9–9.7 ms default and 9.1–14.0 ms maximum before review corrections. Root fixes
   arriving shadow membership and immediate woodland selection; independent
   follow-up has no findings. Corrected native controls, three streaming membership
   windows and fifteen steady walks pass (202.7–238.5 FPS, p99≤6.2 ms, worst10.1 ms,
   no frame>16.67 ms/errors/recoveries). Background175–179 ms stalls remain open.
   Reviewed live MP4s are delivered as Telegram874/875 and identical VE files;
   inline/expanded and direct VE proportions pass; fullscreen remains unverified.
   Keep both flags default-off; these local observations
   do not qualify the public one-second gate. Next profile the demonstrated stall,
   then qualify a material candidate. [Checkpoint](plans/character-mmo/results/startup-lazy-world-2026-10-07.md).
3. **Release accepted improvements:** freeze, commit/push, seal, verify preview
   integrity/entries/startup/traversal/mobile/depth/WebKit/FPS, deploy identical
   bytes, repeat production checks and retain rollback. Target 144 FPS at native
   1280×720; >120 FPS remains required. Recording and benchmarks are separate.
4. **Fieldcoat:** integrated, committed/pushed and motion delivered. Production
   delivery remains behind startup/release gates.
5. **Current physical iPhone:** no connected physical iPhone in the latest inventory.
   The user's earlier ~60 FPS iPhone 14 Pro Max report is historical. Desktop
   emulation/WebKit do not replace current-device acceptance.

Region, multiplayer and Elf expansion stay parked. After these gates, address
concrete mixed-fit/boot silhouette follow-ups; avoid another exhaustive fit matrix.

## Production and release holds

[play.sparkify.dev](https://play.sparkify.dev): source
**6004840807cb47a908fb47dd87848f49f39f3268**, Pages
**e39117b8-db74-4563-a6c0-b428c8d5d10e**
([immutable deployment](https://e39117b8.fardel.pages.dev)). Rollback:
**578dd30 / b9273b21-5ee5-4d4c-acbe-a7d99f5c1877**.
538 served files plus two missing-file controls pass; preview/production bytes
match. Entries, creator/mobile/depth/WebKit and normal Havok cathedral traversal
pass. [Release receipt](plans/character-mmo/results/m10-landscape-2026-10-06.md).

The latest production historical-outfit 20-start cohort fails: p95 **1,219.6 ms**,
worst **1,358.5 ms**, **14 misses**, zero recorded errors. Conditions: M1 Max,
1280×720/DPR1, fresh process/profile, HTTP cache disabled, decimal 50 Mbit/s down /
10 up / 40 ms. OS/driver/CDN caches uncontrolled.

Rejected preview **05f75b6e** (1de0bba) retains **14/60 TypeError: Failed to fetch**
and a bare-root entry timeout. Later pinned six-visit diagnostics and explicit
body/geometry/texture failure controls pass; they do not replace that cohort.
All retained failed Havok transfers finish HTTP 200; generic historical error text
cannot identify the failed operation. [Resumed diagnostics](plans/character-mmo/results/startup-resume-2026-10-06.md),
[original failures](baselines/character-mmo/startup-normal-release-2026-10-06/css-public-failure.json).
Cloudflare custom-domain request-log/cache investigation needs separate access:
DNS request with the deployment token returned 403. No dashboard sign-in or settings
change is pending. Production has not been promoted during the startup trials.

## Accepted character checkpoint

**a47b915 pushed:** schema-2 soft-skin Fieldcoat, catalogue v8, three race fits,
Human shape transfer, exact source binds, frozen historical registries and corrected
upper-trouser coverage through identity refresh. Factory 31 / character 228 /
equipment 115 checks and nineteen normal-game cases pass with zero recorded
runtime/GPU errors or recoveries. Maximum compact outfit remains **2,300,424 bytes**.

Root reviewed the actual 62.07-second 1280×720 MP4 and waist captures. Telegram
**871** / [identical VE MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/fieldcoat-2026-10-06.mp4)
are delivered and attributed to a47b915. Inline/expanded and direct VE proportions
reviewed; requested fullscreen was not entered. Twelve cold/resident swap pairs
pass: worst 157.9/4.5 ms, worst frame 25.4 ms at legacy 50 Mibit/s/40 ms.

Fifteen native 1280×720/seven-enemy route windows observe **219–257 FPS**, maximum
p99 **5.9 ms**, worst **10.5 ms**, no interval>16.67 ms/errors/recoveries. Forest
has 240 Hz pacing hints: the strict detector gate failed; two missing windows were
collected in observation mode. This is not confirmed uncapped hardware-limit
proof. [Fieldcoat result](plans/character-mmo/results/fieldcoat-2026-10-06.md).

## Startup checkpoints and closed trials

**ASHEN_PRIME_STARTER_WORLD=1** stays default-off: native Lite registration,
renderFrame and queue fence prepare the exact world/post/shadow frame while body
transfer is pending. No early input/loader release. The first prototype's persistent
T-pose was rejected; native PBR rebuilding now rescans arriving skins/morphs.
Corrected native lifetime/failure/default/maximum controls pass. Root reviewed
live motion; Telegram 872/873 and identical VE MP4s are attributed to 1503c9b.
Fullscreen/physical-phone playback remain unverified.

Sealed immutable preview **43730b3e** passes 552 delivery checks and three entries.
Cache-disabled public 20-start cohorts: default p95/worst 924.4/1,053.5 ms;
maximum 969.2/1,036.4 ms; historical 871.7/920.2 ms. All 60 valid/error-free;
default/maximum each miss once. [Full result](plans/character-mmo/results/startup-prime-2026-10-07.md).

| Trial | Decision / evidence |
| --- | --- |
| Early helper discovery | Retained opt-in 865cf7d; default gains30–43 ms, maximum loses3–15 ms. [Result](plans/character-mmo/results/startup-prime-early-2026-10-07.md). |
| Lossless transport/accessor census | Not integrated: Q11 Brotli maximum saves 154,168 bytes/24.7 ms ideal transfer; identity accessor dedup saves zero. [Result](plans/character-mmo/results/startup-lossless-census-2026-10-07.md). |
| Sequential pre-Havok frame | Removed: all six local pairs regress 15–23 ms. [Result](plans/character-mmo/results/startup-prime-overlap-2026-10-07.md). |
| Concurrent native physics | Removed: twelve native controls pass, paired change−1.3…+6.4 ms, no material gain. [Result](plans/character-mmo/results/startup-prime-concurrent-2026-10-07.md). |
| Async inline launcher | Removed: maximum gains 4–7 ms, no material default gain. Earlier discovery does not imply earlier transfer completion. [Result](plans/character-mmo/results/startup-inline-facade-2026-10-07.md). |

Earlier [bootstrap](plans/character-mmo/results/startup-bootstrap-2026-10-06.md)
and [normal release](plans/character-mmo/results/startup-normal-release-2026-10-06.md)
failures remain preserved. Reorder/resample/position rounding are closed without
publication; priority hints already arrive High. Do not repeat unchanged cohorts
or reopen shader/shadow/precision trials without material new evidence.

## Operations and ownership

Root implements/accepts; **Grok exclusively** handles bounded delegated operations.
Freeze product inputs during gates and use one writer per path. Preserve unrelated
AGENTS.md / next-ten.md edits and caches; no reset/stash/clean. Use fresh, prepared
Grok operations rather than repeatedly growing oversized sessions.

Before any live check audit pages/processes; before timing confirm one intended
renderer and pause owned review/reference media. Track owner/browserPID/CDP/URL/
purpose, close exact owned contexts/browser/harness afterwards and restore media.
[Ownership procedure](debug-view.md#browser-ownership-and-performance-isolation).
User Edge 2931/Orca 98938 are preserved; latest inventory: Edge 12 nongame tabs,
Orca 0 embedded tabs. Prior native/paired trials are closed. Corrected deferred-buffer
native Chrome30837/helper30844/preview30816 and final motion Chrome44407/helper44413/
preview44386 are closed; performance receipts retain intermediate owned PIDs.
Root review tabs1147995825/1147995829 and wrapper47554:7081 are closed. The __lazyPerf20261007
media guard is removed; prior connected Telegram/Shadowglass/X playback restored
(3/1/1/0). Final audit finds no Chrome/Chromium, Grok worker, game preview or
game/debug listener; Edge12 nongame/Orca0 tabs remain. No owned game renderer
remains. Audit again before the next benchmark.

[Workflow](reviews/workflow-2026-10-05.md#current-operating-rule--2026-10-06),
[continuation limits](autonomous-continuation.md).

## Working references

Active root index.html / ashen-reach.html, Vite 5173, src/ashen-reach/main.js,
global ASHEN; Babylon Lite 1.31.1/WebGPU, Havok 1.3.14, compatible source motion.
Production catalogue v7; local v8 adds Fieldcoat. Human height 0.90–1.15 /
build −0.95…+0.95; Orc/Undead neutral only.
[Character contract](character-system-north-star.md),
[equipment authoring](ashen-equipment-authoring.md), [startup](startup-load.md),
[docs map](README.md), [vision](plans/character-mmo/vision-roadmap.md).
