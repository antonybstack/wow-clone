#!/usr/bin/env python3
"""Stop gate: do not end the turn while the milestone queue still has actionable tasks.

The user's standing instruction is "proceed and complete all tasks. Be autonomous, do not
stop for review or re-prompt to keep working" -- and the turn that prompted this file ended
anyway, with six known open tasks, because finishing a milestone *feels* like a stopping
point. This gate turns that feeling into a fact check against the plan.

The single source of truth is docs/plans/character-mmo/next-ten.md, which already carries
everything needed:

  * the Sequence table's State column -- "**Delivered**" versus "Open"/"Partly built";
  * per-task strike-through plus "**Closed <date>**" with a result link, for tasks that are
    genuinely finished;
  * "Still open:" notes on tasks that are half closed.

So the question asked here is "does the plan name work I could be doing right now?", not
"did the reply sound finished?". That distinction is why the sibling gate,
telegram-motion-stop.py, had to have its prose trigger removed: ordinary sentences matched
game words, and a turn that touched nothing at all tripped it. Nothing here reads the
assistant's prose.

Two kinds of open work are separated, because conflating them makes the reminder wrong:

  * **actionable** -- no declared external dependency, so continuing is the right move;
  * **blocked** -- the plan says so in as many words ("**Blocked", "licensed source
    dependency", "requires a release decision"). Naming these as "go and do this" would be
    telling the agent to do something the plan says it cannot. They are listed, not demanded.

Anti-vacuity, which is the failure this file is most likely to suffer: a gate that silently
answers "nothing open" when its parser broke is worse than no gate, and this project has
already shipped one of those. If the plan exists but the Sequence table or the task lists
come back empty, the parse itself is reported as the problem rather than passed over. The
companion test, scripts/test-remaining-work-hook.py, pins both directions: a queue with open
tasks blocks, an all-delivered queue does not, and a mangled queue blocks with a parse error.

This is a reminder, not a lock. It blocks once -- stop_hook_active suppresses the next -- and
there are three honest ways past it: do the work, or say in one line why the named task is not
in fact actionable, or have the user say stop.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys

PLAN = "docs/plans/character-mmo/next-ten.md"
GUARD_FILES = ("ashen-reach.html", "scripts/tg")
# Milestone heading: "## 6 — Armor swapping as a verified capability".
MILESTONE_RE = re.compile(r"^##\s+(\d+)\s+[-–—]\s+(.+?)\s*$")
SECTION_RE = re.compile(r"^##\s+(?!\d)")
# Sequence row: "| 6 | **Armor swapping ...** | ... | 1, 3 | Open — evidence |".
ROW_RE = re.compile(r"^\|\s*(\d+)\s*\|")
TASK_RE = re.compile(r"^(\d+)\.\s+(.*)$")
# "Attempted and reverted" is deliberately NOT here. A reverted task is open work whose diff
# happens to be written; counting it as closed is how the republish fell out of the queue.
CLOSED_RE = re.compile(r"\*\*Closed\b|\*\*Delivered\b|\*\*Enforced\b")
# Declared external dependencies. Each of these phrasings is already in the plan for the
# milestones that genuinely cannot proceed; an inferred blocker is not honoured.
BLOCKED_RE = re.compile(
    r"\*\*Blocked\b|licensed source dependency|\bis a blocker\b|\bparked\b",
    re.I,
)
STILL_OPEN_RE = re.compile(r"\*\*Still open:\*\*|Still open:", re.I)
# Narrow, anchored: an explicit instruction from the user to stop, not a topic that mentions
# stopping. Only ever matched against the user's own current message.
USER_STOP_RE = re.compile(
    r"^\W{0,4}(?:ok(?:ay)?[, ]+)?(?:that'?s (?:all|enough|it)|stop(?: (?:here|now|working|for now))?"
    r"|pause|hold off|wait|stand by|no more|we'?re done|that'?ll do|leave it)\b",
    re.I,
)


def git(root: str, *args: str) -> str:
    try:
        return subprocess.check_output(
            ["git", "-C", root, *args], stderr=subprocess.DEVNULL, text=True, timeout=6
        )
    except (OSError, subprocess.SubprocessError):
        return ""


def text_of(value) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return "\n".join(text_of(item) for item in value)
    if isinstance(value, dict):
        return text_of(value.get("text") or value.get("content") or "")
    return str(value)


def is_user_turn(rec: dict) -> bool:
    """A real user message, as opposed to a tool result.

    Claude Code records tool results with `type: "user"` too, so the type alone cannot mark a
    turn boundary; a genuine turn carries plain text rather than tool_result blocks.
    """
    if rec.get("type") != "user":
        return False
    content = (rec.get("message") or {}).get("content")
    if isinstance(content, str):
        return bool(content.strip())
    if isinstance(content, list):
        return any(
            isinstance(b, dict) and b.get("type") not in ("tool_result", "tool_use")
            for b in content
        )
    return False


def current_turn(data: dict) -> tuple[str, set[str]]:
    """(the user's message that opened this turn, the tool names used since).

    Scoped to the current turn only. The sibling gate read a fixed number of trailing lines,
    which spans several turns, so a quiet turn inherited the previous one's evidence.
    """
    path = data.get("transcript_path") or data.get("transcriptPath")
    if not path or not os.path.exists(path):
        return "", set()
    try:
        with open(path, "rb") as fh:
            fh.seek(0, os.SEEK_END)
            fh.seek(max(0, fh.tell() - 400_000))
            lines = fh.read().decode("utf-8", "replace").splitlines()
    except OSError:
        return "", set()
    records = []
    for line in lines:
        try:
            records.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    start, prompt = 0, ""
    for i in range(len(records) - 1, -1, -1):
        if is_user_turn(records[i]):
            start = i + 1
            prompt = text_of((records[i].get("message") or {}).get("content"))
            break
    tools: set[str] = set()
    for rec in records[start:]:
        content = (rec.get("message") or {}).get("content")
        if isinstance(content, list):
            for block in content:
                if isinstance(block, dict) and block.get("type") == "tool_use":
                    tools.add(str(block.get("name") or ""))
    return prompt, tools


def milestone_states(lines: list[str]) -> dict[str, str]:
    """Milestone number -> State cell from the Sequence table."""
    states: dict[str, str] = {}
    inside = False
    for line in lines:
        if line.startswith("## Sequence"):
            inside = True
            continue
        if inside and line.startswith("## "):
            break
        if not inside:
            continue
        match = ROW_RE.match(line)
        if not match:
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) >= 5:
            states[match.group(1)] = cells[-1]
    return states


def clean(text: str) -> str:
    """Markdown and result links stripped; what is left is the claim itself."""
    text = re.sub(r"\(results/[^)]*\)|\(\.\./[^)]*\)|\[|\]", "", text)
    text = re.sub(r"\(\s*results?\s*(?:,\s*Telegram\s*\*{0,2}\d+\*{0,2}\s*)?\)", "", text)
    return re.sub(r"[*~`]|\s+", lambda m: "" if m.group(0)[0] in "*~`" else " ", text).strip()


def headline(text: str, remainder) -> str:
    """The sentence that says what is left to do.

    For a task closed except for a remainder, that is the "Still open:" note -- not the first
    line, which describes what was already finished and reads as a false accusation.
    """
    source = text
    if remainder:
        source = text[remainder.end():]
    sentence = re.split(r"(?<=[.;])\s", clean(source).lstrip(": "), maxsplit=1)[0]
    if len(sentence) < 12:
        sentence = clean(source)
    return sentence[:110].rstrip(" ,;.") or clean(text)[:110]


def task_blocks(lines: list[str], start: int, end: int) -> list[tuple[str, str]]:
    """Numbered work items in a milestone section, as (number, full text).

    A task's text runs to the next numbered item, so the "**Closed**" line and the result link
    that usually sit on the continuation lines are part of the item they belong to.
    """
    blocks: list[tuple[str, str]] = []
    number, buffer = None, []
    for line in lines[start:end]:
        match = TASK_RE.match(line)
        if match:
            if number:
                blocks.append((number, "\n".join(buffer)))
            number, buffer = match.group(1), [match.group(2)]
        elif number is not None:
            if line.startswith(("**Exit:", "**Route note:", "**Bounded implementer")):
                blocks.append((number, "\n".join(buffer)))
                number, buffer = None, []
            else:
                buffer.append(line)
    if number:
        blocks.append((number, "\n".join(buffer)))
    return blocks


def read_queue(root: str) -> tuple[list[str], list[str], str | None]:
    """(actionable, blocked, parse error).

    The parse error is the point of the third value: an empty queue and an unreadable queue
    must not look alike to the caller.
    """
    try:
        with open(os.path.join(root, PLAN), encoding="utf-8") as fh:
            lines = fh.read().splitlines()
    except OSError as error:
        return [], [], f"cannot read {PLAN} ({error.strerror})"

    states = milestone_states(lines)
    if not states:
        return [], [], f"the Sequence table in {PLAN} yielded no milestone rows"
    if not any("delivered" in state.lower() for state in states.values()):
        return [], [], (
            f"no milestone in {PLAN} parsed as Delivered, so the State column is no longer "
            "being read as expected"
        )

    bounds: list[tuple[str, str, int, int]] = []
    for i, line in enumerate(lines):
        match = MILESTONE_RE.match(line)
        if not match:
            continue
        end = len(lines)
        for j in range(i + 1, len(lines)):
            if SECTION_RE.match(lines[j]) or MILESTONE_RE.match(lines[j]):
                end = j
                break
        bounds.append((match.group(1), match.group(2), i + 1, end))
    if not bounds:
        return [], [], f"no milestone sections parsed out of {PLAN}"

    actionable: list[str] = []
    blocked: list[str] = []
    seen_any_task = False
    for number, title, start, end in bounds:
        state = states.get(number, "")
        tasks = task_blocks(lines, start, end)
        # Counted across every milestone, delivered or not: a queue whose work is all finished
        # must read as finished, not as a broken parser.
        seen_any_task = seen_any_task or bool(tasks)
        if "delivered" in state.lower() and "parked" not in state.lower():
            continue
        body = "\n".join(lines[start:end])
        milestone_blocked = bool(BLOCKED_RE.search(body))
        for num, text in tasks:
            closed = text.lstrip().startswith("~~") or CLOSED_RE.search(text)
            remainder = STILL_OPEN_RE.search(text)
            if closed and not remainder:
                continue
            label = f"M{number} task {num}: {headline(text, remainder)}"
            if closed:
                label += " (remainder)"
            (blocked if milestone_blocked or BLOCKED_RE.search(text) else actionable).append(label)
        if not tasks:
            # Milestones 8-10 carry an Exit but no task list; the milestone is the open unit.
            label = f"M{number}: {title} \u2014 {clean(state)}"
            (blocked if milestone_blocked else actionable).append(label)

    if not seen_any_task:
        return [], [], (
            f"not one numbered work item parsed out of {PLAN}; the task format has changed"
        )
    return actionable, blocked, None


def main() -> int:
    try:
        data = json.load(sys.stdin)
    except json.JSONDecodeError:
        return 0
    # Only an end_turn is the agent claiming it is done. A tool-limit stop or an interrupt is
    # not, and nagging there would fight the user rather than remind the agent.
    if "reason" in data and data.get("reason") != "end_turn":
        return 0
    if data.get("stop_hook_active") or data.get("stopHookActive"):
        return 0
    if data.get("subagentType") or data.get("hook_event_name") == "SubagentStop":
        return 0

    root = data.get("cwd") or data.get("workspaceRoot") or os.getcwd()
    root = git(root, "rev-parse", "--show-toplevel").strip() or root
    # Scope by the project's own files, not an absolute path, so worktrees and clones work and
    # a copied .claude directory elsewhere stays silent.
    if not all(os.path.exists(os.path.join(root, f)) for f in GUARD_FILES):
        return 0

    prompt, tools = current_turn(data)
    if USER_STOP_RE.match(prompt.strip()):
        return 0
    # Waiting on an answer is not stopping short. The question is a fact in the transcript,
    # unlike anything the reply happens to say.
    if "AskUserQuestion" in tools or "ExitPlanMode" in tools:
        return 0

    actionable, blocked, error = read_queue(root)
    if error:
        json.dump({"decision": "block", "reason": (
            "This Stop gate cannot tell whether work remains: " + error + ".\n\n"
            "That is the one state it must never pass over quietly -- a queue that reads as "
            "empty because the parser broke looks exactly like a finished queue. Either fix "
            f".claude/hooks/remaining-work-stop.py against the current shape of {PLAN} "
            "(scripts/test-remaining-work-hook.py pins both directions), or say in one line "
            "that the queue is genuinely empty."
        )}, sys.stdout)
        sys.stdout.write("\n")
        return 0

    if not actionable:
        if blocked:
            json.dump({"systemMessage":
                       f"Queue: nothing actionable; {len(blocked)} blocked item(s) remain."},
                      sys.stdout)
            sys.stdout.write("\n")
        return 0

    listing = "\n".join(f"  - {item}" for item in actionable[:8])
    more = f"\n  ... and {len(actionable) - 8} more" if len(actionable) > 8 else ""
    reason = (
        f"{len(actionable)} actionable task(s) remain in {PLAN}:\n{listing}{more}\n\n"
        + (f"Separately blocked by a declared dependency, not for now: {len(blocked)} item(s).\n\n"
           if blocked else "")
        + "The standing instruction for this queue is to keep going: \"proceed and complete all "
        "tasks. Be autonomous, do not stop for review or re-prompt to keep working.\" Finishing "
        "a milestone is not the end of the queue, and reporting what was just done is not the "
        "same as delivering the next item.\n\n"
        "Pick up the first task above and continue. If one of them is not in fact actionable, "
        "say which and why in one line and mark it in the plan so this gate stops naming it; if "
        "the user has asked you to stop, stop."
    )
    json.dump({"decision": "block", "reason": reason}, sys.stdout)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
