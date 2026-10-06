# Compact normal rounding integration — source review

2026-10-06. Read-only review of the uncommitted packing scripts, prepare/verify paths, and tests named in the request. No tests, builds, browsers, or product files were run or modified. Regenerated asset bytes were not inspected. The detached-authoring-target prune (`PRIMITIVE` / `PRIMITIVE_TARGET`) is treated as already fixed and is not an open finding.

## Verdict

No confirmed blockers.

Release paths use native meshopt `EXPONENTIAL` / `SharedVector` 16-bit rounding, decode back to Float32, and keep the existing meshopt GLB/runtime path. Full `items` are written before rounding. Hood is skipped by id; rigid compact items keep the full URL and must not carry `normalPacking`. Playable clip subset runs before rounding; curve hashes stay exact. Coverage classification uses position/weights/joints only, so rounding-before-partition does not change geoset membership. Policy `sourceGeometrySha256` is `identityGeometryHash` of the unrounded document; identities bind that to `items.body.geometrySha256`, and the shape compact-body test binds it to the unpartitioned full body.

## Issues

None.

## Scope caveat

This is a source correspondence review only. Prepare-time proofs and the listed tests are the checks that the written compact GLB stays within the 1e-4 normal/tangent component bound; this pass did not re-read regenerated bins.
