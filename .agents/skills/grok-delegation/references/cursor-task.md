# Cursor Grok Task (preferred when the parent is in Cursor)

Use the Cursor `Task` tool with a Grok model. Current effort is high. Inherit only if the parent is Grok4.6 at high; otherwise use Grok CLI with explicit `--model grok-4.6 --reasoning-effort high`. Do not guess a model ID for another effort. Already-running xHigh tasks may finish unchanged. Same ownership, live-checkout, and handoff rules as Grok CLI.

```
Task:
  subagent_type: generalPurpose
  model: inherit                    # only from Grok4.6 at high effort
  run_in_background: true          # unless you must block
  environment: local               # never cloud / best-of-n (HEAD worktrees)
  prompt: follow this handoff file exactly: <abs path>
          + allowed/forbidden paths
          + working dir lite-moonwell
          + no git reset/stash/clean/commit
          + no Telegram / no spawning agents
```

Judge: **new** Task every round (`file_attachments` for target + live plates). Do not `resume` the implementer as the judge.

Resume an implementer with `resume: <agentId>`. Never `best-of-n-runner`.
