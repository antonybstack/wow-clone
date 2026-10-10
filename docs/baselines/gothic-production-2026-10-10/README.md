# Gothic production 2026-10-10 receipts

User-directed sealed upload of the Vaelmark desktop preview. Startup unqualified.

- Canonical before / rollback: [rollback-before.json](rollback-before.json),
  [pages-canonical-before.json](pages-canonical-before.json)
- Canonical after / final: [pages-canonical-after.json](pages-canonical-after.json),
  [pages-canonical-final.json](pages-canonical-final.json)
- Seal: [seal-verify.json](seal-verify.json), [seal-preflight.json](seal-preflight.json)
- Integrity summaries: [served-immutable-summary.json](served-immutable-summary.json),
  [served-play-summary.json](served-play-summary.json); full rows gzipped
- Default-entry smoke: [default-entry-report.json](default-entry-report.json)
  (26323 ms = ready+navigation+hostiles, not first play)
- First expedition abort: [expedition-first-failure.json](expedition-first-failure.json)
- Corrected expedition: [expedition-corrected-summary.json](expedition-corrected-summary.json),
  full [expedition-corrected-report.json.gz](expedition-corrected-report.json.gz)
- Seeded equipment script (not journal persistence):
  [seeded-equipment-report.json](seeded-equipment-report.json)
- Harness cleanup: [cleanup.json](cleanup.json)

Result: [production-deployment-2026-10-10.md](../../plans/gothic-exploration/results/production-deployment-2026-10-10.md).

## Native helper recovery

Root retained the executed [corrected expedition helper](check-expedition.mjs.gz)
and [default entry helper](check-default-entry.mjs.gz), with
[decoded hashes](native-helper-snapshots.json). Decompress into
`.cache/gothic-prod-2026-10-10/` to preserve their relative imports. The corrected
helper changes only import locations and progression comparisons that allow
bounded ordinary mana regeneration; it preserves actual unseeded reloads.
No runtime or product script changed for this deployment.
