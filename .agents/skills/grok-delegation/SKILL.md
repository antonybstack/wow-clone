---
name: grok-delegation
description: Delegate bounded verification, benchmarks, deployment, capture or review to Grok in wow-clone. Use when launching, supervising or reviewing Grok workers; the parent owns feature implementation and acceptance.
---

# Grok delegation

The user's **2026-10-06** direction selects **Grok exclusively for delegated work**.
Delegate bounded tests, benchmarks, builds/deployments and capture/VE operations
while the parent implements features, diagnoses failures and reviews the result.
Parallelize independent work; do not split a tightly coupled correction merely
to keep a worker busy. This preference does not authorize unrelated publishing.

## When delegation is useful

Choose a concrete independent task with clear ownership and an observable result. Do not split tightly coupled visual/runtime iteration merely to use more agents. Keep the parent responsible for the integrated game and reviewed evidence.

For operations, pin the source commit/build and expected gates. Freeze shared
product inputs until verification and sealed deployment finish; independent
feature work needs separate source ownership. Give exactly one worker the game
browser and timing window. Keep other renderers, recording, encoding, builds
and asset generation out of that window. Require PID/port/URL ownership and
cleanup in the result. See [the project operations rule](../../../docs/reviews/workflow-2026-10-05.md#current-operating-rule--2026-10-06).

For an authorized Grok worker, the user's last specified effort is **high**, superseding xhigh/low. Historical launch configuration is `--model grok-4.6 --reasoning-effort high`; confirm current CLI model/flag availability at launch rather than inventing IDs. Existing workers need not be cancelled just to change effort.

## Handoff and ownership

Give the worker the exact working directory, relevant files/APIs, current evidence, defect, intended change, invariants, allowed paths, verification and finish conditions. Suggested code is a starting point to verify against current source, not evidence that the plan is correct.

One writer per shared path. Preserve live-checkout changes; do not assume a HEAD worktree contains them. Workers do not expand scope, reset/stash/clean, send Telegram messages or create further agents unless that subtask specifically authorizes it.

Require an early visible boot and one real operation for runtime changes. Reduce a stalled broad assignment to an observable slice instead of repeatedly increasing its turn cap.

For repeatable live verification, hand over an executable prepared check and exact
commands before asking the worker to explore source or author a new harness. The
C02 combat pass consumed 18 turns on setup/discovery without running its first
check. Booting an idle browser is setup, not a completed operation. If a bounded
pass ends at setup, the parent reuses the owned harness and runs the check directly;
do not spend another agent pass rediscovering the same APIs. Record cleanup even
when the worker fails to produce its report.

## Launch and review

Use [CLI notes](references/cli.md) or [Cursor notes](references/cursor-task.md) only for the selected transport. Do not launch both on the same owned files. For integration/harness pitfalls, read [integration review](references/integration-review.md).

Keep the parent active while a CLI worker runs and review completion; an ended turn does not wake itself on process exit. Read compact results/diffs and inspect actual game captures. A worker's exit code, prose or test count is not acceptance. Preserve useful failure evidence for the current task, but do not grow a permanent contradictory milestone log.

For a requested independent visual review, use [review guidance](references/judge.md). Ask for the few highest-impact observable corrections, not an exhaustive score-driven loop. Never claim a same-context implementer review is independent.

A worker may publish root-reviewed media when its brief explicitly authorizes
the exact file, destination and caption limits under existing user authorization.
Use the existing VE and `tg file` tools, check delivery metadata and the ledger
before retrying, and return sanitized evidence. Parent still reviews actual
motion; API dimensions alone do not prove inline/fullscreen playback. No other
worker messaging by default, no secrets in docs, and no claim of background
monitoring after the session ends.

## Field lessons (Ashen Orc passes, 2026-09-18)

These come from eight resumed Grok passes on the Orc anatomy, garments and armory work. They proved effective; keep using them.

- **Resume the same session across passes** (`grok --resume <sessionId> --prompt-file <next handoff>`). Context carries the worker's own knowledge of the files it wrote, so each pass starts faster and stays consistent. Size `--max-turns` per pass (small 8–25 for a correction pass, 60–120 for a build pass) instead of one huge cap.
- **One defect list per pass, ordered by impact, with a physical hypothesis.** "The hood is picking up shoulder displacement — fade it to zero at the neck" produced a fix; "make it better" did not.
- **Require isolated per-variant previews.** An all-items composite created false cloth-through-cloth defects and hid the real hood bug. Make the worker capture each outfit/variant alone.
- **Require the worker to look at its own renders and state per-variant pass/fail honestly.** Its verdicts are optimistic — expect them to name fewer defects than a fresh reviewer — but honest limit notes correlate with where the real problems are.
- **Verify the worker's claims and the reviewer's claims against the artifact.** A nested vision review called the tunic's intended silver emblem a "hole"; extracting the texture settled it. Neither worker prose nor a reviewer verdict is acceptance by itself.
- **Freeze the allowed-paths list in the handoff and re-state it every pass.** The workers respected it, and it kept Human assets and committed candidates untouched.
- **Convert recurring traps into script checks or docs**, e.g. MakeHuman→GLB vertex index mismatch, garment albedo packed at 256 px nearest-neighbour destroying small emblems, displacement must fade at the neck for head children, derived preview GLBs belong in `.gitignore`.
- **The playable Orc is the sculpt pipeline** (`docs/orc-sculpt-pipeline.md`). Do not revive ellipsoid muscle tables or a MakeHuman body warp.
- **Form vs paint.** Voxel remesh + `--recook` cannot restore eyelids. Collapse the print FBX, bake the HP cage, keep normals on bind. Dummy brow spheres and `mesh.fill()` on the loincloth are known traps.
- **Nested vision is advisory.** Relative LEFT/RIGHT questions helped; “is this good” and score loops did not. Verify claims against the GLB/PNG.
