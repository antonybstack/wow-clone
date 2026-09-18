# Optional Grok CLI invocation

Do not invent public model IDs. Historical local CLI list (recheck `grok models` at launch): `grok-4.6`, `grok-4.5`. **When Grok delegation is selected:** new Grok workers and resumed CLI runs use `--model grok-4.6 --reasoning-effort high`. Already-running xHigh jobs may finish unchanged. Older low/xHigh examples are historical. CLI JSON may report internal model `grok-4.6-build`; do not pass that as `--model`.

Use this only for an authorized delegated subtask; the parent otherwise implements directly. Cursor-only Task preference is the other transport, not a veto. From a Cursor Grok parent, prefer [cursor-task.md](cursor-task.md) unless you need this CLI log/resume path. Policy: [SKILL.md](../SKILL.md).

## Implementer

```bash
grok --prompt-file /path/to/handoff.md \
  --model grok-4.6 \
  --verbatim \
  --no-plan \
  --no-subagents \
  --permission-mode bypassPermissions \
  --max-turns N \
  --output-format json \
  --reasoning-effort high
```

Keep stdout/stderr in local files. Read compact JSON fields (`stopReason`, `sessionId`, `num_turns`) plus the worker’s result markdown. Do not ingest `thought` blobs or dump credentials from Grok config.

Max-turn `cancelled` can still leave useful files. Resume that `sessionId` with `--resume <id>` and **no `--restore-code`**.

## Optional independent review

When a separate review is useful, start a fresh session rather than continuing the implementer. Same flags including `--model grok-4.6 --reasoning-effort high`; `--no-subagents` is required. Typical `--max-turns` is small (the reviewer should inspect the specified evidence, identify consequential defects and stop). Prompt file: [judge.md](judge.md).

The judge may **read** image files and write a verdict markdown under the task-specific evidence directory if the prompt allows it. It must not edit product source.

## Process success

Verify with the tool/subprocess return code. Do not assume fish `$status` / `or` work inside a wrapped shell.

Select checks for the changed behavior from `package.json`. Diagnostic lab checks are not proof of current Ashen gameplay. For live Ashen verification and an owned CDP target, use [the browser guide](../../../../docs/debug-view.md). Leave unrelated user Chrome sessions alone.
