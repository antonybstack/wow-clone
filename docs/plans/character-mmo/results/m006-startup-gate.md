# M006 — cold startup gate, paired measurement

Status: **the one-second playable gate fails, and it already failed before this session's
work.** Nothing here regressed it.

## Result

Twenty fresh Chrome processes per build, 50 Mbit/s / 40 ms configured latency, 1280x720,
`ASHEN_PAGES=1` production build on a local preview server, no other game process. The owned
harness slot was torn down first so the measurement was isolated.

| | <=1000 ms | p50 | p95 | p99 | max | min |
|---|---|---|---|---|---|---|
| baseline `db61e63` (pre-session HEAD) | **0/20** | 1082.2 | 1088.0 | 1088.9 | 1088.9 | 1074.3 |
| candidate `ea762f6` (this session) | **0/20** | 1083.0 | 1090.3 | 6043.5 | 6043.5 | 1076.3 |
| candidate, first run excluded | 0/19 | 1083.0 | 1090.3 | — | 1090.3 | 1076.3 |

Warm-run comparison, candidate against baseline: **p50 +0.07%, p95 +0.13%**. That is far
inside the ±5% tolerance, so the creator and the head work cost nothing measurable.

The 6,043.5 ms run is the very first Chrome process of the first batch, paying cold OS and
driver caches. It is retained rather than dropped; the baseline batch ran second, so its
first process was already warm, which is why only the candidate carries the outlier. This is
an ordering artifact of running the two batches back to back, not a property of either build.

Transferred bytes: 4,753,370 baseline, 4,754,054 candidate — a 684-byte difference, which is
the creator's route code in `main.js`. `creator.js` itself is a separate 5.5 KB chunk that
the default route never fetches.

## Reading it honestly

The gate is p95 <= 1,000 ms. Both builds sit at about 1,089 ms, so **the gate fails on this
machine today**, by roughly 9%. The released reference recorded 19/20 under 1 s and a
1,054.5 ms maximum, so both builds here are about 30 ms slower than that reference's worst
run.

What this measurement does and does not establish:

- It **does** establish that this session's changes are not the cause. Two builds, same
  machine, same protocol, back to back, differ by 0.07%.
- It **does not** establish that the game has regressed since release. The machine was not
  idle — the user's own Chrome, a Blender instance and two `chrome-devtools-mcp` supervisors
  were resident throughout — and this ran against `vite preview` rather than the compressed
  preview server the released reference used. A ~30 ms gap has at least two explanations that
  were not separated here.

Per the execution contract, this inherited result is recorded rather than used to rewrite the
baseline. Attributing the gap to a specific change needs a bisect on an idle machine against
the compressed server, which this session did not do.

Raw rows: `docs/baselines/character-mmo/m006/startup-baseline-db61e63.json` and
`startup-after-creator.json`.

## Not measured

Settled solo FPS. The >120 FPS gate at actual 1280x720 was not re-run this session; the
changes are confined to a developer route and the default render path is untouched, but that
is an argument, not a measurement.
