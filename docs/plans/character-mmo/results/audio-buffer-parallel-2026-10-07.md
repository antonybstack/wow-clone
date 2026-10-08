# Parallel native sound buffers — 2026-10-07

Explicit first sound activation now overlaps the two native Lite buffer fetches
and decodes. All three declared local pairs improve readiness by **45.6–58.1 ms**;
nine corrected native game cases and three probe controls pass. Root reviewed
the actual live MP4, delivered as Telegram **882** and
[identical VE MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/audio-buffer-parallel-2026-10-07/motion.mp4).
This is local acceptance. Production remains **7d00c56 / 5723a4ab**; the required
texture failure still holds release. The native AudioContext constructor hitch
remains.

## Implementation

`fire-blast-audio.js` uses Lite 1.31.1 `createSoundBufferAsync` for both WAVs in
`Promise.all`, checks scene lifetime, then creates the existing sound graphs from
those decoded buffers. Native engine, mixer, explicit gesture activation,
muting, shared in-flight preparation, instance limits, volume/pitch, capture and
disposal remain in their existing paths. Movement while muted creates no audio
engine or sound requests. There is no eager startup audio or new retry scheme.

The pinned [buffer factory](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/audio/sound-buffer.ts)
performs fetch/decode without a sound graph; the native
[sound factory](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/audio/static-sound.ts)
reuses the returned buffer. Source comments link these APIs. No audio asset,
rendering, character or source-animation change. Generated uncompressed JS
increases by **85 bytes**; all 382 served public payloads are byte-identical.
This is build-size evidence, not a new first-play measurement.

## Declared local comparison

M1 Max, native **headless Chrome 154.0.8037.98**, uncapped WebGPU, 1280×720/DPR1,
seven enemies, fresh process/profile and disabled HTTP cache per visit. Network:
decimal 50 Mbit/s down, 10 Mbit/s up, 40 ms. OS/DNS/driver/CDN caches uncontrolled.
One intended game renderer; no recording, sampling, encoding or build during
timing. Maximum uncovered dressed Human fixture; full world/enemy readiness and
1,200 ms settling, then real held W and sound-button input, followed by 1,500 ms
after sound readiness. All six complete visits, requests, native game intervals
and RAF observer intervals are retained in the
[comparison](../../../baselines/character-mmo/audio-buffer-parallel-2026-10-07/comparison.json).

| Run | Variant | Constructor | First sound ready | After constructor | Game interval p99 | Worst |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | Sequential | 160.1 ms | 358.4 ms | 198.2 ms | 21.8 ms | 195.8 ms |
| 2 | Parallel | 160.4 ms | 308.3 ms | 147.6 ms | 21.9 ms | 191.5 ms |
| 3 | Parallel | 155.4 ms | 304.4 ms | 148.8 ms | 21.7 ms | 189.7 ms |
| 4 | Sequential | 159.6 ms | 362.5 ms | 202.8 ms | 21.8 ms | 190.7 ms |
| 5 | Sequential | 151.2 ms | 346.0 ms | 194.7 ms | 21.8 ms | 182.6 ms |
| 6 | Parallel | 152.9 ms | 300.4 ms | 147.3 ms | 21.8 ms | 187.4 ms |

The three pairs save **50.6 / 54.0 / 47.4 ms** after construction and
**50.1 / 58.1 / 45.6 ms** total, exceeding the declared 30/20 ms minimums.
The secondary post-ready RAF observer's p99 changes by +0.1/0/+0.1 ms, within
the declared 1 ms limit. This observer is not the game's render-loop FPS.
Actual complete activation windows average **130.8–132.4 FPS** and retain one
>33.33 ms interval each. This improvement does not remove that hitch or qualify
new settled route FPS. Historical qualified production's 202.6–232.6 FPS remains
a separate fifteen-window result.

Both variants fetch the same **346,694-byte** and **264,678-byte** WAVs. Sequential
starts the second after the first completes; parallel starts both together.
The baseline was subsequently reproduced with a diagnostic Vite `load` override
in a separate output directory: all **202 measured JS/CSS/HTML/Havok files** are
exact. Every public payload matches baseline and candidate. Generated `_headers`
differs only in candidate Link references to the new hashed JS names; the local
timing server does not apply that Pages metadata. The first overly broad header
comparison is retained. No timing visits were repeated after QA correction.

## Lifecycle review and evidence

An independent Grok review found the initial `createGain` probe missed Lite's
direct `new GainNode(ctx)` construction. The corrected proxy observes native
graphs, records unhandled rejections, and passes positive detector controls.
Nine game cases cover muted casts/movement; pointer, keyboard and desktop touch
activation; shared preparation; native capture/remute/resume; constructor
failure; held-fetch disposal; either invalid-WAV decode with a held sibling;
and disposal without requesting audio. Zero unexpected runtime errors,
recoveries, late graphs or unhandled rejections. Failure controls keep movement
live; disposal closes the context once and disposes the scene.

The review's claimed orphan sibling rejection is incorrect:
[PerformPromiseAll](https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-performpromiseall)
attaches rejection handlers to every input. A native early/late rejection control
confirms zero unhandled rejections, while a bare rejection is detected. The
[original review](../../../baselines/character-mmo/audio-buffer-parallel-2026-10-07/review.md) and [root response](../../../baselines/character-mmo/audio-buffer-parallel-2026-10-07/root-review-response.md)
retain both valid corrections and disputed claims. Coverage does not establish
all possible microtask disposal timings, retry after failure or every audible
lava/pulse path; those runtime wrappers are unchanged.

The [curated receipt](../../../baselines/character-mmo/audio-buffer-parallel-2026-10-07/receipt.json)
pins measured product inputs `9ebfe7fa` and final inputs `3a4ad1ad`; only the QA
probe changed after timing/capture. Runtime audio SHA remains `37fa200c…` and the
compiled candidate is unchanged. Actual build/comparison/checker/capture and
reproduction exits are 0. Raw operators and frames remain under
`.cache/character-mmo/audio-buffer-parallel-2026-10-07/`.

## Live delivery and remaining work

Root replayed the actual MP4 in Edge, including starting-area fence, movement,
sound activation, Fire Blast and subsequent movement; ending motion was also
observed at half speed. Normal Havok remains active, damage-only god mode is
labelled, displacement is 70.7 m along Z, and recoveries/runtime errors are zero.
The native game master mix uses no microphone/system audio. Opus capture is
aligned to frame timestamps and muxed to AAC; decoded mono PCM peak 0.740 and
RMS 0.0376 confirm nonzero audio. Physical speaker latency and subjective sound
quality are unverified. Recording HUD values are not benchmarks.

The MP4 is **1280×720**, square pixels, zero rotation, **23.875289 seconds**;
SHA256 `c1a04873fa9069a6a483a762e8158703417e55df5d809a605f49b76481959c3c`.
Telegram returns matching dimensions and 24-second integer duration. VE serves
identical bytes as `video/mp4` and passes HTTP206 byte-range validation. These
checks do not establish new Telegram fullscreen or current iPhone acceptance.

No Pages upload/seal/promotion, new public startup cohort or separate five-route
FPS qualification ran. Constructor and streaming tails, the rejected preview's
required-texture failure, original 14/60 fetch failures, original 362 ms input
upper-bound outlier and current physical iPhone acceptance remain open. Do not
extend the exhausted unchanged diagnostic campaign. Next independent feature
work is the retained armor cuff/strap fit, followed by shield proof. Root owns
implementation/acceptance; Grok 4.6/high completed bounded operations, independent
review, recording and exact media delivery. Owned game/media tabs and harnesses
are closed; user Edge/Orca remain intact.
