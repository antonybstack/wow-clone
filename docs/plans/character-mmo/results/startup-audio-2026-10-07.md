# Deferred native audio — 2026-10-07

The demonstrated large automatic post-play hitch is caused by native Lite audio
initialization during muted `createCombat`. The maximum/default CPU profiles
attribute **192.778/176.617 sampled ms** to `createAudioEngineAsync`; main longtasks
are 195/178 ms. Native pipeline creation CPU calls at those pauses are ≤0.6 ms.
API-call spans and queue acknowledgement windows are not isolated GPU timings.
The other pre-play 56/65 ms tasks include world building/allocations/GC; they are
not explained by this audio fix. Prior shader/shadow trials remain closed.

Audio now prepares only when the player enables sound or a recording explicitly
awaits `audio.prepare()`. It retains Lite's native engine, decoded sounds, gesture
resume, MediaStream mixer and scene cancellation. A cached promise prevents
parallel requests from creating duplicate contexts. Desktop/mobile menu controls
mirror loading/failure states. First explicit activation retains the one-time
native context cost: this does not establish a faster first playable frame.

Actual native touch testing exposed a separate Menu defect: `pointerup` opens and
hides the button; the following click hits the backdrop and closes it. Menu now
uses native button `click`. An idle-dispose followed by `KeyW` exposed the view
listener reaching disposed meshes; the existing scene AbortSignal removes it.
Changed code includes documentation links for the native/DOM patterns.

## Verification and performance

32 focused tests, both default/lazy-prime builds, seven native audio cases and
three entry aliases each pass. Actual Chromium controls cover muted movement and
casting without a context/WAV request; pointer, keyboard and mobile Menu touch
activation; native source playback/mixer stream; one context across concurrent
preparation/remute/resume; construction failure without movement failure; held
fetch disposal; and idle disposal/later movement input. No recorded errors or
recoveries. An independent Grok reviewer reports no consequential findings across
the audio/menu/touch/lifetime passes; those reads do not replace live checks.

Three alternating fresh-process maximum-outfit pairs, native 1280×720/DPR1,
decimal 50 Mbit/s down / 10 up/40 ms, native preload reuse, no recording/profiling:

| Pair | Previous worst interval | Deferred audio | Previous/candidate streaming p99 |
| --- | ---: | ---: | ---: |
| 1 | 181.3 ms | 37.7 ms | 21.5/21.6 ms |
| 2 | 186.1 ms | 38.4 ms | 21.6/21.5 ms |
| 3 | 186.5 ms | 36.4 ms | 21.7/21.6 ms |

The large hitch disappears from these muted windows. Smaller streaming spikes
remain; each candidate has one interval above 33.33 ms. Final native geometry,
shadow membership, woodland selection, Havok and seven-enemy controls pass.
This is a local background-frame comparison, not public one-second qualification.

Fifteen separate settled walks: **Apple M1 Max, native 1280×720/DPR1, seven enemies,
three 12-second runs per meadow/town/bridge/cathedral/forest**, no recording/build/
encoding, Chrome uncapped launch flags, other owned renderers closed/reference
media paused. Observed **202.5–240.2 FPS**, maximum p99 **6.3 ms**, worst **11.2 ms**,
40,260 intervals, none >16.67 ms/errors/recoveries. Bridge/cathedral have 240 Hz
pacing hints; retain these as observations, not confirmed hardware-limit proof.

## Motion delivery and limits

Root reviewed the actual **24.343897-second 1280×720 MP4** and timestamped live cast
frames. Source elapsed 24.344606 seconds, 1,430 source frames, square pixels, zero
rotation. Normal controls strafe/walk from the starting area to z70.3, with active
Havok, native spell sound `played: 1`, remuted, seven enemies and no recorded errors/
recoveries. Diagnostic invulnerability changes damage only. The clip is silent;
actual native audio playback/mixer checks are separate.

Telegram **876** reports matching 1280×720. [Identical VE MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/startup-audio-2026-10-07/991cbc03fcf0-maximum.mp4)
SHA256 `991cbc03fcf038d8b8134e807c516177bd352081ca41fc5f291dec461f066314`,
13,996,382 bytes, `video/mp4`, GET 200 and Range 206. Python urllib initially got 403
following the successful upload; an ordinary curl GET retrieves the exact bytes.
No second upload or repeated Telegram send. Root reviews Telegram inline/expanded
and direct VE playback proportions. Requested fullscreen was not entered; native
Telegram desktop and current physical iPhone remain unverified.

**This is diagnostic motion, not clean whole-game visual acceptance.** Camera
collision squeezes into the maximum outfit near a starting fence/tree for several
seconds. Reproduce the sweep/radius/pivot on this normal-control route, compare
against the baseline, and correct it before production promotion; preserve Havok
obstruction handling. Do not hide it with a teleport or camera-only beauty view.
Public one-second cohorts, the original fetch root cause and production promotion
remain open. Prime/lazy-world flags remain default-off.

Failed attempts are retained separately: stale cooldown-test assumption, an early
cast assertion, hidden desktop button tapped on mobile, reproduced backdrop click,
post-dispose physics-test expectation, actual disposed view-key error and a failed
capture endpoint without a saved position report. The corrected capture saves
native state before assertions and adds normal strafe. Its passed checks do not
erase the failed capture or earlier cohorts. Disposal tests assert active Havok
before teardown and retired physics afterward.

Raw evidence: `.cache/character-mmo/background-stall-2026-10-07/`; large CPU/GPU
traces stay local. [Compact tracked receipt](../../../baselines/character-mmo/startup-audio-2026-10-07/receipt.json)
pins source, native controls, profiles, frame tails, motion and ownership. Owned
browsers/previews/review wrapper are closed; media guards removed and remaining
connected reference playback restored. Early paired ownership reused a single
snapshot; subsequent prepared runs append history instead of overwriting it.

Sources: [pinned native audio engine](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/audio/audio-engine.ts),
[AudioContext constructor](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/AudioContext),
[native button click](https://developer.mozilla.org/en-US/docs/Web/API/Element/click_event),
[AbortSignal event listener](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#signal).
