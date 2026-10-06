# Startup headroom — Havok transport release

The identical Havok 1.3.14 WASM now transfers as 501,493 bytes instead of the
previous production response's approximately 641,351 bytes (21.8% smaller).
Committed/pushed source **0d577d27cc53bca05b2f695c45922458cf54c0b0** is production
Pages **f6265788-d4fd-45fe-abae-76f9c3d23247**, deployed 2026-10-06 03:57 UTC.
Rollback is accepted M8 source **5fba4d8**, Pages
**63b6e02b-c93f-4b85-aebf-f2ae79bfb8a6**. No rollback was needed.

This is a transport improvement, **not completion of the one-second largest-outfit
startup target**. The [tracked receipt](../../../baselines/character-mmo/startup-headroom-2026-10-05/receipt.json)
contains every final timing row, conditions, failures and evidence hashes.

## Implementation and verification

The Vite build emits a Brotli-compressed, content-addressed WASM resource. The HTML
preload and Emscripten `locateFile` use the same URL. Cloudflare serves native
`Content-Encoding: br`, `Content-Type: application/wasm` and immutable caching;
Emscripten retains its native `WebAssembly.instantiateStreaming` path. No custom
runtime decoder, physics replacement, world geometry or character asset change.

Three delivery contract tests and relevant existing startup/ground support tests
pass (20 total). Entry checks now assert one matching preload/fetch, successful
native streaming compilation and no ArrayBuffer fallback. All **537 served files**
match the sealed build on both real Pages preview and production. Raw WASM remains
2,094,563 bytes and byte-identical after HTTP decoding. Seal SHA256:
`5bf4532dcada95cf9aa71f60f371eecdf1f45f49d23f6fdf8e6bf75b8789243d`.

Native cathedral bridge entry/exit round trips pass on preview and production,
with Havok active, zero recoveries and no runtime/GPU errors. Mobile eight,
forced depth fallback eight and WebKit four pass. Physical iPhone testing is
separate and was not repeated.

## Isolated measurements

M1 Max, native 1280×720/DPR 1. Cold runs use fresh Chromium processes/profiles,
HTTP cache disabled, decimal 50 Mbit/s down, 10 up and 40 ms latency. OS, GPU-driver
and CDN caches are not reset. Twenty starts per final profile:

| Cohort | Median | p95 | Maximum | Over 1 second |
|---|---:|---:|---:|---:|
| Local largest hood/Bastion | 879.3 ms | 885.8 ms | 885.8 ms | 0 |
| Public default | 714.3 ms | 746.2 ms | 763.3 ms | 0 |
| Public original-largest/Bastion | 834.5 ms | 881.9 ms | 991.3 ms | 0 |
| Public largest hood/Bastion | 949.1 ms | **1,021.6 ms** | **1,021.6 ms** | **2: runs 9, 11** |

The local largest-outfit result is effectively unchanged from M8's 886.3 ms p95;
do not infer a CPU startup improvement from the byte reduction. Public cohorts are
sequential network samples, not a paired causal measurement of the transport gain.
The earlier exploratory public hood cohort is retained separately: p95 976 ms,
max 1,064.8 ms. Its first two rows overlapped a finishing Telegram upload, so it is
ineligible for acceptance. The later isolated confirmation was declared before
running it; it does not erase the exploratory run-17 miss.

Three separate uncapped native bridge runs, seven enemies, 12 seconds each,
measure **242.6 / 243.6 / 247.8 FPS**, maximum p99 **5.5 ms**, worst interval **9.7 ms**,
zero intervals above 16.7 ms. No recording, encoding, uploading or media playback
ran during these samples. Statistical pacing hints are retained; the native
RAF-only scheduler is unchanged. These are throughput, not monitor-refresh claims.
M8's prior five-route baseline remains the broader world performance evidence.

## Rejected experiments and next bounded investigation

A native asynchronous ShaderMaterial preparation experiment improved a local
five-run median by only about 6 ms. It was removed. A more aggressive one-shot
world-only first frame appeared roughly 110 ms faster, but was rejected before
publication: missing morph initialization first produced invalid WGSL; priming
that feature removed those initial errors but held-body/full-region live checks
then exposed a bind-pose actor and invalid GPU sampler bindings. Timing-only
readiness probes did not catch that later failure. The rejected implementation
is absent from both HEAD and production.

The next startup investigation should target **when validated body bytes are
requested and transferred**, retaining normal actor-before-first-register ordering.
In isolated miss 9 the body transfer ends at 796 ms, followed by parse/equipment
and approximately 100 ms of first GPU completion work. Inspect the existing early
saved-appearance bootstrap, shared request promises and sealed identity catalogue
before adding infrastructure. A build-owned compact catalogue or earlier validated
selection might remove a request dependency; it is a hypothesis, not an approved
implementation or measured win. Preserve save migration, provenance checks, exact
URL/request reuse, failure handling and dressed/grounded readiness. Asset quality
reductions and another renderer are not justified by this evidence.

Require a quick full-region native motion/error check before any large timing
matrix. If a candidate is correct, measure one fixed isolated cohort, compare
frame-time tails, and then run the established production release gates. Keep
M6 boot/mixed-fit work next after this bounded startup decision; M6 is still open.

## Motion, review and cleanup

Telegram **864**, verified returned 1280×720, square pixels, normalized rotation,
19.449 seconds. [VE video/mp4](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/havok-startup-2026-10-05.mp4)
shows the saved hood/Bastion actor, progressive loading and movement. Recording
is not startup/performance measurement. Source motion, Telegram Web A inline,
expanded and actual VIDEO fullscreen, and direct VE normal playback were reviewed
with correct proportions. The direct VE media document blocked the automation
fullscreen command; VE fullscreen for this clip and Telegram Desktop are unverified.

Two Grok 4.6/high read-only reviews informed streaming-contract checks and identified
warmup initialization/cleanup concerns. Root performed implementation, all rendering
and visual rejection. No worker owned a game renderer.

Root Chrome 80497/CDP 10037, Vite 5873, compressed preview 7074, Pages emulator 7175,
all probe browsers and temporary review tabs are closed. Original user Edge/Orca
sessions remain. Temporary media guards are removed; only the two references that
were originally playing were resumed. The emulator's double-encoding failure,
failed prototypes, captured frames and logs remain in
`.cache/character-mmo/startup-headroom-2026-10-05/`. Local emulator failure was never
used to weaken production MIME/decoded-byte validation. Unrelated AGENTS.md and
local cache changes are preserved.
