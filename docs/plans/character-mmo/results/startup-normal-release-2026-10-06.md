# Compact character normal precision — 2026-10-06

Candidate in verification; production remains `6004840` / `e39117b8`.
This follows the native saved-bootstrap candidate and its 1,025.1 ms worst start.
The observed critical requests already use High priority, so prioritization did
not offer a supported next intervention.

The existing meshoptimizer exponential filter rounds eligible compact normal and
tangent vectors at 16-bit precision, then decodes offline back to Float32. The
native Lite loader and runtime path are unchanged. Unlike fixed signed normal
quantization, this supports morph offsets beyond ±1 without clamping them.
Positions, UVs, skin weights, morph positions, source curves and bind transforms
remain exact. Maximum permitted normal component error is 0.0001. Bodies retain
their 22 playable source clips; full 57-clip sources remain available unchanged.

Full published assets, compact hoods with their protected opening records, and
rigid/mixed plate pieces remain byte-identical. Clothing rounding precedes the
existing exact coverage partition proof. Manifest policy records the source
geometry fingerprint, fixed tolerance and measured error; independent tests read
the actual assets and compare their surfaces and source samples.

An initial integration passed correctness checks but grew the identity files:
orphaned authoring morph targets retained the original normal buffers alongside
the rounded replacements. Native `prune` now removes detached primitives/targets
before unused accessors and buffers. A regression fixture reproduces that retention
without changing any live geometry. The failed size result remains in raw evidence.

The corrected ponytail/hood/Bastion fixture is **1,986,208 bytes**, down from
2,166,532: **180,324 bytes saved**. That equals 28.85 ms of theoretical payload
time at 50 Mbit/s, not a measured playable-time improvement. All 61 focused asset
and proof tests pass; both production manifest verifiers pass. The local build, ten prefetch checks and eleven compact identity live cases pass.
Three identities were reviewed in live motion; public timing gates remain open.

