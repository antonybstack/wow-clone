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
and proof tests pass; both production manifest verifiers pass. Live visual,
compatibility, startup and release gates are still pending.

References: [meshoptimizer filters](https://github.com/zeux/meshoptimizer/tree/v0.22/js),
[native prune](https://gltf-transform.dev/modules/functions/functions/prune).
Raw evidence: `.cache/character-mmo/startup-normal-release-2026-10-06/`, including
`attempt-1/`, corrected `compare.json`, asset tests and the source-review receipt.
