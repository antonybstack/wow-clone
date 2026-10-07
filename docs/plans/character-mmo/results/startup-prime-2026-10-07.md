# Starting-world scheduling experiment

Status: **1503c9b is committed/pushed**, with the experiment default-off.
Forty focused tests passed on the initial prototype; both corrected-source flag
builds and six native controls pass after the root-rejected T-pose was corrected.
The twelve local visits show maximum-outfit headroom. Immutable preview 43730b3e
passes 552 delivery checks and all entry aliases, but its sixty valid/error-free
public starts contain **two misses** of the inclusive one-second gate. Production
promotion is withheld. Production remains 6004840/e39117b8; Fieldcoat a47b915 is
committed/pushed/motion-delivered and shares these outstanding release gates.


The retained maximum-outfit diagnostic had the world available before its body
transfer. This candidate registers the same starting world, post chain and shadows,
and submits one zero-delta frame behind the opaque loading overlay when the body
is still pending. It skips the work if that promise has settled, including during
helper discovery. No quality changes, second renderer, animation-frame loop,
shader cache, retry or new asset encoding.

The native queue fence is observed immediately and can complete while the original
body transfer/installation proceeds. The existing loss handler is installed before
submission; its loop starts at the original late boundary. Scene disposal rejects
pending app continuations through the existing lifetime signal. After the saved
body and gear are installed, the caller waits the preparatory fence and uses the
existing late-feature registration to drain the added skin/material builders.
Calling initial registration again without unregistering would return early in
Lite 1.31.1. The original dressed, Havok-supported, GPU-completed first-play fences,
overlay removal and input release stay in place.

Code comments reference the pinned [native engine](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/engine/engine.ts),
[scene registration](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/scene/scene-core.ts)
and [AbortSignal contract](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/throwIfAborted).
Installed declarations/source were checked as well. This scheduling hypothesis
does not explain the earlier `TypeError: Failed to fetch` or prove that the
navigation marks isolate GPU execution time.

Before timing, require both builds and entry aliases, held-body no-early-play,
HTTP-200 decode failure, disposal and device-loss controls, plus real default and
maximum-outfit movement/skin/material checks. Artificial held responses are
functional controls, never timing samples. Then declare three alternating fresh
process pairs per default/maximum outfit, normal initially empty HTTP cache with
native preload reuse, 50 decimal Mbit/s and 40 ms. Keep all attempts/errors;
OS/driver shader caches remain uncontrolled. Compare flag off/on on the same
frozen inputs. Reject the experiment if added work does not create useful headroom.
No unchanged full-cohort repetitions to manufacture a passing distribution.

Evidence is under `.cache/character-mmo/startup-prime-2026-10-07/`. Functional
Grok workers owned the sole slot-7 renderer and compressed preview; root owns
code and acceptance. User Edge/Orca remain intact. The current Mac/device inventory
still contains no physical iPhone.

## First native candidate and correction

Held-body state keeps the opaque overlay, inert canvas and zero scheduler frames;
release reaches grounded play and movement with no recorded runtime/GPU error.
HTTP-200 corrupt gzip and explicit disposal both prevent body/play resurrection.
The checker initially counted geometry through Classic methods; corrected Lite
`_gpu.indexCount` diagnostics count native triangles. Advancing animation time
and attached skeletons still did not prove that the rendered vertices animate:
root inspected the actual first-play and movement captures and found a T-pose.

The PBR group was composed from the initial world/capsule before skeletons arrived.
Late material rebuilds reused that captured composer. The correction calls native
`rebuildScenePbrPipelines` after body/gear installation and the preparatory queue
fence, before late-feature registration. This rescans scene-wide skin/morph
features; it adds no custom shader or deformation path. Source reference:
[pinned scene rebuild](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/scene/scene-rebuild.ts).
The default-off path does not call it. Its cost must be measured before acceptance.

The initial device control actively called scheduler start in the synchronous
turn which destroyed the device; the native lost promise subsequently disposed
the scene and showed the reload overlay. The corrected control tests terminal
start after that actual asynchronous handler. Original failure retained. Normal
default/maximum cases reached dressed, grounded play without errors but timed out
waiting for the complete region after 15 seconds; the next check uses the existing
90-second region allowance. Neither timeout is a startup timing sample.

Raw first candidate and checker attempts are retained under the cache, including
`native-attempt4-pre-skin-rebuild/` and `native-A-held-then-play-attempt3-classic-counter/`.
Original owned Chrome71715/CDP10037, Vite71690/71710:5873 and preview71492:7074
are closed. User Edge 2931/Orca 98938/media remain untouched.

