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
