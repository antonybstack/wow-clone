# M006 — cold startup gate, paired measurement

Status: **the one-second playable gate cannot be evaluated on this machine right now.** The
code is not the cause: the very commit that passed the gate at 843 ms p95 now measures
1,125 ms on the same protocol. Nothing in this session regressed it, and nothing before this
session did either — see *The failure is environmental* below, which supersedes the original
reading of this result.

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

## The failure is environmental, not inherited from the code

The original conclusion here — "the gate fails and already failed before this session" — was
true as a measurement and wrong as an explanation. It invited the reading that the code was
at fault. A third measurement settles it.

`595438c`, the M007 checkpoint, recorded **p95 843.0 ms with 20/20 runs under a second** on
this same machine, the same Apple M1 Max, the same 50 Mbit/s / 40 ms profile, the same
viewport and the same definition of playable. Rebuilt from that exact commit and re-measured
today, back to back with HEAD:

| build | ≤1000 ms | p50 | p95 | max |
|---|---|---|---|---|
| `595438c` **as recorded then** | **20/20** | 829.5 | **843.0** | 846.0 |
| `595438c` **re-measured today** | 0/20 | 1074.6 | **1125.2** | 1288.3 |
| `8b8138f` (HEAD) today | 0/20 | 1080.4 | 1098.3 | 1104.7 |

The same commit is **282 ms slower** than its own recorded result, and HEAD is
**marginally faster than it** today (p50 +0.54%, p95 −2.39%). Transferred bytes at the
playable boundary are 4,752,398 for `595438c` and 4,754,054 for HEAD — a 1,656-byte
difference, and the tracked startup packs are byte-identical between the two commits.

So no code change accounts for the gap. The machine does: load average was 3.09 rising to
5.83 across these runs, with 9 users logged in, 17 days of uptime, and WindowServer, Activity
Monitor, a browser, an editor daemon and Blender all resident. Startup is CPU-bound work —
parse, compile, Brotli decode, PNG decode, Havok init — and contends with that. Settled FPS
does not: it reproduced the M007 baseline's meadow figure to within 0.1 FPS (184.4 against
184.553) in the same period, which is why the two gates disagree.

**Consequence for the project:** no startup number measured on this machine in its current
state is comparable to the 843 ms local reference or the 979.4 ms release reference. The gate
should be re-run when the machine is quiet, and until then a failing local p95 is not
evidence about the build.

## Reading the original paired comparison

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

## Settled solo FPS

Measured afterwards, paired against the same baseline: see
[the paired FPS result](solo-fps-paired-2026-09-29.md). Meadow 184.4 both builds, town 204.5
vs 203.7-205.2, cathedral 240.1 vs 239.9, with paired mean frame time within +0.14% and zero
frames over 16.67 ms. Both clear the >144 gate, so the throughput gate is green even though
the startup gate above is not.
