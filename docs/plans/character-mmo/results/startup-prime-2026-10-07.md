# Starting-world scheduling experiment

Status: implemented locally behind **`ASHEN_PRIME_STARTER_WORLD=1`**, default off;
**40 targeted tests and both initial flag-off/on builds pass**. Root rejected
the first native candidate for a persistent T-pose. Native PBR rescan correction
passes all six corrected native controls. The twelve-visit local comparison
shows useful maximum-outfit headroom; a public preview/release gate is next. No preview/production release or
claim that the public one-second goal is met. Fieldcoat checkpoint `a47b915` is
committed and pushed; production remains `6004840` / Pages `e39117b8`.

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
are closed. User Edge2931/Orca98938/media remain untouched.

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

The next step is one sealed immutable public preview from committed inputs, with
full delivery/entry gates before twenty-start default/maximum/historical cohorts.
The existing strict all-at-or-below 1,000 ms gate and disabled-cache policy remain.
No production promotion from the small local comparison.


Independent Grok 4.6/high source/API/evidence review finds no demonstrated
consequential defect. It adds no separate live/test acceptance; public qualification
and the historical fetch cause remain open. Raw bounded review is retained with
the task evidence and its SHA-256 in the receipt.