## Corrected native controls and paired decision

Both final-source flag builds pass. All six corrected controls pass; root reviewed
the actual default first-play/idle/movement captures and the maximum-outfit
first-play capture. Default arms render down rather than in the rejected T-pose.
The loss control waits for actual asynchronous recovery before testing terminal
scheduler start. Default and maximum normal cases complete the region and actual
Havok movement. No unexpected runtime/GPU error or recovery teleport.

The local method was declared before visits: M1 Max, 1280×720/DPR1, twelve fresh
Chrome processes/profiles, decimal 50 Mbit/s down/10 up/40 ms, initially empty HTTP
cache with native preload reuse, no forced shader cache or GPU tracing. Three
alternating off/on pairs each for unsaved default and catalogue-v8 maximum.
OS/driver caches remain uncontrolled. All six on visits actually submit the
preparatory frame; all twelve starts are valid, grounded, dressed and responsive
with no recorded errors. These are local transport/CPU measurements.

| Outfit | Flag | Samples (ms, pair order) | Median | p95/max |
| --- | --- | --- | --- | --- |
| Default | Off | 630.1, 618.6, 618.4 | 618.6 | 630.1 |
| Default | On | 744.6, 567.3, 569.0 | 569.0 | 744.6 |
| Maximum | Off | 867.5, 864.9, 856.3 | 864.9 | 867.5 |
| Maximum | On | 771.1, 777.4, 773.0 | 773.0 | 777.4 |

Maximum improvement is **83.3–96.4 ms** in all three pairs. Default improves by
49.4/51.3 ms in two pairs and regresses **114.5 ms** in the first. This supports
a new immutable public candidate; it does not establish causality from three
pairs or qualify public first play at/below one second. Keep the default tail and
all raw visits. No repeat until pass. Existing release gates remain unchanged.

