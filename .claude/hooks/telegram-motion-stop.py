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

This is a reminder, not a lock: it blocks once (stop_hook_active suppresses the
next), and saying plainly that the turn was not visual work is a valid answer.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys

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
GAME_RE = re.compile(
    r"\b(orc|undead|revenant|wayfarer|graveweaver|churchyard|tunic|garment|sculpt|armory|"
    r"ve-capture|ashen-reach\.html|loincloth|walkthrough|vista|lighting|atmosphere|"
    r"fog|bloom|skybox|horizon|foliage)\b",
    re.I,
)
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


def last_assistant_text(data: dict) -> str:
    """Claude Code passes a transcript path, not the message. Read the tail of it.

    Only the tail: a long session's transcript is large, and a `tg file` from an
    hour ago is not evidence that *this* turn was delivered -- that is what the
    ledger is for.
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
    chunks = []
    for line in lines[-80:]:
        try:
            rec = json.loads(line)
        except json.JSONDecodeError:
            continue
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


def undelivered_commit_paths(root: str) -> list[str]:
    """Paths touched by commits made after the most recent Telegram delivery."""
    since = ""
    ledger = os.path.join(root, LEDGER)
    if os.path.exists(ledger):
        try:
            with open(ledger) as fh:
                rows = [r.split() for r in fh.read().splitlines() if r.strip()]
            if rows and len(rows[-1]) >= 2:
                sha = rows[-1][1]
                # Only usable if the sha is an ancestor of HEAD; after a rebase or a
                # branch switch it may not be, and then we fall back to the merge base.
                probe = subprocess.run(
                    ["git", "-C", root, "merge-base", "--is-ancestor", sha, "HEAD"],
                    capture_output=True, timeout=6,
                )
                if probe.returncode == 0:
                    since = sha
        except (OSError, ValueError, subprocess.SubprocessError):
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
    if data.get("stop_hook_active") or data.get("stopHookActive"):
        return 0
    if data.get("subagentType") or data.get("hook_event_name") == "SubagentStop":
        return 0

    msg = last_assistant_text(data)
    if MOTION_RE.search(msg) and TELEGRAM_RE.search(msg):
        return 0

    root = data.get("cwd") or data.get("workspaceRoot") or os.getcwd()
    changed = dirty_paths(root) + undelivered_commit_paths(root)
    visual = any(p.startswith(VISUAL_PREFIXES) for p in changed)
    if not visual and not GAME_RE.search(msg):
        return 0

    sample = sorted({p for p in changed if p.startswith(VISUAL_PREFIXES)})[:6]
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
