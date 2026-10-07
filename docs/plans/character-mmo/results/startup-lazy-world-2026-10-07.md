# Deferred world storage and Havok diagnostics — 2026-10-07

**Retained default-off checkpoint; production unchanged.**
ASHEN_LAZY_WORLD_BUFFERS=1 creates each untouched world record's native storage
buffers/meshes when its first real block arrives. Five initial records reserve
**16,259,292 bytes** instead of 71 records/**210,049,236 bytes**. Complete geometry,
final allocations, Havok collision, paths and textures remain unchanged. Reservation
is logical buffer capacity, not measured residency or isolated GPU execution time.

The first implementation passes 26 focused checks, both flag builds, six native
lifecycle/default/maximum controls, helper abort and three entry aliases. Initial
and final allocations and every final world/shadow name match the prepared source.
Its declared twelve local starts all pass identity/equipment/Havok/completed-GPU/
input gates with zero recorded errors. Three alternating pairs each, M1 Max,
Chromium WebGPU 1280×720/DPR1, decimal 50 Mbit/s down /10 up /40 ms, fresh process/
profile with native preload reuse; OS/driver caches uncontrolled:

| Outfit | Eager → deferred, three pairs | Gain |
| --- | --- | --- |
| Default | 544.3→534.6 /535.5→529.4 /535.9→535.0 ms | 0.9–9.7 ms |
| Maximum | 781.1→772.0 /778.6→765.5 /784.6→770.6 ms | 9.1–14.0 ms |

This modest gain does not establish reliable public one-second startup. The
comparison predates the following corrections; no replacement paired/public
cohort is claimed for the corrected build.

## Independent review and corrections

Grok 4.6/high independently finds two consequential arrival defects. Root fixes
sun/local caster membership by retaining the world and native allocation revision,
then reusing the existing setWorld path once per render-boundary update. Revision
also detects an addition/proxy removal with unchanged array length. New woodland
meshes inherit the current tile selection immediately, including while a menu
pauses world simulation; arrival consumes no extra distance transition. Existing
100/140 m hysteresis and one tile transition per frame remain.

The read-only follow-up finds no remaining issues within those corrections. The
native-function test covers late full/reduced/shadow arrival, unchanged transition
count, hysteresis and disposal. Root syntax checks pass. A real Havok abort from
the earlier concurrent experiment also motivates exact WASM URL/initialization
context around the cached native factory promise, retaining the original cause.
No loader replacement or application retry is added.

The first corrected build refuses stale sun-shadow source provenance. That failure
is preserved; the existing world preparation tool regenerates only manifest
provenance. Geometry and texture hashes remain byte-identical. Fresh corrected
builds, 26 focused checks, six native controls, helper abort and three entries pass.
Real native WASM abort shows exact URL plus TypeError cause, one request, no unhandled
page error, opaque/inert failure and no late play/body/controller. Corrupt200 shows
the same context and native compiler/fallback cause with two native requests.
These controlled failures do not explain the historical 14 public failures.

## Performance and motion

One isolated renderer, M1 Max, native 1280×720/DPR1. Recording, encoding, builds and
reference-media playback excluded from timing. The first six alternating maximum
streaming windows observe 169–181 FPS but retain 185–223 ms stalls. Three corrected
maximum streaming windows observe173–176 FPS; p95 18.9–19.7 ms, p99 21.5–21.6 ms,
worst 175.2–179.4 ms, 112–124 frames>16.67 ms per window. This later correction sample
is not a causal paired claim. At every observed allocation revision through 71,
actual sun caster membership and full/reduced visibility match, with zero errors,
Havok active and unchanged recoveries.

Fifteen corrected settled windows, three 12-second walks each on meadow/town/bridge/
cathedral/forest with seven enemies: **202.7–238.5 FPS**, maximum p95 **5.9 ms**,
p99 **6.2 ms**, worst **10.1 ms**, zero frames>16.67 ms/errors/recoveries. All exceed
120 and144 FPS. Bridge/cathedral retain240 Hz pacing hints; observation mode does
not prove an uncapped hardware limit. The first fifteen pre-correction windows
(202–240 FPS,p99≤6.1,worst11.4 ms) remain distinct.

Root reviewed actual default 24.05-second and maximum 24.24-second1280×720 MP4
playback: dressed native motion, normal Havok walk, temporary path barrier through
streaming, world shadows and camera turn, no persistent T-pose. Diagnostic
invulnerability affects damage only. Recording HUD 60Hz is excluded from performance
and startup evidence.

Telegram **874** (default) and **875** (maximum) are delivered. Both API responses
match the files' 1280×720 dimensions; square pixels and zero rotation are recorded
in sanitized delivery metadata. VE HEAD/GET/range checks return 200/200/206 with
video/mp4, exact lengths, matching complete SHA-256 hashes and matching prefixes:
[default MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/lazy-world-2026-10-07-default.mp4),
[maximum MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/lazy-world-2026-10-07-maximum.mp4).
An initial urllib GET returned 403; the successful checks used curl and retain
that failed attempt. Root reviewed both Telegram inline videos, expanded maximum
playback and direct VE maximum playback: proportions are correct. The requested
fullscreen control did not enter fullscreen; desktop-app and physical-phone
playback remain unverified. The delivery ledger is attributed to the finished
checkpoint commit after committing; no duplicate send is required.

All owned native browsers, previews and root review tabs are closed. Final audit
finds no Google Chrome/Chromium or game-preview process, no game/debug listener,
twelve nongame Edge tabs and zero Orca embedded tabs. User browser/reference-media
state is preserved.

## Remaining work and evidence

Profile the demonstrated background 175–179 ms stall using native CPU/GPU timeline
evidence; do not invent its cause from frame intervals. Reliable public one-second
qualification, original intermittent-fetch cause, full preview/production release
gates and current physical iPhone remain open. Both world flags remain default-off.

[Tracked receipt](../../../baselines/character-mmo/startup-lazy-world-2026-10-07/receipt.json)
keeps frozen sources, every paired row, corrected native exits/controls, streaming
and steady tails, reviews and motion hashes. Raw cache paths are in that receipt;
initial stale-build/CLI caps are retained. Root owns acceptance; Grok performs
bounded operations. No old failed cohort is overwritten or relabelled.

Native APIs: [storage meshes](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/mesh/mesh-from-storage.ts),
[native arriving-mesh builders](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/scene/scene-runtime-mesh-build.ts),
[scene callback order](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/scene/scene-core.ts),
[error causes](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause).