Two orchestration failures ran zero timing visits. The first applied production
cache-policy checks to the local compressed preview: all 868 decoded byte/MIME/
status rows matched, but 36 cache rules differ from the server's documented
local policy. The second used the documented local verifier with a trailing-slash
base URL; string concatenation produced network-path requests (//asset), so
347/349 rows incorrectly failed. Standard URL construction now resolves against
a directory base, with a documentation reference in code. Both corrected local
receipts pass **349/349** decoded delivery checks. Production cache-policy
verification remains required and unchanged. Original attempts are retained.

Paired previews36899:7074 and36936:7075 and every fresh probe Chrome are closed.
All exact PIDs/listeners were audited absent. Root removed Telegram/Shadowglass/
X-reference play guards after timing and restored all connected prior playback
states. Other X/embedded YouTube were paused; no additional game was rendering.
Native corrected ownership is closed as well. Motion capture is a separate visual
check with no timing/FPS claim.


## Reviewed motion and delivery

Root reviewed both actual live recordings in native 1280×720 playback: default
arms remain down/animate during movement, and the maximum hood/coat/gear remain
skinned during the Havok walk. Diagnostic god mode changes damage only; no fly,
teleport or recovery. Both reports retain zero runtime/GPU errors and recoveries.
Recordings are excluded from timing/FPS. Source timestamps are preserved;
encoded 24.413/24.546 seconds, H264, square pixels 1:1, rotation 0.

Telegram **872 / 873** and exact VE MP4s are delivered:
[default](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/startup-prime-2026-10-07-default.mp4),
[maximum](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/startup-prime-2026-10-07-maximum.mp4).
Both full public SHA-256 values match the reviewed local files, HEAD 200/video/mp4,
Range 206/bytes 0–1023 and matching prefix. Telegram API 1280×720 agrees with both
files. Root also reviewed both inline views (738.1875×415.21875), expanded maximum
(1280×720) and direct VE maximum (native/display 1280×720, advancing playback).
No stretch observed. Browser fullscreen, Telegram desktop and current physical phone
playback are unverified. The API IDs differ from Telegram Web's local DOM IDs.

Owned review tabs 1147995813/1147995817/1147995821 and Python 52880:7081 are closed;
all native/paired/capture renderers/listeners were audited absent. User Edge/Orca
are preserved. The [tracked receipt](../../../baselines/character-mmo/startup-prime-2026-10-07/receipt.json)
retains source hashes, six controls, every local timing row, actual selected
identity/shape/equipment/input checks, media hashes/delivery and ownership.

The immutable public outcome below supersedes the earlier pending gate. No
production promotion from the small local comparison.


Independent Grok 4.6/high source/API/evidence review finds no demonstrated
consequential defect. It adds no separate live/test acceptance; public qualification
and the historical fetch cause remain open. Raw bounded review is retained with
the task evidence and its SHA-256 in the receipt.


## Immutable public outcome — release held

Source **1503c9b** is committed/pushed. Exact Pages preview
**43730b3e-67a1-4a08-b792-5eac94bc52fc**:
[43730b3e.fardel.pages.dev](https://43730b3e.fardel.pages.dev).
Configured Pages API confirms preview environment, branch startup-prime-20261007
and exact source commit. Build/seal/upload exit 0; saved-bootstrap 1/primer 1.
Seal 551 files/296,649,826 bytes, digest
2807a09b05f3aa2b5cd6233a8f41bfbf362ec187ca6f30166516f7270f47b02c.
Public delivery passes **552/552**: 550 served files and two missing 404/no-store
controls, executable MIME, exact decoded bytes, Havok and catalogue cache rules.
All three entry aliases pass native Havok streaming, one WASM request and actual
play camera. These functional entry times are unthrottled and are not cohort rows.

Method declared before all visits: M1 Max, native 1280×720/DPR1, decimal 50 Mbit/s
down/10 up/40 ms, twenty fresh native Chrome processes/profiles per outfit, HTTP
cache disabled including native prefetch reuse, GPU tracing/forced shader-cache
probes unset. OS/driver/DNS/CDN caches are uncontrolled. Source/sealed inputs stay
frozen. No recording or second game renderer; root guarded reference media after
inventorying Edge and all Orca embedded tabs (zero). Every attempt is retained.

| Outfit | Valid/attempted | p50 (ms) | p95 (ms) | Worst (ms) | Above 1 s | Primer submitted/skipped |
| --- | --- | --- | --- | --- | --- | --- |
| Default | 20/20 | 710.1 | 924.4 | 1,053.5 | 1 | 0/20 |
| Maximum | 20/20 | 857.5 | 969.2 | 1,036.4 | 1 | 19/1 |
| Historical | 20/20 | 793.0 | 871.7 | 920.2 | 0 | 20/0 |

All 60 are dressed, grounded, physics-active and input-responsive with zero
recorded runtime/GPU errors. Maximum selected identity, real morphs, 1.15 height,
0.95 slender weight and all declared equipment are asserted at first play.
Root reviewed actual native captures for both miss rows; skins/gear render with
arms down. The inclusive all-valid-at-or-below 1,000 ms gate **fails** for default
and maximum. No favourable reruns; historical is collected as originally declared.
This is a new candidate's cohort, not a replacement for the original 14 failed
starts. Historical fetch cause remains open. Production remains 6004840/e39117b8.

The default miss (run 12) has document responseStart 377.3 ms against 85.5 ms in the
representative median visit (run 8). Main begins 740.4/446.4 ms respectively. Every
default skips world preparation, but six still discover the helper late before
skipping. The miss requests it at 845.853–889.069 ms, a **43.2 ms** interval before
body installation. Maximum miss (run 1) similarly discovers it at 619.961–661.053 ms;
its preparatory frame submission-to-acknowledgement window is 274.4 ms against 86.2 ms
in representative run 3, while body transfer completion is similar. No duplicate
requests in those compared rows. Those windows do not isolate GPU execution or
prove shader compilation, and this change cannot eliminate arbitrary document
response delay.

Next bounded experiment: begin the existing opt-in native dynamic import earlier,
observe rejection immediately and retain default-off isolation. Preserve all skin,
lifetime, body-pending skip and actual playable fences; use Vite's native async
import machinery rather than a custom loader/cache. Verify failure/disposal/loss
and default/maximum movement on the changed source, then one small declared paired
comparison. Public cohorts require a justified gain and a new seal; do not repeat
43730b3e unchanged. [Vite async chunk loading](https://vite.dev/guide/features#async-chunk-loading-optimization)
explains its existing dependency preload mechanism. Network/document and native
fence tails remain separate work, with no relaxed gate or speculative fetch retry.

All owned entry/probe Chrome processes and local listeners are closed. Root
removed Telegram/Shadowglass/X guards and restored connected prior media states.
User Edge 2931 and Orca 98938 remain intact. Fresh xctrace inventory still has no
physical iPhone; emulation is separate. Telegram 872/873 ledger was attributed to
finished source 1503c9b after commit/push. Public receipt includes every timing row,
source/build/identity metadata, raw hashes and explicit failed qualification.
