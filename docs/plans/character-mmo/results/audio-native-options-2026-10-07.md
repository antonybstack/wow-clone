# Native audio constructor options

2026-10-07. Research against the installed Lite 1.31.1 and the previously measured
Chrome **154.0.8037.98**. No browser was launched, no new timing was collected,
and runtime behavior, assets and production **7d00c56 / Pages 5723a4ab** are unchanged.

## Decision

Keep native AudioContext defaults and explicit activation. Do not reopen the
rejected silent-output trial by adding `sampleRate:48000`: the measured browser's
implementation still obtains device parameters on the main thread in that path.
Supplying the rate cannot bypass that call. This does not prove every internal
cause of the measured 151–179 ms stall or rule out all possible audio approaches.

The accepted [parallel buffer pass](audio-buffer-parallel-2026-10-07.md) already
reduces sound readiness by 45.6–58.1 ms in three declared local pairs. It leaves
the constructor hitch. The earlier [silent-output visit](streaming-tail-and-verifier-2026-10-07.md#first-sound-and-rejected-native-output-trial)
constructed in 163.1 ms, versus 179.1 ms in its single original visit; readiness
did not improve. These remain historical observations, not new measurements.

## Source check

The official Chromium tag resolves to commit
**b859317bf11f6be47f9b7799ec690a0a42a1fb33**. The receipt records decoded source
hashes, locations and installed Lite hashes; raw source remains in the ignored
task cache. Inspect the pinned links rather than a moving HEAD.

| Path | Observed behavior |
| --- | --- |
| [Lite audio engine](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/audio/audio-engine.ts) | `AudioEngineOptions.audioContext` accepts an existing BaseAudioContext. Otherwise Lite calls `new AudioContext()`. Its existing engine owns playback graphs, unlock, mixer and context disposal. |
| [AudioContext](https://chromium.googlesource.com/chromium/src/+/b859317bf11f6be47f9b7799ec690a0a42a1fb33/third_party/blink/renderer/modules/webaudio/audio_context.cc#451) | Constructor forwards the optional rate and requested sink to the real-time destination. |
| [Real-time handler](https://chromium.googlesource.com/chromium/src/+/b859317bf11f6be47f9b7799ec690a0a42a1fb33/third_party/blink/renderer/modules/webaudio/realtime_audio_destination_handler.cc#371) | Initialization creates a platform destination with those options. |
| [Audio destination](https://chromium.googlesource.com/chromium/src/+/b859317bf11f6be47f9b7799ec690a0a42a1fb33/third_party/blink/renderer/platform/audio/audio_destination.cc#477) | Constructor creates a native device before obtaining buffer size and resolving sample rate. It also reads hardware buffer size for a histogram. |
| [Native device](https://chromium.googlesource.com/chromium/src/+/b859317bf11f6be47f9b7799ec690a0a42a1fb33/content/renderer/media/renderer_webaudiodevice_impl.cc#229) | Audible and silent sinks both invoke `device_params_cb` unconditionally. Silent selects the default device. The optional rate is applied later; latency hints also use those parameters. |
| [Device factory](https://chromium.googlesource.com/chromium/src/+/b859317bf11f6be47f9b7799ec690a0a42a1fb33/third_party/blink/renderer/modules/media/audio/audio_device_factory.cc#168) | `GetOutputDeviceInfo` requires the main thread and returns cached sink information. This check does not time the lower-level sink/IPC/driver work. |

The [Chrome routing documentation](https://developer.chrome.com/blog/audiocontext-setsinkid)
documents silent output and promise-based routing to the default sink `''`.
It makes no constructor-latency guarantee. A promise-returning `setSinkId` does
not make preceding constructor work asynchronous. Changing latency hints or
forcing a sample rate without evidence could change playback latency or require
resampling while retaining the query. The new source comment links to this exact
implementation boundary.

## Verification and limits

All retrieved source hashes and the official tag are checked locally. Installed
Lite implementation/declarations agree on injected-context support and disposal.
The first Python HTTPS attempt failed local certificate verification; verified
system `curl` fetched the same official tag/files without disabling TLS checks.
The web reader could not open the two Chromium source URLs. Neither failed fetch
is browser timing evidence.

Independent Grok 4.6/high review is recorded in the evidence directory. This
documentation/comment pass needs no game rebuild, repeated startup campaign,
benchmark or new visual delivery. Previous reviewed live motion remains the
acceptance evidence; no new fit, sound-output or physical-device claim is made.

Next independent feature work is the remaining mixed shell/cuff and plate fit,
followed by the missing authored shield category. A future audio candidate needs
a materially different source-backed path, a bounded native constructor/complete
activation comparison and actual playback/lifecycle controls. Preserve muted
startup, existing Lite APIs, user-gesture unlock and scene disposal. Keep the
startup release hold and original physical-device/reliability exits open.

[Source/review receipt](../../../baselines/character-mmo/audio-native-options-2026-10-07/receipt.json).