References: [meshoptimizer filters](https://github.com/zeux/meshoptimizer/tree/v0.22/js),
[native prune](https://gltf-transform.dev/modules/functions/functions/prune).
Raw evidence: `.cache/character-mmo/startup-normal-release-2026-10-06/`, including
`attempt-1/`, corrected `compare.json`, asset tests and the source-review receipt.

## Preview and motion

Source `cf43894` is pushed. Immutable Pages preview
`5f312add-f747-477d-bc8a-9b583028e2a0` passes 536 delivery checks (534 files and
two missing-file controls). Build uses `ASHEN_SAVED_BOOTSTRAP=1`; default builds
still use the released split graph. No production promotion yet.

Reviewed local clips cover compact/full handover, source motions, hair restoration
and normal Havok controls on Prime bald/ponytail and Weathered bald. Telegram
**870** carries the ponytail clip with matching returned 1280×720 dimensions;
[VE MP4](https://ve.sparkify.dev/wow-clone/ashen-reach/character-mmo/startup-normal-2026-10-06-prime-ponytail.mp4)
returns the exact bytes and range 206. Root observed advancing inline/expanded
Telegram and inline VE playback with correct proportions. Fullscreen requests
were rejected by this browser despite fullscreenEnabled=true; actual fullscreen
is unverified for this clip. Capture HUD numbers are not performance evidence.

## Corrected maximum-payload fixture

The historical fixture is **not** the largest supported outfit. The new
`prepare-startup-budget-fixture.mjs` uses actual compressed descriptors and the
existing equipment occupancy validator, checking all 10,368 combinations
(9,072 valid) for all four Human identities. It deduplicates shared URLs just as
the runtime does and refuses missing/invalid size metadata. Three focused tests
and Grok's independent descriptor sums pass.

Current maximum: **2,300,424 bytes**, Prime ponytail + hood + Duskguard cuirass,
greaves and vambraces + Graveweaver skirt + Bastion shoulders. Procedural staff
and book add no GLB bytes but stay equipped in the timing fixture. This is
**314,216 bytes** heavier than the historical fixture. Code, world, manifests and
procedural geometry are outside this asset subtotal. Maximum transfer bytes do
not prove maximum GPU cost. Historical cohorts retain their original workload;
new maximum and historical timing results are reported separately.

Generate after asset/catalogue changes:

```sh
node scripts/character-assets/prepare-startup-budget-fixture.mjs <evidence-dir>
```

Use the generated `seed-maximum-compact.json` for the saved startup probe and
retain `maximum-compact-budget.json` with the receipt. Do not hand-label a fixed
outfit “largest” after the catalogue changes. Current generated recipe and budget
are retained in the tracked baseline directory; raw verifier evidence remains in
`budget-verify.md/json` in the task cache.

## Public gates and decision

[Receipt](../../../baselines/character-mmo/startup-normal-release-2026-10-06/release-receipt.json)
retains all forty cold starts, sixteen FPS rows, raw-file hashes and conditions.
Three entry aliases, normal spawn movement/four cathedral shape-corner returns,
mobile touch, forced depth fallback and WebKit pass. Root inspected actual mobile
and first-play captures. Physical iPhone remains unverified.

M1 Max, 1280×720/DPR 1, seven enemies, uncapped Chromium launch flags, no recording,
three 12-second runs per route with the maximum-payload outfit:

| Route | Mean FPS range | Maximum p99 ms | Worst ms |
|---|---:|---:|---:|
| Meadow | 201.34–201.58 | 6.2 | 9.6 |
| Town | 203.35–204.06 | 6.1 | 11.2 |
| Bridge | 239.05–243.81 | 5.4 | 9.6 |
| Cathedral | 239.34–239.64 | 5.4 | 9.1 |
| Forest | 224.14–228.70 | 5.7 | 9.2 |

No frame exceeds 16.67 ms. Bridge/cathedral carry possible-240-Hz statistical
pacing hints; these are **not confirmed compositor caps or accepted uncapped
limits**. The first bridge row (239.17 FPS) halted the initial script. It remains
in the receipt alongside the continuation collected with `ASHEN_RECORD_CAPPED=1`.
No passed meadow/town runs were repeated. This outfit differs from historical
production benchmarks; no paired improvement or regression is established.

Cold probes use the actual root URL, fresh Chromium process/profile per visit,
disabled HTTP cache, 50 Mbit/s down/10 up/40 ms latency, 1280×720/DPR 1. OS,
GPU-driver and CDN caches are uncontrolled. All forty dressed/grounded starts
and input checks pass without recorded runtime/GPU errors.

| Saved fixture | p95 ms | Worst ms | Misses above 1,000 ms |
|---|---:|---:|---:|
| Catalogue-derived maximum | 1,001.0 | 1,177.1 | 2/20 |
| Historical hood/cloth/Bastion | 936.9 | 1,220.9 | 1/20 |

**Both strict gates fail; do not promote.** The normal packing reduces actual
asset bytes and passes compatibility/visual review, but does not establish the
public one-second target. Retain all outliers; no favorable repeat replaces them.

Maximum run 18 receives its HTML by 193.8 ms, store by 338.8 ms, stylesheet by
461.7 ms and starts its body at 487.1 ms; Lite finishes at 745.7 ms and the body at
966.0 ms. Historical run 16 instead finishes HTML at 432.9 ms and body at
1,012.8 ms. These are different delays, not one proven CDN or GPU defect.
The generated neutral-pack inline script follows the stylesheet and precedes
both the saved catalogue and async preload module. Per the
[HTML script processing model](https://html.spec.whatwg.org/multipage/scripting.html#prepare-the-script-element),
this can hold parser progress behind CSS. A held-stylesheet control is the next
bounded investigation; no CSS fix or measured speed gain is claimed yet.

The initial cold brief mistakenly named the direct `.html` alias, which Pages
redirects. Root corrected it before either cold cohort started. Settled FPS uses
that alias, as recorded; cold timing uses `/` consistently with the baseline.

## Confirmed stylesheet discovery barrier

The held-CSS control reproduces the dependency on the real preview. With its
stylesheet withheld for 1.5 seconds, original HTML has no parsed identity
catalogue and makes zero body requests. Moving only the neutral preload script
before the stylesheet yields the catalogue and one body request while CSS is
still held. After release, both variants reach readiness with the exact maximum
saved recipe, Havok and no GPU/page errors; each makes one shared body request.
This establishes ordering, **not a measured startup-time improvement**.

The first probe called a nonexistent `ASHEN.creator.getAppearance()` method and
failed after readiness. Root corrected it to the existing `ASHEN.getAppearance()`
API, preserved the failed run, and made held-state observations persist before
subsequent assertions. The corrected control passes; its JSON is tracked with
the baseline. No product defect is inferred from that probe failure.

The build now inserts the neutral script before the first generated stylesheet,
after the existing entry/module hints. CSS keeps its normal rendering behavior;
saved recipe validation, source assets and readiness fences are unchanged. Native
HTML ordering resolves the dependency without another loader. All 23 focused tests, the build, ten prefetch cases and the actual fixed-build
held-CSS check pass. That last check intercepts CSS but does not rewrite HTML:
the catalogue and one saved-body request appear before release, then the exact
saved appearance and Havok reach readiness without errors. Only `index.html` and
`ashen-reach.html` differ among 535 build files; every asset/runtime binary is
unchanged. New public timing remains pending.


## CSS candidate public failure — retain, do not promote

Source `1de0bba` was uploaded as preview `05f75b6e.fardel.pages.dev`; production
remains `6004840`. The sealed build passes all 536 delivery checks and the public
held-CSS control. Bare-root entry nevertheless times out after 120 seconds.
The subsequent three declared twenty-start cohorts were completed and retained;
continuing timing after that functional failure was inefficient. Future release
operations must stop new cohorts at a failed entry gate and return diagnostics.

| Fixture | Valid starts | Failed starts | Valid-row p95 / worst ms | Valid starts over 1 s |
|---|---:|---:|---:|---:|
| Default | 14/20 | 6 | 1,704.4 / 1,704.4 | 2 |
| Maximum compact | 15/20 | 5 | 1,954.9 / 1,954.9 | 9 |
| Historical hood/cloth | 17/20 | 3 | 2,227.7 / 2,227.7 | 14 |

Every failed row records `TypeError: Failed to fetch` and a readiness timeout.
The displayed percentiles exclude failures and **are not passing cohort results**.
No request in those original failed rows lacks a completed response; the original
probe omitted `Network.loadingFailed` and full error stacks. Cause is unresolved,
so neither a CDN failure nor an HTML-order regression is established yet.
The [failure receipt](../../../baselines/character-mmo/startup-normal-release-2026-10-06/css-public-failure.json)
retains all sixty outcomes, conditions, raw-file hashes and deployment metadata.
A bounded comparison diagnostic replaces further timing until this is understood.


## Bounded follow-up — failure not reproduced

The unchanged preview passes three entry aliases, then six alternating fresh
contexts against the old/new hosts with cache disabled and the same 50 Mbit/s /
40 ms policy. A separate declared six-start diagnostic uses fresh browser
processes and records **882.6 / 727.5 / 722.0 / 708.9 / 705.7 / 762.3 ms**.
All six are grounded, use Havok, render at 1280×720 and respond to real keyboard
input without recorded errors. Root reviewed the actual first-play capture.
These are diagnostics, **not a replacement release cohort or evidence of a fix**.

The two entry/startup probes now preserve visible loading-error stacks and native
request failures before cleanup, and exit early once a terminal loading error is
visible. The entry checker disconnects in `finally`. A socket-aborting local
fixture verifies both negative paths: startup probe exits 1 in 948 ms, entry
exits 1 in 458 ms, both retain `/forced-failure.bin`, `net::ERR_EMPTY_RESPONSE`
and the actual stack. This fixture validates diagnostics only; it does not show
that the public failure had that cause. No game runtime, asset or bundle changed.

[Diagnostic receipt](../../../baselines/character-mmo/startup-normal-release-2026-10-06/fetch-diagnostic.json)
retains successful diagnostic outcomes, the negative control and hashes of raw
records. Cause remains unresolved. Keep production unchanged and use a concrete
failure stack/URL for any subsequent correction; do not add speculative retry
logic or silently erase the earlier failures.

Both modified probes pass syntax checks; twelve startup-budget/saved-preload tests
pass. All owned browsers, probe processes and the local failure fixture are closed.
Temporary media guards are removed; no game page remains in Edge. The signed-out
Cloudflare tab is retained for the previously offered optional account check.
