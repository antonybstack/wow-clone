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
