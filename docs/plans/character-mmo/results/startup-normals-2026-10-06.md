# Character normal precision investigation — 2026-10-06

**Historical offline investigation.** Integration is now being verified in the
[startup normal release candidate](startup-normal-release-2026-10-06.md), after
the bundling preview reduced the remaining miss to 25 ms. The decisions below
record the earlier, larger startup gap.

**Original conclusion: offline candidate only; no published assets or runtime changes.** Normal-only
packing saves too little to justify asset regeneration and visual acceptance as
the next one-second startup intervention. Keep the tested helper available for a
future asset pass. Production remains `6004840` / `e39117b8`.

`scripts/character-assets/quantize-character-normals.mjs` uses existing glTF
Transform and meshoptimizer APIs. It checks the rendered triangles, preserving
positions, morph positions, UVs, weights, binds, source animation, texture bytes
and winding. Lossless meshoptimizer may cyclically rotate triangle corners;
native quantization may remove unused vertices even with cleanup disabled.
The proof accommodates those representation changes without accepting changed
rendered attributes. Six focused tests pass, including shared-accessor isolation
and deliberate geometry, skin and animation mutations.

Fixed signed 16-bit normals are unsuitable for most of this pack: morph normal
offsets exceed −1…+1 in seven of nine assets. The helper rejects them before the
native transform can clamp them. Boots and Bastion alone save 44,602 bytes,
about 7.14 ms of theoretical payload time at 50 Mbit/s.

Meshoptimizer's EXPONENTIAL filter at 16-bit precision supports those offsets.
The helper rounds and decodes offline to Float32, retaining the existing lossless
meshopt/gzip delivery and runtime decoder. All nine candidate proofs pass;
maximum component error is 0.000030518, within the explicit 0.0001 limit.
Each control serialization is byte-identical to its published asset. No vertex,
node or primitive count changes and no new glTF extension is required.

| Compact asset | Published bytes | Candidate bytes | Saved |
|---|---:|---:|---:|
| Prime bald | 815,738 | 750,302 | 65,436 |
| Prime ponytail | 1,115,442 | 1,013,658 | 101,784 |
| Weathered bald | 820,973 | 754,971 | 66,002 |
| Hood | 197,700 | 177,087 | 20,613 |
| Pilgrim tunic | 315,468 | 282,390 | 33,078 |
| Skirt | 203,047 | 181,723 | 21,324 |
| Boots | 157,978 | 142,031 | 15,947 |
| Gloves | 93,745 | 85,765 | 7,980 |
| Bastion shoulders | 83,152 | 74,049 | 9,103 |

The saved startup fixture uses the ponytail body and six clothing pieces:
**209,829 bytes / 9.69% saved**, equivalent to **33.57 ms** at 50 Mbit/s before
protocol, concurrency and decoding effects. This is not a measured load-time
improvement. It does not close the observed 100–220 ms gap by itself.

Do not insert these candidates into preparation or relax existing exact-normal
hood-opening/full-versus-compact proofs automatically. An integrated asset pass
would require explicit bounded proof contracts and live lighting/fit/motion
review. This investigation generated no game renderer and requires no media
delivery. Grok 4.6/high ran the tests and asset checks; parent owns the helper and
this acceptance decision.

[Tracked receipt](../../../baselines/character-mmo/startup-normals-2026-10-06/receipt.json).
Raw evidence: `.cache/character-mmo/startup-normals-2026-10-06/`, especially
`exp16/ops.md`, `exp16/table.json`, `exp16/unit.log` and per-asset receipts.
The first fixed-format table's reused clothing-control annotation is superseded
by the actual per-asset controls in the exponential-format pass.

References are adjacent to implementation: [native quantize](https://gltf-transform.dev/modules/functions/functions/quantize),
[meshoptimizer filters](https://github.com/zeux/meshoptimizer/tree/v0.22/js).
