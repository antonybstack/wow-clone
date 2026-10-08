# Parallel native BUFFER fetch/decode — read-only review

**Verdict:** The focused change is the right Lite 1.31.1 shape: decode both URLs with `createSoundBufferAsync`, then `throwIfAborted`, then `createSoundAsync` from already-decoded buffers. That keeps sound-subgraph construction off a disposed engine for held-fetch and sibling-decode races. One consequential lifecycle bug remains on sibling failure. Late-graph native proof is aimed at the wrong Web Audio constructor. No fitter/engine rewrite. Original startup hold remains. No performance, audible, or iPhone claim.

## Product (`src/ashen-reach/fire-blast-audio.js`)

Initialization, duplicate `prepare`, muted gestures, mobile menu unlock, capture, and playback wrappers are the sequential control surface with the load step swapped. Engine still starts only on explicit `prepare` / unmute (`17–46`, `58`). `if (preparation) return preparation` is unchanged. `unlock` still requires `!muted && engine`. Capture still requires both sounds (`62`). `play` / lava / pulse still require `engine.state === 'running'` (`52–57`).

Lite: `createSoundBufferAsync` fetch+`decodeAudioData` only (`sound-buffer.js:28–43`); `createSoundAsync` then `createSoundSubGraph` (`static-sound.js:24–26`, `sound-sub-graph.js:18–19` `new GainNode(ctx)`). Passing the returned `SoundBuffer` hits `_audioBuffer` reuse (`sound-buffer.js:40`).

Dispose order: `sceneLifetime` aborts first (`scene-lifetime.js:10`), then this module’s `release()` (`fire-blast-audio.js:11`). After `await Promise.all` the next `throwIfAborted` (`33`) is the same microtask, so a macrotask dispose cannot sneak a graph in at that line.

## Consequential bug

**Orphan sibling rejection after `Promise.all`.** `fire-blast-audio.js:29–32`.

Sequence (matches new cases `check-deferred-audio.mjs:92–109`):

1. Unmute starts both `createSoundBufferAsync` jobs.
2. Failed file fulfills invalid WAV; `decodeAudioData` rejects; `Promise.all` rejects immediately.
3. `.catch` (`40–43`) `disposeAudioEngine` → `AudioContext.close`.
4. Held sibling `route.continue()` later: `loadAudioArrayBuffer` has no abort (`audio-fetch.js:27–30`), then `engine._ctx.decodeAudioData` on a closed context rejects.
5. That rejection is on the job `Promise.all` already abandoned. Combat swallows only the `prepare` promise (`combat.js:179`). The sibling rejection is unhandled.

Same hole if scene dispose wins the race while one URL is still in flight (`79–88`), and the survivor’s late decode rejects.

This is the named “either sibling decode failure / late resolution” path. Buffers still do not call `createSoundSubGraph`. The defect is the leftover rejected promise (and any console/`unhandledrejection` the native cases treat as failure).

## Missing targeted lifecycle proof

1. **`createGain` probe is blind to Lite graphs.** `check-deferred-audio.mjs:21,29` and the all-case assert at `35`. Lite never calls `AudioContext#createGain`; graphs are `new GainNode(ctx)` (`sound-sub-graph.js:19`, `bus.js:15,32`, instance volume `static-sound.js:157`). `gainCount` / `gainsAfterClose` stay 0 even if a late `createSoundAsync` ran. Closed-context `InvalidStateError` plus `ready:false` is the remaining evidence; there is no `GainNode` constructor probe and no `engine._sounds` check.
2. **No `unhandledrejection` listener.** Cases only collect `pageerror` and console `error` (`15`). The sibling-failure sequence above can pass those asserts while still rejecting.
3. **Held-dispose waits for `decodeSettled===1` (`83`) then closes; it does not prove dispose after both buffers have resolved, during `createSoundAsync`’s internal `await createSoundBufferAsync` (`static-sound.js:25`) before `createSoundSubGraph`.** Playwright dispose is a macrotask, so that window is narrow; it is still untested.
4. Retained lava / pulse / `maxInstances` paths are unchanged in `52–57`; native proof is still one `Digit1` blast (`60`). Duplicate prepare is only the in-flight identity check (`70–71`), not retry after a failed parallel pair.

Covered as written: muted boot/cast (`50–57`), pointer unmute, capture+dispose stream, remute/keyboard resume, keyboard-first, mobile menu tap (`68`), construction failure, dispose with no audio request, both failed-file names with a held sibling.

## Prepared six-visit comparison

`declaration.json` order `sequential,parallel,parallel,sequential,sequential,parallel` with `pair=floor(i/2)+1` (`run-comparison.mjs:28,70`) groups the three adjacent pairs correctly.

Clocks for activation / after-constructor (`60–61`) are `readyAt − clickedAt` and `readyAt − AudioContext construct end`. That isolates post-constructor load from the known constructor hitch. Network throttle bytes/s and 40 ms latency match the declared 50/10 Mbit + 40 ms.

**Integrity hole that can invalidate all six pair rows:** `declaration.json` records `baselineCompiledProductInputs`, `baselineAudioSha256`, `candidateAudioSha256` (`4–6`) and never uses them. The runner only asserts live source vs `candidateProductInputs.sha256` (`26`). `sequential-dist` is an unchecked copy of whatever `dist` was at operator start (`run-operations.py:15`). A wrong sequential tree still emits three pair objects.

**Condition mismatch:** visits launch `headless:true` (`run-comparison.mjs:36`) while `declaration.json` `conditions.nativeChrome` is “uncapped WebGPU”. Headless AudioContext / decode / RAF are a different measurement than the headed constructor hitch cited in `fire-blast-audio.js:12`.

**Post-ready p99** (`62,70`) is a second click-started `requestAnimationFrame` poll (`44–49`), not `ASHEN.renderLoop` samples (`row.tails` is unused by the gate). With `--disable-frame-rate-limit` that p99 is a weak hitch meter; it does not invert the activation clocks if both variants use it.

`report.passed=true` even when `performanceGate` is false (`72`). That mislabels the operator exit; it does not rewrite the six numbers.

Node preview HTTP can overlap the two `.wav` reads (wav is not the brotli-precompressed set).

## Scope

Touched product path: `fire-blast-audio.js`, `check-deferred-audio.mjs`. Lite audio engine/fitter untouched. Production / startup hold / 14/60 / 362 ms / physical iPhone unchanged.
