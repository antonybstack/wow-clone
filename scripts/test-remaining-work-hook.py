#!/usr/bin/env python3
"""Pins .claude/hooks/remaining-work-stop.py in both directions.

A Stop gate has two failure modes and they are not symmetric. Nagging when the queue is
finished is annoying; going quiet when the parser breaks is the one that let the original
problem through, so the mangled-queue case is asserted as loudly as the open-queue case.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

HOOK = Path(__file__).resolve().parent.parent / ".claude/hooks/remaining-work-stop.py"

SEQUENCE = """# Queue

## Sequence

| # | Milestone | Player-visible result | Depends on | State |
| --- | --- | --- | --- | --- |
| 1 | Done thing | Shipped. | — | **Delivered** |
| 6 | Open thing | Not yet. | 1 | Open — evidence |

## 1 — Done thing

Tasks:

1. ~~**A finished task.**~~ **Closed 2026-10-02** ([result](results/x.md)).

**Exit:** shipped.

## 6 — Open thing

Tasks:

1. ~~**Also finished.**~~ **Closed 2026-10-02** ([result](results/y.md)).
2. **An unfinished task.** This one has no closure marker at all.

**Exit:** not yet.
"""

ALL_DELIVERED = """# Queue

## Sequence

| # | Milestone | Player-visible result | Depends on | State |
| --- | --- | --- | --- | --- |
| 1 | Done thing | Shipped. | — | **Delivered** |

## 1 — Done thing

Tasks:

1. ~~**A finished task.**~~ **Closed 2026-10-02** ([result](results/x.md)).

**Exit:** shipped.
"""

BLOCKED_ONLY = """# Queue

## Sequence

| # | Milestone | Player-visible result | Depends on | State |
| --- | --- | --- | --- | --- |
| 1 | Done thing | Shipped. | — | **Delivered** |
| 9 | Elf thing | Not yet. | 1 | Open — licensed source |

## 1 — Done thing

Tasks:

1. ~~**A finished task.**~~ **Closed 2026-10-02** ([result](results/x.md)).

## 9 — Elf thing

**Dependency:** an explicit **licensed source dependency**.

Tasks:

1. **Author the Elf.** Needs source art that does not exist.

**Exit:** not yet.
"""

MANGLED = """# Queue

No sequence table, no milestones, nothing a parser can hold on to.
"""

PLAN = "docs/plans/character-mmo/next-ten.md"
FAILURES: list[str] = []


def run(plan: str | None, payload: dict, *, project: bool = True, transcript=None) -> dict:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        if project:
            (root / "ashen-reach.html").write_text("<!doctype html>")
            (root / "scripts").mkdir(parents=True, exist_ok=True)
            (root / "scripts/tg").write_text("#!/bin/sh\n")
        if plan is not None:
            (root / PLAN).parent.mkdir(parents=True, exist_ok=True)
            (root / PLAN).write_text(plan)
        data = {"reason": "end_turn", "cwd": str(root), **payload}
        if transcript is not None:
            path = root / "transcript.jsonl"
            path.write_text("\n".join(json.dumps(r) for r in transcript) + "\n")
            data["transcript_path"] = str(path)
        done = subprocess.run([sys.executable, str(HOOK)], input=json.dumps(data),
                              capture_output=True, text=True, timeout=30,
                              cwd=tmp, env={**os.environ, "GIT_CEILING_DIRECTORIES": tmp})
        if done.returncode:
            raise AssertionError(f"hook exited {done.returncode}: {done.stderr}")
        out = done.stdout.strip()
        return json.loads(out) if out else {}


def check(name: str, condition: bool, detail: str = "") -> None:
    print(f"  {'PASS' if condition else 'FAIL'}  {name}" + (f" — {detail}" if detail and not condition else ""))
    if not condition:
        FAILURES.append(name)


def main() -> int:
    print("remaining-work-stop.py")

    got = run(SEQUENCE, {})
    check("an open task blocks", got.get("decision") == "block", repr(got)[:200])
    check("the open task is named by milestone and number",
          "M6 task 2" in got.get("reason", ""), repr(got.get("reason"))[:200])
    check("closed tasks are not named",
          "task 1" not in got.get("reason", "").replace("M6 task 2", ""), repr(got.get("reason"))[:200])

    got = run(ALL_DELIVERED, {})
    check("an all-delivered queue does not block", got.get("decision") != "block", repr(got)[:200])

    got = run(BLOCKED_ONLY, {})
    check("a declared-blocked task does not block the turn",
          got.get("decision") != "block", repr(got)[:200])
    check("but it is still reported", "blocked" in got.get("systemMessage", "").lower(),
          repr(got)[:200])

    # The case that matters: a queue the parser cannot read must not look finished.
    got = run(MANGLED, {})
    check("a mangled queue blocks rather than passing silently",
          got.get("decision") == "block", repr(got)[:200])
    check("and says the parse is the problem",
          "cannot tell whether work remains" in got.get("reason", ""), repr(got)[:200])
    got = run(None, {})
    check("a missing plan blocks", got.get("decision") == "block", repr(got)[:200])

    # Suppressions.
    check("stop_hook_active suppresses",
          run(SEQUENCE, {"stop_hook_active": True}).get("decision") != "block")
    check("a non-end_turn stop suppresses",
          run(SEQUENCE, {"reason": "max_tokens"}).get("decision") != "block")
    check("a subagent stop suppresses",
          run(SEQUENCE, {"hook_event_name": "SubagentStop"}).get("decision") != "block")
    check("another project is out of scope",
          run(SEQUENCE, {}, project=False).get("decision") != "block")

    user = lambda text: {"type": "user", "message": {"role": "user", "content": text}}
    asked = {"type": "assistant", "message": {"role": "assistant", "content": [
        {"type": "tool_use", "name": "AskUserQuestion", "input": {}}]}}
    for phrase in ("stop", "that's enough", "ok stop here", "pause", "we're done"):
        check(f"an explicit {phrase!r} from the user suppresses",
              run(SEQUENCE, {}, transcript=[user(phrase)]).get("decision") != "block")
    check("a question mentioning stopping still blocks",
          run(SEQUENCE, {}, transcript=[user("why did the swap stop working?")])
          .get("decision") == "block")
    check("waiting on AskUserQuestion suppresses",
          run(SEQUENCE, {}, transcript=[user("proceed"), asked]).get("decision") != "block")
    check("an ordinary proceed still blocks",
          run(SEQUENCE, {}, transcript=[user("proceed")]).get("decision") == "block")

    print(f"\n{'FAILED: ' + ', '.join(FAILURES) if FAILURES else 'all checks pass'}")
    return 1 if FAILURES else 0


if __name__ == "__main__":
    sys.exit(main())
