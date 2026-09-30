#!/usr/bin/env python3
"""Stop gate: do not close a visual Ashen Reach cycle on stills alone.

AGENTS.md: "A visual cycle (character, clothes, animation, camera, spells, world)
is not delivered until a reviewed live GIF or MP4 is on Telegram via `tg file`."

There was already a gate for this, at .grok/hooks/telegram-motion.json, and it
still missed a whole environment/lighting pass. Two reasons, both fixed here:

1. It lived in .grok/, which is the Grok CLI's hook directory. Claude Code reads
   project hooks from .claude/settings.json, so under Claude Code the gate simply
   never ran. This file is registered there.

2. It decided "is this a visual turn?" from `git status` alone. Committing is the
   normal last act of a session, so the moment the work was committed the gate
   went blind -- it was structurally guaranteed to be silent exactly when it was
   needed most. This version also reads *committed* work, and measures it against
   a ledger of what has actually been sent rather than against the working tree.

The ledger is written by `scripts/tg` on every successful send: one line of
"<iso8601> <sha-at-send> <path>". So the question the gate really asks is "are
there visual commits newer than the last thing I put on Telegram?", which stays
true across commits, across turns, and across a restarted session.

3. It decided "is this a visual turn?" partly from the *prose* of the reply: any
   mention of orc, armory, churchyard, wayfarer, fog, foliage and so on counted.
   Ordinary sentences match those words, so answering "press C to open the Armory"
   with no file touched at all tripped the gate, as did writing a memory file
   outside the repo. It also read the last 80 transcript lines, which span several
   turns, so a turn that said nothing game-related inherited the previous one's
   words. The trigger is now filesystem evidence only -- changed visual files, or
   new artifacts under ve-capture/ since the last delivery -- and the transcript is
   read no further back than the current turn.

This is a reminder, not a lock: it blocks once (stop_hook_active suppresses the
next), and saying plainly that the turn was not visual work is a valid answer.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import tempfile

VISUAL_PREFIXES = (
    "src/ashen-reach/",
    "src/character/",
    "src/spells/",
    "src/camera-rig.js",
    "public/ashen-reach/",
    "public/characters/",
    "blender/",
    "scripts/ashen-reach/",
    ".agents/skills/blender-lite/",
    "ashen-reach.html",
)
CAPTURE_DIR = "ve-capture"
# Files that are the *output* of looking at the game. Intermediate frame dumps count:
# a turn that recorded frames and never encoded them still produced visual review
# material, which is exactly the stills-only close this gate exists to catch.
CAPTURE_SUFFIXES = (".mp4", ".gif", ".png", ".jpg", ".jpeg", ".webp")
MOTION_RE = re.compile(r"(?:tg file[^\n]*\.(?:gif|mp4)|\.mp4|\.gif|ve\.sparkify\.dev/\S+\.mp4)", re.I)
TELEGRAM_RE = re.compile(r"\b(telegram|tg file|message_id)\b", re.I)
LEDGER = ".claude/telegram-deliveries.log"


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

    Claude Code records tool results with `type: "user"` too, so the type alone cannot
    mark a turn boundary; a genuine turn carries plain text rather than tool_result
    blocks.
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


def last_assistant_text(data: dict) -> str:
    """Claude Code passes a transcript path, not the message. Read the current turn.

    Only the current turn: reading a fixed number of trailing lines spans several
    turns, so a turn that delivered nothing inherited the previous turn's words and
    the gate answered about the wrong turn. The boundary is the last real user
    message.
    """
    direct = text_of(data.get("lastAssistantMessage"))
    if direct:
        return direct
    path = data.get("transcript_path") or data.get("transcriptPath")
    if not path or not os.path.exists(path):
        return ""
    try:
        with open(path, "rb") as fh:
            fh.seek(0, os.SEEK_END)
            fh.seek(max(0, fh.tell() - 400_000))
            lines = fh.read().decode("utf-8", "replace").splitlines()
    except OSError:
        return ""
    records = []
    for line in lines:
        try:
            records.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    start = 0
    for i in range(len(records) - 1, -1, -1):
        if is_user_turn(records[i]):
            start = i + 1
            break
    chunks = []
    for rec in records[start:]:
        msg = rec.get("message") or {}
        if rec.get("type") == "assistant" or msg.get("role") == "assistant":
            chunks.append(text_of(msg.get("content")))
        # Tool results carry `tg`'s own "sent, message_id N" confirmation, which is
        # the only trustworthy proof a send actually happened rather than was claimed.
        if rec.get("type") in ("user", "tool_result"):
            chunks.append(text_of(msg.get("content"))[:4000])
    return "\n".join(chunks)


def dirty_paths(root: str) -> list[str]:
    paths = []
    for line in git(root, "status", "--porcelain", "-uall").splitlines():
        if len(line) < 4:
            continue
        status, path = line[:2], line[3:].split(" -> ")[-1].strip().strip('"')
        if not path or path.startswith("blender/characters/sources/"):
            continue
        if status == "??" and not path.startswith(("src/", "public/")):
            continue
        paths.append(path)
    return paths


def last_delivery(root: str) -> tuple[float, str]:
    """(unix time, sha) of the most recent Telegram send, from the ledger `scripts/tg` writes.

    `tg file` appends on every successful send, so this moves forward the moment a clip
    is delivered -- before the commit, not only at `tg record` time.
    """
    ledger = os.path.join(root, LEDGER)
    if not os.path.exists(ledger):
        return 0.0, ""
    try:
        with open(ledger) as fh:
            rows = [r.split() for r in fh.read().splitlines() if r.strip()]
    except OSError:
        return 0.0, ""
    if not rows or len(rows[-1]) < 2:
        return 0.0, ""
    stamp, sha = rows[-1][0], rows[-1][1]
    try:
        from datetime import datetime
        when = datetime.fromisoformat(stamp).timestamp()
    except ValueError:
        when = 0.0
    return when, sha


def fresh_capture(root: str, since: float) -> str:
    """First capture artifact written after the last delivery, or "".

    This is the signal that replaced matching game words in the reply text. Producing a
    render, a screenshot or a frame dump is a fact on disk; mentioning the Armory in a
    sentence is not.

    `find` rather than os.walk: the capture tree holds ~200k frame dumps, and a Python walk
    that stats each one is slow enough to want a cap -- which is how the first version of
    this silently answered "nothing new" for a directory it had given up on. `-quit` stops
    at the first hit, and the whole scan measures ~0.25 s even when there is none.
    """
    base = os.path.join(root, CAPTURE_DIR)
    if not os.path.isdir(base) or since <= 0:
        return ""
    names: list[str] = []
    for i, suffix in enumerate(CAPTURE_SUFFIXES):
        if i:
            names.append("-o")
        names += ["-name", "*" + suffix]
    # `-newer <file>`, not `-newermt @epoch`: the latter is a GNU extension that BSD find
    # rejects with "Can't parse date/time", and which `find` is on PATH differs between an
    # interactive shell and this subprocess. A reference file stamped to the delivery time
    # works on both.
    reference = None
    try:
        handle, reference = tempfile.mkstemp(prefix="tg-gate-")
        os.close(handle)
        os.utime(reference, (since, since))
        out = subprocess.run(
            ["find", base, "-type", "f", "-newer", reference,
             "(", *names, ")", "-print", "-quit"],
            capture_output=True, text=True, timeout=15,
        ).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return ""
    finally:
        if reference:
            try:
                os.unlink(reference)
            except OSError:
                pass
    return os.path.relpath(out.splitlines()[0], root) if out else ""


def undelivered_commit_paths(root: str, sha: str) -> list[str]:
    """Paths touched by commits made after the most recent Telegram delivery."""
    since = ""
    if sha:
        try:
            # Only usable if the sha is an ancestor of HEAD; after a rebase or a branch
            # switch it may not be, and then we fall back to the merge base.
            probe = subprocess.run(
                ["git", "-C", root, "merge-base", "--is-ancestor", sha, "HEAD"],
                capture_output=True, timeout=6,
            )
            if probe.returncode == 0:
                since = sha
        except (OSError, subprocess.SubprocessError):
            since = ""
    if not since:
        for base in ("origin/main", "main"):
            since = git(root, "merge-base", base, "HEAD").strip()
            if since:
                break
    if not since:
        return []
    return [p for p in git(root, "log", "--name-only", "--pretty=format:", f"{since}..HEAD").splitlines() if p.strip()]


def main() -> int:
    try:
        data = json.load(sys.stdin)
    except json.JSONDecodeError:
        return 0
    # The Grok CLI sends a `reason`; Claude Code does not. Only end_turn is a cycle
    # closing -- a tool-limit or interrupt stop is not the agent claiming it is done.
    if "reason" in data and data.get("reason") != "end_turn":
        return 0
    if data.get("stop_hook_active") or data.get("stopHookActive"):
        return 0
    if data.get("subagentType") or data.get("hook_event_name") == "SubagentStop":
        return 0

    msg = last_assistant_text(data)
    if MOTION_RE.search(msg) and TELEGRAM_RE.search(msg):
        return 0

    root = data.get("cwd") or data.get("workspaceRoot") or os.getcwd()
    root = git(root, "rev-parse", "--show-toplevel").strip() or root
    # Scope: this gate is about Ashen Reach and must stay silent anywhere else, including a
    # sibling checkout or a copied .claude directory. Identify the project by its own files
    # rather than by an absolute path, so worktrees and clones still work.
    if not all(os.path.exists(os.path.join(root, f)) for f in ("ashen-reach.html", "scripts/tg")):
        return 0

    since, sha = last_delivery(root)
    changed = dirty_paths(root) + undelivered_commit_paths(root, sha)
    visual = sorted({p for p in changed if p.startswith(VISUAL_PREFIXES)})
    # Producing a render is a fact on disk. Naming the Armory in a sentence is not, which is
    # why matching game words in the reply text is gone.
    capture = fresh_capture(root, since)
    if not visual and not capture:
        return 0

    sample = visual[:6] or ([capture] if capture else [])
    reason = (
        "This turn changed visual Ashen Reach code and nothing has been sent to Telegram "
        "since the last recorded delivery"
        + (" (e.g. " + ", ".join(sample) + ")" if sample else "")
        + ". A visual cycle is not delivered until a reviewed live GIF or MP4 is on Telegram "
        "-- stills are review aids, not the end of the cycle.\n\n"
        "Record a clip of the actual change in the running game (scripts/ashen-reach/"
        "record-vistas.mjs for world/lighting, record-*.mjs for character and spell work), "
        "encode it, LOOK AT IT YOURSELF, then:\n"
        "    bash scripts/tg file <clip.mp4> \"<what changed, and what still reads wrong>\"\n\n"
        "If this turn genuinely was not visual work -- docs, tests, tooling, planning -- say so "
        "in one line and stop."
    )
    json.dump({"decision": "block", "reason": reason}, sys.stdout)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
