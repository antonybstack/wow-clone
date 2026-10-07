# Lossless character delivery census — 2026-10-07

Offline census against **865cf7d**. No runtime asset, manifest, loader or delivery
header changed. This records byte savings, not measured startup time or FPS.
The native one-second/public release gates remain open.

## Native Brotli

The existing Havok and prepared terrain delivery already uses HTTP Brotli.
This trial compresses each selected compact character GLB directly with native
Node Brotli (qualities 5, 9, 11), validates its existing decoded size/SHA and
verifies exact byte-for-byte Brotli roundtrip. It adds no JavaScript decoder.

| Outfit | Current gzip bytes | Brotli Q11 bytes | Saved bytes | Ideal transfer saving at 50 Mbit/s |
| --- | ---: | ---: | ---: | ---: |
| Default | 1,032,164 | 989,413 | 42,751 | 6.8 ms |
| Prime bald maximum gear | 2,037,273 | 1,898,777 | 138,496 | 22.2 ms |
| Prime ponytail maximum | 2,300,424 | 2,146,256 | 154,168 | 24.7 ms |
| Weathered bald maximum gear | 2,043,747 | 1,905,257 | 138,490 | 22.2 ms |

The ideal values use saved bytes × 8 / 50,000,000. They exclude contention,
latency, browser decoding and execution, and are not a prediction of first play.
Maximum's body alone saves 69,112 bytes. Quality 5/9 saves only 25,824/61,598
bytes for the complete maximum outfit. Q11 saves 6.7% of that outfit's payload.

Keep this option unpublished: it does not alone establish meaningful headroom
against the retained default/maximum public misses. Any later integration must
update the explicit immutable URLs, manifest transport/encoded-byte accounting,
Pages/local `Content-Encoding` headers, integrity checks and native failure tests.
Preserve the exact decoded GLB; do not route HTTP-decoded Brotli through the
existing explicit gzip `DecompressionStream`.

References: [HTTP Content-Encoding](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Encoding),
[Pages headers](https://developers.cloudflare.com/pages/configuration/headers/),
[Pages content delivery](https://developers.cloudflare.com/pages/configuration/serving-pages/).

## Native accessor deduplication

Reuse glTF Transform `dedup({propertyTypes:[PropertyType.ACCESSOR]})`, with the
existing NodeIO, separate vertex layout and Meshoptimizer dependencies. Compare
each body with an unchanged reserialization control. No mesh/material/skin merge,
resampling, quantization or pruning is included.

| Body | Accessors before → after | Original → dedup gzip bytes | Saved bytes |
| --- | ---: | ---: | ---: |
| Default | 1,633 → 1,161 | 471,314 → 463,469 | 7,845 |
| Prime bald | 1,184 → 1,184 | 750,296 → 750,296 | 0 |
| Prime ponytail | 1,194 → 1,194 | 1,013,447 → 1,013,447 | 0 |
| Weathered bald | 1,184 → 1,184 | 754,893 → 754,893 | 0 |

All four unchanged controls reproduce the original decoded and gzip bytes.
Identity dedup outputs also reproduce those exact bytes. Default removes duplicate
accessors and saves 158,724 decoded bytes, but only 7,845 wire bytes. The combined
default body dedup/Brotli saves 29,801 bytes versus 25,094 for Brotli alone.
This does not address maximum's critical path; close the option without integration.

The written native proofs require exact geometry, all 22 source animation sample
arrays, node/skin/bind transforms, textures, mesh/coverage structure, and every
rendered attribute/morph/normal component. Measured component error is **zero**
for all eight written variants. Reuse the existing independent geometry/animation
and character surface proof functions, allowing only lossless triangle corner
rotation during Meshoptimizer serialization.

The installed dedup implementation visits primitive attributes/indices and
animation sampler inputs/outputs. Its accessor path does not visit morph targets,
despite the broader API description. Do not infer extra morph sharing from that
description or replace it with a custom implementation for this small saving.
[Native dedup documentation](https://gltf-transform.dev/modules/functions/functions/dedup).

The first dedup run failed before reading assets because the worker's working
directory doubled the relative cache path. That attempt is preserved separately.
The corrected probe resolves assets and outputs against its module URL and passes.
Neither failure nor corrected result is a game startup cohort.

Raw cache: `.cache/character-mmo/startup-http-br-2026-10-07/` (`census.json`,
`dedup-census.json`, scripts, logs, exits and `attempt-1-*`). No browser was opened,
no timing run performed, no public asset published and production is unchanged.
[Tracked receipt](../../../baselines/character-mmo/startup-lossless-census-2026-10-07/receipt.json).
