# Independent review: native AudioContext options (2026-10-07)

Reviewer: Grok 4.6 / high. Source-and-receipt inspection only. No browser, server, benchmark, capture, product edit, or extra documentation.

## Verdict

**The claim is valid.** On pinned Chrome **154.0.8037.98** (`b859317bf11f6be47f9b7799ec690a0a42a1fb33`), `sampleRate: 48000` with `sinkId: {type: 'none'}` still hits an unconditional device-parameter lookup in the AudioContext constructor chain. That lookup runs before the optional rate is applied. This does not justify reopening the rejected silent-output trial merely by adding a rate.

The report’s disclaimers hold: the 151–179 ms constructor observations stay historical; this pass does not prove that entire stall is hardware/IPC; it does not rule out every other audio approach; no new game timing or runtime behavior change is claimed or required.

No consequential correction.

## Call chain and rate ordering

Lite 1.31.1 `createAudioEngineAsync` uses `options.audioContext ?? new AudioContext()`. The game still passes `{volume: 0}` only. An injected `BaseAudioContext` is supported; `disposeAudioEngine` closes a non-offline context.

Pinned Blink/content, in constructor order:

1. `AudioContext::Create` records optional `sampleRate` and the sink (silent becomes a silent descriptor). Both are forwarded into the realtime destination node, which initializes on the main thread.
2. `RealtimeAudioDestinationHandler::CreatePlatformDestination` builds `AudioDestination` with those options.
3. `AudioDestination` constructs the native device **before** reading callback buffer size and resolving context sample rate, then later reads hardware buffer size for a histogram.
4. `RendererWebAudioDeviceImpl` treats audible and silent sinks in one switch, then always runs `device_params_cb`. Silent uses the default device id (`""`). The optional rate is resolved only after that callback; latency-hint buffer sizing uses the returned hardware parameters.
5. The bound callback is `GetOutputDeviceParameters` → `AudioDeviceFactory::GetOutputDeviceInfo`, which requires the main thread and returns sink-cache info. That function does not time lower-level sink/IPC/driver work.

So a silent sink plus an explicit 48000 Hz rate cannot skip the lookup the silent-only trial already took (163.1 ms construct, readiness unchanged vs 179.1 ms). Forcing a rate can still add resampling or change callback size after the query.

Line pins: table `#451` is the optional-rate block (destination construct is later in the same Create/ctor); `#371`, `#477`, and factory `#168` match; table `#229` is the sink switch, unconditional `device_params_cb.Run` is 240–241. The game comment’s `#237` is the silent default-id line. None of these offsets change the ordering claim.

Current `fire-blast-audio.js` comment states that the options do not bypass the query. It does not assert a measured lower-level stall cause. That matches the source.

## Evidence hashes and historical numbers

All six cached Chromium files and both installed Lite files match `receipt.json` SHA-256 and byte sizes. `tag.json` is the official 154.0.8037.98 brancher commit named in the receipt.

Historical figures cited in the report match the earlier results: constructor 179.1 ms then silent 163.1 ms (`streaming-tail-and-verifier-2026-10-07.md`); parallel-buffer constructor 151.2–160.4 ms and readiness savings 45.6–58.1 ms (`audio-buffer-parallel-2026-10-07.md`). Production remains **7d00c56 / Pages 5723a4ab**. Receipt ownership is zero game browsers/servers/benchmarks/captures.

## Files inspected

- `docs/CURRENT.md`
- `docs/plans/character-mmo/results/audio-native-options-2026-10-07.md`
- `docs/plans/character-mmo/results/streaming-tail-and-verifier-2026-10-07.md`
- `docs/plans/character-mmo/results/audio-buffer-parallel-2026-10-07.md`
- `docs/baselines/character-mmo/audio-native-options-2026-10-07/receipt.json`
- `src/ashen-reach/fire-blast-audio.js`
- `node_modules/@babylonjs/lite/lib/audio/audio-engine.js`
- `node_modules/@babylonjs/lite/index.d.ts` (`AudioEngineOptions`, `createAudioEngineAsync`, `disposeAudioEngine`)
- `.cache/character-mmo/audio-native-output-2026-10-07/source/{audio_context,realtime_audio_destination_handler,audio_destination,renderer_webaudiodevice_impl,audio_device_factory,renderer_blink_platform_impl}.cc`
- `.cache/character-mmo/audio-native-output-2026-10-07/source/{receipt,tag}.json`

## Limitations

- Chromium was not re-fetched; local decoded files were hashed against the receipt.
- `AudioRendererSinkCache::GetSinkInfo` is outside the pinned files, so first-call cache-fill versus IPC/driver cost is untimed. The report already states that limit.
- Chrome `setSinkId` blog text was not re-opened; the constructor-side conclusion does not depend on it.
- No runtime was executed. That is the correct bound for an unchanged constructor path.
