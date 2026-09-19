---
name: grok-delegation
description: Optional Grok CLI or Cursor delegation for a requested, bounded subtask in wow-clone. Use when launching or reviewing Grok workers; direct parent implementation remains the default.
---

# Optional Grok delegation

The user endorsed **direct parent implementation and live review** on 2026-09-17. This skill is a tool for an explicitly requested or authorized useful subtask, not a mandate to delegate game work. The parent may implement. Do not revive older Grok-only, subscription-tier or compulsory judge-loop policies.

## When delegation is useful

Choose a concrete independent task with clear ownership and an observable result. Do not split tightly coupled visual/runtime iteration merely to use more agents. Keep the parent responsible for the integrated game and reviewed evidence.

For an authorized Grok worker, the user's last specified effort is **high**, superseding xhigh/low. Historical launch configuration is `--model grok-4.6 --reasoning-effort high`; confirm current CLI model/flag availability at launch rather than inventing IDs. Existing workers need not be cancelled just to change effort.

## Handoff and ownership

Give the worker the exact working directory, relevant files/APIs, current evidence, defect, intended change, invariants, allowed paths, verification and finish conditions. Suggested code is a starting point to verify against current source, not evidence that the plan is correct.

One writer per shared path. Preserve live-checkout changes; do not assume a HEAD worktree contains them. Workers do not expand scope, reset/stash/clean, send Telegram messages or create further agents unless that subtask specifically authorizes it.

Require an early visible boot and one real operation for runtime changes. Reduce a stalled broad assignment to an observable slice instead of repeatedly increasing its turn cap.

## Launch and review

Use [CLI notes](references/cli.md) or [Cursor notes](references/cursor-task.md) only for the selected transport. Do not launch both on the same owned files. For integration/harness pitfalls, read [integration review](references/integration-review.md).

Keep the parent active while a CLI worker runs and review completion; an ended turn does not wake itself on process exit. Read compact results/diffs and inspect actual game captures. A worker's exit code, prose or test count is not acceptance. Preserve useful failure evidence for the current task, but do not grow a permanent contradictory milestone log.

For a requested independent visual review, use [review guidance](references/judge.md). Ask for the few highest-impact observable corrections, not an exhaustive score-driven loop. Never claim a same-context implementer review is independent.

Parent sends reviewed media through the user's already-authorized Telegram channel and polls at sensible boundaries. No worker messaging by default, no secrets in docs, and no claim of background monitoring after the session ends.

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

