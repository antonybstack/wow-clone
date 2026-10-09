# Region navigation byte analysis — 2026-10-09

Source **9237092**, G06 product1b35554. No product edits, new runtime measurement,
visual qualification, benchmark or production promotion. This is evidence for the
[proposed next loading experiment](../../plans/gothic-exploration/region-navigation-core-2026-10-09.md).

`distribution.json` counts existing decoded block attributes by source mesh. The
categories do not overlap; "other collision" includes visible terrain and hidden
collision meshes, and "cathedral" includes its visible and collision meshes.
Do not interpret either category as a separate measured collision time.

`packet-estimate.json` records **offline Brotli quality11** of the unchanged source
arrays split into a whole physical/visible core with reduced woodland, then full
woodland detail. Near/foliage are untouched. Core14,389,733 encoded bytes versus
current22,401,010; combined split25,030,520, an11.7% extra transfer. The2.30s ideal
50Mbit/s core transfer is arithmetic, not native load time. Its91.47s/35.22s
compression timings are asset-bake CPU work, not runtime decompression.

To reproduce from repository root with the retained G06 packet files:

```sh
node docs/baselines/region-navigation-analysis-2026-10-09/estimate.mjs
```

The script validates the expected content-addressed packet and its encoded hash,
decodes existing bytes, separates existing block ranges, recompresses in memory
and writes only `.cache/region-priority-2026-10-09` receipts. It does not generate
world geometry, alter public assets, open a browser or exercise startup. Run it
outside any FPS window; its source assertion intentionally rejects a later packet.

Independent **Grok4.6/high** review reached its ten-turn cap (`cancelled`,exit1)
with useful source observations and an unfinished optional metadata probe.
No report-only resume was needed to retain the existing artifact. Root accepted
its full-stream/final-box/global-proxy observations and rejected its premature
Vaelmark-only destination readiness proposal: the starting-area fence does not
protect a remote player from leaving onto missing terrain. Coverage and safe
exit containment remain unverified. The report is source-only and is not a live
acceptance result. `source-review-status.json` retains root adjudication; provider
thoughts/usage prose are excluded.

GrokPID154 and offline estimator are done. No game instance was opened for this
analysis. All G06 owned contexts/browser/servers/review tabs were already closed;
user pages remain preserved. G06's isolated FPS gate still needs fresh renderer
isolation; the user Shadowglass status question remains pending.
