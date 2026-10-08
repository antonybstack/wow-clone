# Root response to the independent Grok review

The original read-only review is retained as `review.md`; its claims are not
rewritten to match the outcome. Product implementation uses native Lite 1.31.1
buffer and sound factories. The runtime was unchanged after the six comparisons.

## Valid feedback implemented

- The first GainNode probe was blind. Lite constructs `new GainNode(ctx)` rather
  than calling `ctx.createGain()`. The corrected constructor proxy observes
  native graph attempts; successful initialization observes four gains, capture
  five, held-dispose/failure two. Nine corrected game cases pass with zero graph
  attempts after context closure. The initial blind-probe result is retained and
  is not used as late-graph acceptance.
- Added native `unhandledrejection` observation. Every corrected game case has
  an empty list. A bare rejection control is detected, proving the listener is
  live. A closed-context GainNode attempt is also detected by the same probe.
- Rebuilt the sequential implementation with a diagnostic Vite `load` override
  into a separate output directory. Every one of the measured tree's 202
  JS/CSS/HTML/Havok files is byte-identical to the reproduced baseline. All 382
  served public payloads match both candidate and reproduced baseline. The first
  comparison included generated `_headers` metadata and correctly differed:
  candidate Link headers refer to changed hashed JS filenames. Reproduced
  baseline headers are exact; other header text is unchanged. Both comparisons
  are retained. No live source/dist mutation or repeated timing campaign.
- Result prose now names `postReadyTails` as a secondary RAF readiness observer,
  not game render-loop FPS. All actual game intervals across activation are
  retained separately; the constructor hitch is still visible.

## Claims rejected with evidence

`Promise.all` does not abandon rejection handlers on a late input when its
aggregate rejects. The ECMA algorithm registers both fulfillment and rejection
reactions on each input in PerformPromiseAll:
https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-performpromiseall
The native blank-page control catches the early rejection, lets a second input
reject later, and observes zero unhandled rejections. The same listener detects
the deliberately bare rejection. Both native invalid-WAV/held-sibling game
controls settle two decodes after cleanup with zero unhandled rejections and no
new graphs. No allSettled workaround or extra runtime catch is warranted for
the claimed orphan rejection.

The historical 179 ms constructor investigation also launched headless native
Chromium (`streaming-tail-2026-10-07/profile-current.mjs`, headless:true). There
is no headed/headless mismatch with this comparison. This receipt explicitly
records native headless Chrome 154.0.8037.98, M1 Max and the other conditions.
It is not physical speaker-latency or current iPhone evidence.

The operator's `passed` is functional completion and `performanceGate` is a
separate declared comparison result. Root checked both actual fields: both are
true and all three pairs pass. Future use must inspect both, not CLI exit alone.

## Acceptance scope

Held fetch, either invalid decode, disposal, duplicate in-flight preparation,
explicit pointer/keyboard/desktop touch gestures, capture and Fire Blast pass.
Retry after failure is not a new runtime feature; the cached failed preparation
behavior is unchanged. Lava/pulse options and wrappers are unchanged. Their
complete audible paths and a hypothetical microtask disposal inside the native
sound factory's internal await are outside this pass's proved coverage. Do not
claim universal lifecycle timing or subjective audible acceptance.

The exact MP4 was replayed by root in Edge. Starting-area fence, movement,
sound activation, Fire Blast and subsequent movement retain their proportions.
Native master-mix Opus was aligned to capture timestamps and muxed to AAC;
decoded PCM is nonzero. No microphone/system audio was captured. Recording is
excluded from timings. Production, required-texture hold, original 14/60 fetch
failures, 362 ms input outlier and current physical iPhone exits remain open.
