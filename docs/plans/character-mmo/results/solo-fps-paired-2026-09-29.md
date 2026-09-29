# Settled solo FPS — paired measurement, 2026-09-29

Status: **no regression from this session's work. Both builds clear the >144 gate.**

## Result

Uncapped Chromium, 1280×720 render buffer, device scale 1, seven enemies, no recording,
three 12-second runs per route after readiness and settling, on one owned harness slot with
no other game process. Baseline `db61e63` (the pre-session HEAD) was served from a separate
worktree on its own dev server; candidate `71804ca` from the working checkout. The two were
measured **back to back on the same machine and the same browser**.

| route | baseline mean FPS | candidate mean FPS | p95 (ms) | worst (ms) | frames >16.67 ms |
|---|---|---|---|---|---|
| meadow | 184.4–184.5 | 184.4–184.5 | 10.9–11.2 | 13.3 | 0 |
| town | 204.5–204.6 | 203.7–205.2 | 5.9–10.2 | 13.4 | 0 |
| cathedral | 240.1–240.5 | 239.9–240.0 | 7.4–9.0 | 13.2 | 0 |

Paired mean frame time, baseline → candidate: **+0.01%, +0.05%, +0.14%**. The gate allows no
repeatable worsening beyond 5%, and zero frames exceeded 16.67 ms in either build.

## The first measurement was contaminated, and said `capped: false` anyway

The first run of the day reported **103–118 mean FPS** across all five routes, with 106–132
frames above 16.67 ms on meadow, town and forest, and a 26 ms worst interval. It was taken
immediately after a ten-minute CPU-saturating offline job, with the user's own Chrome, a
Blender instance and two `chrome-devtools-mcp` supervisors resident. Re-measured under the
same protocol when the machine was quiet, the same build gave 184–240.

Every one of those contaminated runs reported `capped: false`. That flag says the samples
were not clipped to a refresh rate; it says nothing about whether the machine was busy, and
it cannot be read as "this measurement is valid". Mean GPU time was 1.2–1.3 ms against
8.5–9.4 ms frames in that run, which is the tell: the cost was not on the GPU.

Raw rows for all three runs are kept — `fps-paired-baseline-db61e63.json`,
`fps-paired-candidate.json` and `fps-contaminated-run.json` under
`docs/baselines/character-mmo/m007/` — because a discarded measurement that is not shown is
indistinguishable from one that was never taken.

## Scope

- Dev-server builds on the harness, matching how the M007 route comparisons were taken, not
  the production Pages bundle.
- Three of the five routes for the paired comparison; bridge and forest were measured only in
  the contaminated run and are not claimed here.
- This says nothing about the deployed site. A low frame rate observed on
  `play.sparkify.dev` is a separate question: it was not reproduced here, and this
  measurement cannot confirm or deny it.
