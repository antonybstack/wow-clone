# Remaining frame tails and release-verifier correction

2026-10-07. Production remains qualified source **7d00c56 / Pages 5723a4ab**.
This package adds release QA and current native diagnosis. It does not rebuild,
reseal, deploy, change rendering quality or claim a new FPS/startup result.

## Current evidence

Independent Grok analysis preserves the three historical deferred-audio streaming
windows: p99 21.5–21.6 ms, worst 36.4–38.4 ms, one interval above 33.33 ms in each.
The retained CPU profiles predate audio deferral. They cannot attribute those
later tails. Cumulative frame-to-startup-mark correlation is approximate because
the old recorder did not save its measurement epoch. Neither establishes a CPU,
GPU or compositor cause.

One new instrumented visit uses the exact released immutable URL, a fresh native
Chrome process/profile, the current uncovered maximum seed, disabled HTTP cache,
decimal 50 Mbit/s down/10 up/40 ms, M1 Max, 1280×720/DPR1. CPU sampling is 1 ms;
native GPU API calls, RAF and render-count/pending/waits are observed. Normal W
movement reaches z31.27 after streaming, then z41.61 during sound activation.
Havok, seven enemies, 71 world records, no errors and zero recoveries pass.
Root reviewed actual streamed and sound-enabled game captures: dressed source
pose, ponytail, world and UI remain present. The seed is recorded, but the probe
does not independently assert the entire appearance descriptor/morph family.

Streaming records p99 **21.8 ms**, worst **25.7 ms**. All **90** long observed
render-count transitions have a snapshot of **pending=4**. Native background
installation tops out at **2.1 ms**. No recorded synchronous pipeline/buffer-
creation call exceeds 0.2 ms. The GPU-call wrapper's own sampled CPU cost is
material; this is diagnosis, not an uninstrumented benchmark.

This narrows the next diagnostic to submission/completion/compositor pacing.
Pending counts completion acknowledgements; it does not measure GPU execution.
Observer snapshots are not exact render timestamps. No navigation/CPU-profile
clock anchor was persisted for exact stack-to-frame attribution. Those limits
prevent calling the renderer, GPU or compositor the established cause. The old
36–38 ms singleton is not reproduced by this visit and remains unexplained.

## First sound and rejected native-output trial

The released game's first native AudioContext construction takes **179.1 ms**;
CPU samples attribute **178.8 ms** to the browser constructor. The sound window's
worst render interval is **214.0 ms**. Observed sound readiness is **442.9 ms**
from the pre-click snapshot, including input/fetch/decode time.

Lite 1.31.1 already accepts an existing context through `AudioEngineOptions`.
[Pinned engine](https://github.com/BabylonJS/Babylon-Lite/blob/npm-lite-v1.31.1/packages/babylon-lite/src/audio/audio-engine.ts),
[Chrome output-routing API](https://developer.chrome.com/blog/audiocontext-setsinkid)
and [setSinkId constraints](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/setSinkId)
support a bounded trial without another audio engine.

A second, separately retained visit changes only the document's constructor
proxy: request `sinkId:{type:'none'}`, then call native async `setSinkId('')` to
restore default output. It requests no microphone access or device enumeration.
The one context becomes ready/running, returns default sink `''` with no error,
and preserves movement/Havok/enemy/world controls. Construction still takes
**163.1 ms**, async output routing **32.3 ms**, worst sound interval **200.5 ms**
and sound-ready observation **443.5 ms**. The initial sink object serializes as
`{}`; its non-enumerable type getter was not saved. This is not complete audible
playback or WebKit/physical-device acceptance.

**Rejected without runtime integration.** One visit per variant does not prove a
16 ms gain; the large synchronous hitch remains and readiness does not improve.
Keep existing explicit activation and native playback/mixer/unlock/disposal.
Do not move the hitch back into automatic muted startup or repeat this unchanged
trial. First-play and settled performance retain their qualified results.

## Implemented release QA

The canonical `verify-pages-release.mjs` now:

- Checks all five mutable runtime indices against `no-cache`: region actors,
  Human identity, Human shape, starter world and starter character.
- Records actual and expected decoded response SHA-256 for every build artifact,
  plus actual hashes for both missing-path controls.
- Labels non-OK responses as errors and checks their `no-store` policy separately.
  A missing immutable asset remains a failed status/byte check; correct error
  caching no longer produces a false successful-asset cache flag.

Strict bytes, executable MIME, decoded Brotli WASM, immutable identity/region
policies and genuine missing-file 404/no-store gates remain enforced. Comments
link to HTTP/cache documentation. A transport/body-read exception can still
terminate before a complete report; that broader boundary stays a limitation.
The verifier also leaves the other published shape/texture/startup/JS immutable
policies, presence manifest and extensionless HTML cache policies unclassified.
Those are explicit follow-ups; the five new/current mutable policies are covered.

Seven actual HTTP/CLI controls pass, including stale-cache correct-byte manifests,
missing immutable body/status/hash, wrong executable MIME, older-release mutable
bytes and native Brotli WASM. One read-only production check passes all **552**
rows, including all five mutable policies and both 404 controls. No release cohort
or build is repeated for this QA-only change. Independent Grok review and native
exits are retained in the [receipt](../../../baselines/character-mmo/streaming-tail-2026-10-07/receipt.json).

## Next bounded performance decision

Use existing `createFrameScheduler` to test **4 versus 8 pending acknowledgements**,
retaining default 4 until evidence warrants a change. Keep this an explicit
diagnostic setting; never render from completion callbacks. Declare three
alternating fresh-process pairs on the current maximum fixture, native 1280×720/
DPR1, 50 Mbit/s/40 ms and one renderer, without CPU sampling, API wrappers,
recording, builds or another timing workload. Persist measurement epochs, native
render intervals, sparse pending/waits and first displacement after normal W
input on the same clock. Retain every result and failure.

Require material streaming-tail gain without worse input latency, queued-resource
growth, incomplete world/shadow/woodland membership, altered shape, missing motion,
GPU errors or recoveries. Raising the queue ceiling alone is not a delivered fix.
If constraints fail, remove the trial and retain the cause as open. Exact CPU/
queue/compositor attribution may need one narrowly anchored diagnostic. Keep
closed shader/shadow and silent-output trials closed without material new evidence.

Mixed-fit/boot work can proceed independently. Physical iPhone acceptance,
original 14/60 fetch failures and the preview 362 ms input upper bound remain
open. Raw artifacts/scripts are in `.cache/character-mmo/streaming-tail-2026-10-07/`.
Both diagnostic browsers are closed. No visual product change was made; previous
reviewed motion is reused.
